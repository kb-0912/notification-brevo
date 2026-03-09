import {
  createWorkflow,
  createStep,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"
import { syncBrevoContactStep } from "./steps/sync-brevo-contact"
import { trackBrevoEventStep } from "./steps/track-brevo-event"
import { resolveLocaleStep } from "./steps/resolve-locale"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

type WorkflowInput = {
  id: string
}

const loadSettingsStep = createStep(
  "load-settings-for-customer-created",
  async (_, { container }) => {
    try {
      const brevoSettingsService: any = container.resolve(BREVO_SETTINGS_MODULE)
      const settings = await brevoSettingsService.getSettings()
      return new StepResponse(settings)
    } catch {
      return new StepResponse({})
    }
  }
)

/**
 * Combined step: Auto-create a promotion AND send the promotion email.
 * Must be a single step because Medusa workflow DAG is static —
 * you cannot access step output properties (e.g. promoResult.promotion_code)
 * at workflow composition time.
 */
const autoCreateAndSendPromotionStep = createStep(
  "auto-create-and-send-promotion",
  async (input: {
    customerId: string
    locale?: string
  }, { container }) => {
    const logger = container.resolve("logger")
    const Modules = await import("@medusajs/framework/utils").then(m => m.Modules)

    // ── Load settings ──
    let settings: any
    try {
      const brevoSettingsService: any = container.resolve(BREVO_SETTINGS_MODULE)
      settings = await brevoSettingsService.getSettings()
    } catch {
      return new StepResponse(null)
    }

    if (!settings?.promotion_auto_create) {
      return new StepResponse(null)
    }

    // ── Load customer directly from DB (proven pattern from old subscriber) ──
    const customerModuleService: any = container.resolve(Modules.CUSTOMER)
    let customer: any
    try {
      customer = await customerModuleService.retrieveCustomer(input.customerId)
    } catch (e: any) {
      logger.error(`[Brevo] Could not retrieve customer ${input.customerId}: ${e?.message}`)
      return new StepResponse(null)
    }

    if (!customer.has_account) {
      logger.info(`[Brevo] Skipping welcome promotion for ${customer.email}: no account`)
      return new StepResponse(null)
    }

    // ── Country exclusion: check phone prefix ──
    // Parse excluded countries robustly (handle both array and stringified JSON)
    let excludedCountries: string[] = []
    const rawExcluded = settings.promotion_excluded_countries
    if (Array.isArray(rawExcluded)) {
      excludedCountries = rawExcluded
    } else if (typeof rawExcluded === "string") {
      try { excludedCountries = JSON.parse(rawExcluded) } catch { /* ignore */ }
    }

    logger.info(`[Brevo] Welcome promotion check | email=${customer.email} | phone=${customer.phone} | excludedCountries=${JSON.stringify(excludedCountries)}`)

    if (excludedCountries.length > 0 && customer.phone) {
      // Phone prefix → country (match both +84 and 84 formats)
      const PHONE_PREFIXES: Record<string, string> = {
        "+84": "vn", "84": "vn",
        "+66": "th", "66": "th",
        "+82": "kr", "82": "kr",
        "+81": "jp", "81": "jp",
        "+1": "us",
        "+44": "gb", "44": "gb",
        "+86": "cn", "86": "cn",
        "+91": "in", "91": "in",
        "+65": "sg", "65": "sg",
        "+60": "my", "60": "my",
        "+62": "id", "62": "id",
        "+63": "ph", "63": "ph",
        "+61": "au", "+64": "nz",
        "+49": "de", "+33": "fr",
        "+39": "it", "+34": "es",
        "+971": "ae", "+966": "sa",
        "+886": "tw", "+852": "hk", "+853": "mo",
      }

      // Sort by prefix length descending to match longer prefixes first (+886 before +8)
      const sortedPrefixes = Object.entries(PHONE_PREFIXES).sort((a, b) => b[0].length - a[0].length)
      for (const [prefix, cc] of sortedPrefixes) {
        if (customer.phone.startsWith(prefix) && excludedCountries.includes(cc)) {
          logger.info(`[Brevo] Skipping welcome promotion for ${customer.email}: excluded country ${cc} (phone ${prefix})`)
          return new StepResponse(null)
        }
      }
    }

    // ── Create promotion ──
    try {
      const promotionService: any = container.resolve(Modules.PROMOTION)

      const discountType = settings.promotion_discount_type || "percentage"
      const discountValue = settings.promotion_discount_value || 10
      const expiryDays = settings.promotion_expiry_days || 30
      const isPercentage = discountType === "percentage"
      const excludedCurrencies: string[] = Array.isArray(settings.promotion_excluded_currencies)
        ? settings.promotion_excluded_currencies : []
      const codePrefix = (settings.promotion_code_prefix || "WELCOME").toUpperCase()

      // Generate unique code (same format as old subscriber: PREFIX-XXXXXXXX)
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
      let suffix = ""
      for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
      const code = `${codePrefix}-${suffix}`
      const startsAt = new Date()
      const endsAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

      // Build promotion rules
      const rules: any[] = [
        { attribute: "customer_id", operator: "eq", values: [customer.id] },
      ]
      for (const cur of excludedCurrencies) {
        rules.push({ attribute: "currency_code", operator: "ne", values: [cur] })
      }

      await promotionService.createPromotions({
        code,
        type: "standard",
        is_automatic: true,
        status: "active",
        rules,
        campaign: {
          name: `Welcome - ${customer.email} - ${customer.phone}`,
          campaign_identifier: `welcome-${code}`,
          starts_at: startsAt,
          ends_at: endsAt,
          budget: { type: "usage", limit: 1 },
        },
        application_method: {
          type: isPercentage ? "percentage" : "fixed",
          value: discountValue,
          target_type: "order",
          max_quantity: 1,
          currency_code: isPercentage ? undefined : (customer.currency_code || "usd"),
        },
      })

      // Store in customer metadata for expiry reminder tracking
      await customerModuleService.updateCustomers(customer.id, {
        metadata: {
          welcome_promotion_code: code,
          welcome_promotion_expires_at: endsAt.toISOString(),
        },
      })

      logger.info(`[Brevo] Created welcome promotion ${code} for ${customer.email}`)

      // Send the promotion email
      const notificationService: any = container.resolve("notification")
      await notificationService.createNotifications({
        to: customer.email,
        channel: "email",
        template: "promotion-new-customer",
        data: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          promotion_code: code,
          discount_value: discountValue,
          discount_type: discountType,
          ends_at: endsAt.toISOString(),
          _settings: settings,
          _locale: input.locale,
        },
      })

      logger.info(`[Brevo] Promotion email sent to ${customer.email} with code ${code}`)
      return new StepResponse({ promotion_code: code })
    } catch (error: any) {
      logger.error(`[Brevo] Auto-create promotion failed: ${error?.message}`)
      return new StepResponse(null)
    }
  }
)

export const sendCustomerCreatedWorkflow = createWorkflow(
  "send-customer-created",
  ({ id }: WorkflowInput) => {
    const settings = loadSettingsStep()

    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["*", "first_name", "last_name", "phone", "has_account", "metadata"],
      filters: { id },
    })

    // Resolve customer preferred language
    const locale = resolveLocaleStep({
      customerMetadata: customers[0].metadata,
      phone: customers[0].phone,
    })

    const notification = sendNotificationStep([
      {
        to: customers[0].email,
        channel: "email",
        template: "customer.created",
        data: {
          customer: customers[0],
          _settings: settings,
          _locale: locale,
        },
      },
    ])

    // Sync new customer to Brevo contacts
    syncBrevoContactStep({
      email: customers[0].email,
      firstName: customers[0].first_name,
      lastName: customers[0].last_name,
      phone: customers[0].phone,
    })

    // Track customer creation event
    trackBrevoEventStep({
      email: customers[0].email,
      event: "customer_created",
      eventdata: { customer_id: customers[0].id },
    })

    // Auto-create welcome promotion + send email (single step)
    autoCreateAndSendPromotionStep({
      customerId: customers[0].id,
      locale,
    })

    return new WorkflowResponse(notification)
  }
)