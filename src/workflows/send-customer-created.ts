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
    email: string
    firstName?: string
    lastName?: string
    phone?: string
    hasAccount?: boolean
    currencyCode?: string
    locale?: string
  }, { container }) => {
    const logger = container.resolve("logger")

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

    // Skip if customer doesn't have an account (guest)
    if (!input.hasAccount) {
      logger.info(`[Brevo] Skipping welcome promotion for ${input.email}: no account`)
      return new StepResponse(null)
    }

    // Skip if customer's country or phone prefix is in excluded list
    const excludedCountries: string[] = Array.isArray(settings.promotion_excluded_countries)
      ? settings.promotion_excluded_countries : []

    if (excludedCountries.length > 0) {
      // Phone prefix → country lookup (common countries)
      const PHONE_PREFIXES: Record<string, string> = {
        "+84": "vn", "+66": "th", "+82": "ko", "+81": "ja",
        "+1": "us", "+44": "gb", "+86": "cn", "+91": "in",
        "+65": "sg", "+60": "my", "+62": "id", "+63": "ph",
        "+61": "au", "+64": "nz", "+49": "de", "+33": "fr",
        "+39": "it", "+34": "es", "+7": "ru", "+55": "br",
        "+52": "mx", "+971": "ae", "+966": "sa",
        "+886": "tw", "+852": "hk", "+853": "mo",
      }

      // Check phone prefix
      if (input.phone) {
        for (const [prefix, cc] of Object.entries(PHONE_PREFIXES)) {
          if (input.phone.startsWith(prefix) && excludedCountries.includes(cc)) {
            logger.info(`[Brevo] Skipping welcome promotion for ${input.email}: excluded country ${cc} (phone ${prefix})`)
            return new StepResponse(null)
          }
        }
      }
    }

    try {
      const promotionService: any = container.resolve("promotion")
      const customerService: any = container.resolve("customer")

      const discountType = settings.promotion_discount_type || "percentage"
      const discountValue = settings.promotion_discount_value || 10
      const expiryDays = settings.promotion_expiry_days || 30
      const isPercentage = discountType === "percentage"
      const excludedCurrencies: string[] = Array.isArray(settings.promotion_excluded_currencies)
        ? settings.promotion_excluded_currencies : []
      const codePrefix = (settings.promotion_code_prefix || "WELCOME").toUpperCase()

      // Generate unique 8-char alphanumeric suffix
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I/O/0/1 to avoid confusion
      let suffix = ""
      for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
      const code = `${codePrefix}-${suffix}`
      const startsAt = new Date()
      const endsAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

      // Build promotion rules
      const rules: any[] = [
        // Lock to this specific customer
        { attribute: "customer_id", operator: "eq", values: [input.customerId] },
      ]
      // Exclude currencies
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
          name: `Welcome - ${input.email}`,
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
          currency_code: isPercentage ? undefined : (input.currencyCode || "usd"),
        },
      })

      // Store in customer metadata for expiry reminder tracking
      await customerService.updateCustomers(input.customerId, {
        metadata: {
          welcome_promotion_code: code,
          welcome_promotion_expires_at: endsAt.toISOString(),
        },
      })

      logger.info(`[Brevo] Created welcome promotion ${code} for ${input.email}`)

      // Send the promotion email
      const notificationService: any = container.resolve("notification")
      await notificationService.createNotifications({
        to: input.email,
        channel: "email",
        template: "promotion-new-customer",
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          promotion_code: code,
          discount_value: discountValue,
          discount_type: discountType,
          ends_at: endsAt.toISOString(),
          _settings: settings,
          _locale: input.locale,
        },
      })

      logger.info(`[Brevo] Promotion email sent to ${input.email} with code ${code}`)
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
      email: customers[0].email,
      firstName: customers[0].first_name,
      lastName: customers[0].last_name,
      phone: customers[0].phone,
      hasAccount: customers[0].has_account,
      locale,
    })

    return new WorkflowResponse(notification)
  }
)