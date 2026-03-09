import { createWorkflow, createStep, WorkflowResponse, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BREVO_SETTINGS_MODULE } from "../../modules/brevo-settings"
import { sendAbandonedCartWorkflow } from "../send-abandoned-cart"
import { Modules } from "@medusajs/framework/utils"

/**
 * Abandoned cart email timing logic:
 *
 * intervals = [24, 48, 72] means:
 *   - Email #1: when cart has been inactive for 24h  (based on item.updated_at)
 *   - Email #2: 48h AFTER email #1 was sent
 *   - Email #3: 72h AFTER email #2 was sent
 *
 * Flags stored in cart.metadata as ISO timestamps (not booleans):
 *   - abandonedcart_mail_1: "2026-03-08T10:00:00.000Z"  ← when email #1 was sent
 *   - abandonedcart_mail_2: "2026-03-10T10:00:00.000Z"  ← when email #2 was sent
 *
 * Query uses created_at (immutable) so metadata updates don't affect the filter.
 * Old carts with boolean flags (legacy) are handled gracefully.
 */
const checkAbandonedCartsStep = createStep(
  "check-abandoned-carts-step",
  async (_, { container }) => {
    const cartModuleService = container.resolve(Modules.CART)
    const logger = container.resolve("logger")
    const query = container.resolve("query")

    let settings: any
    try {
      const brevoSettingsService: any = container.resolve(BREVO_SETTINGS_MODULE)
      settings = await brevoSettingsService.getSettings()
    } catch (error) {
      logger.warn("[Brevo] Could not load settings, abandoned cart check skipped.")
      return new StepResponse({ checked: 0, sent: 0 })
    }

    if (!settings.abandoned_cart_enabled) {
      return new StepResponse({ checked: 0, sent: 0 })
    }

    const intervals: number[] = Array.isArray(settings.abandoned_cart_intervals)
      ? settings.abandoned_cart_intervals
      : []

    if (!intervals.length) {
      return new StepResponse({ checked: 0, sent: 0 })
    }

    const sortedIntervals = [...intervals].sort((a, b) => a - b)
    logger.info(`[Brevo] Checking abandoned carts | intervals=[${sortedIntervals.join(", ")}]h`)

    const now = new Date()

    // Use created_at (immutable) so updating metadata doesn't remove cart from future queries.
    // Find carts created at least intervals[0] hours ago — broad pre-filter.
    // Precise timing is enforced below in per-cart logic.
    const minCutoff = new Date(now.getTime() - sortedIntervals[0] * 60 * 60 * 1000)
    // Only check carts from the last 7 days to avoid scanning ancient carts
    const maxAge = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id", "email", "created_at", "updated_at", "completed_at", "metadata",
        "currency_code", "items.id", "items.updated_at",
        "customer.id", "customer.first_name", "customer.last_name",
        "shipping_address.country_code", "shipping_address.phone",
        "region.countries.iso_2", "region.currency_code",
      ],
      filters: {
        completed_at: null,
        email: { $ne: null },
        created_at: { $lte: minCutoff.toISOString(), $gte: maxAge.toISOString() },
      },
    })

    logger.info(`[Brevo] Found ${carts.length} incomplete carts`)
    let sentCount = 0

    for (const cart of carts) {
      if (!cart.items?.length || !cart.email) continue

      const latestItemUpdate = cart.items
        .map((item: any) => new Date(item.updated_at).getTime())
        .reduce((max: number, t: number) => Math.max(max, t), 0)
      const lastActivity = new Date(latestItemUpdate)

      const notifiedFlags = (cart.metadata as Record<string, any>) || {}

      for (let i = 0; i < sortedIntervals.length; i++) {
        const flagKey = `abandonedcart_mail_${i + 1}`
        const discountFlagKey = `abandonedcart_discount_${i + 1}`
        const flagValue = notifiedFlags[flagKey]

        // Skip interval already sent (flag is ISO timestamp string or legacy boolean)
        if (flagValue) continue

        // ── Timing check ────────────────────────────────────────────────────
        let canSendAfter: Date

        if (i === 0) {
          // Email #1: send when cart has been inactive for intervals[0] hours
          // "inactive" = max(item.updated_at) + intervals[0]h <= now
          canSendAfter = new Date(lastActivity.getTime() + sortedIntervals[0] * 60 * 60 * 1000)
        } else {
          // Email #2+: send intervals[i] hours AFTER the previous email was sent
          const prevFlagKey = `abandonedcart_mail_${i}`
          const prevSentValue = notifiedFlags[prevFlagKey]

          // Previous email must exist as ISO timestamp (not boolean legacy flag)
          if (!prevSentValue || typeof prevSentValue !== "string") continue

          const prevSentDate = new Date(prevSentValue)
          if (isNaN(prevSentDate.getTime())) continue

          canSendAfter = new Date(prevSentDate.getTime() + sortedIntervals[i] * 60 * 60 * 1000)
        }

        if (now < canSendAfter) continue
        // ────────────────────────────────────────────────────────────────────

        const emailsSent = Object.keys(notifiedFlags)
          .filter((k) => k.startsWith("abandonedcart_mail_"))
          .filter((k) => !!notifiedFlags[k]).length
        if (emailsSent >= (settings.abandoned_cart_max_emails || sortedIntervals.length)) continue

        // ── Country exclusion: only skip DISCOUNT (coupon), NOT the email ──
        const excludedCountries: string[] = Array.isArray(settings.abandoned_cart_discount_excluded_countries)
          ? settings.abandoned_cart_discount_excluded_countries : []

        let countryExcluded = false
        if (excludedCountries.length > 0) {
          // 1. Check shipping address country (most specific)
          const cc = cart.shipping_address?.country_code?.toLowerCase()
          if (cc && excludedCountries.includes(cc)) {
            countryExcluded = true
            logger.info(`[Brevo] Country ${cc} excluded from discount for ${cart.email} (shipping address)`)
          }

          // 2. Check region countries (fallback when no shipping address)
          if (!countryExcluded && (cart as any).region?.countries?.length) {
            const regionCountries: string[] = (cart as any).region.countries.map((c: any) => c.iso_2?.toLowerCase()).filter(Boolean)
            // If region has only 1 country, we can be certain
            if (regionCountries.length === 1 && excludedCountries.includes(regionCountries[0])) {
              countryExcluded = true
              logger.info(`[Brevo] Country ${regionCountries[0]} excluded from discount for ${cart.email} (region)`)
            }
            // If region has multiple countries but ALL are excluded, also skip discount
            if (!countryExcluded && regionCountries.length > 0 && regionCountries.every(rc => excludedCountries.includes(rc))) {
              countryExcluded = true
              logger.info(`[Brevo] All region countries excluded from discount for ${cart.email} [${regionCountries.join(", ")}]`)
            }
          }

          // 3. Check phone prefix
          if (!countryExcluded && cart.shipping_address?.phone) {
            const PHONE_PREFIXES: Record<string, string> = {
              "+84": "vn", "+66": "th", "+82": "kr", "+81": "jp",
              "+1": "us", "+44": "gb", "+86": "cn", "+91": "in",
              "+65": "sg", "+60": "my", "+62": "id", "+63": "ph",
            }
            for (const [prefix, pcc] of Object.entries(PHONE_PREFIXES)) {
              if (cart.shipping_address.phone.startsWith(prefix) && excludedCountries.includes(pcc)) {
                countryExcluded = true
                logger.info(`[Brevo] Country ${pcc} excluded from discount for ${cart.email} (phone ${prefix})`)
                break
              }
            }
          }
        }
        // ────────────────────────────────────────────────────────────────────

        const isFinalEmail = (i === sortedIntervals.length - 1)
        // If country is excluded → never create discount, even on final email
        const shouldCreateDiscount = isFinalEmail && settings.abandoned_cart_discount_enabled && !countryExcluded

        logger.info(
          `[Brevo] Sending abandoned cart email #${i + 1} to ${cart.email} ` +
          `(cart=${cart.id}, interval=${sortedIntervals[i]}h${shouldCreateDiscount ? ", +discount" : ""})`
        )

        try {
          let discountData: any = {}

          // Create discount code on final email if enabled
          // BUT skip if discount was already created (flag set from a previous failed email attempt)
          if (shouldCreateDiscount && !notifiedFlags[discountFlagKey]) {
            const excludedCurrencies: string[] = Array.isArray(settings.abandoned_cart_discount_excluded_currencies)
              ? settings.abandoned_cart_discount_excluded_currencies : []
            const codePrefix = (settings.abandoned_cart_discount_code_prefix || "COMEBACK").toUpperCase()

            try {
              const promotionService: any = container.resolve("promotion")
              const expiresHours = settings.abandoned_cart_discount_expires_hours || 48
              const discountType = settings.abandoned_cart_discount_type || "percentage"
              const discountValue = settings.abandoned_cart_discount_value || 10
              const isPercentage = discountType === "percentage"

              // Generate unique 8-char alphanumeric suffix
              const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
              let suffix = ""
              for (let j = 0; j < 8; j++) suffix += chars[Math.floor(Math.random() * chars.length)]
              const code = `${codePrefix}-${suffix}`

              const startsAt = new Date()
              const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000)

              // Build promotion rules
              const rules: any[] = []
              if ((cart as any).customer?.id) {
                rules.push({ attribute: "customer_id", operator: "eq", values: [(cart as any).customer.id] })
              }
              for (const cur of excludedCurrencies) {
                rules.push({ attribute: "currency_code", operator: "ne", values: [cur] })
              }

              await promotionService.createPromotions({
                code,
                type: "standard",
                is_automatic: true,
                status: "active",
                rules: rules.length > 0 ? rules : undefined,
                campaign: {
                  name: `Comeback - ${cart.email}`,
                  campaign_identifier: `comeback-${code}`,
                  starts_at: startsAt,
                  ends_at: expiresAt,
                  budget: {
                    type: "usage",
                    limit: settings.abandoned_cart_discount_max_uses || 1,
                  },
                },
                application_method: {
                  type: isPercentage ? "percentage" : "fixed",
                  value: discountValue,
                  target_type: "order",
                  max_quantity: 1,
                  currency_code: isPercentage ? undefined : ((cart as any).currency_code || "usd"),
                },
              })

              discountData = {
                promotion_code: code,
                discount_value: discountValue,
                discount_type: discountType,
                discount_expires_at: new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString(),
              }

              // Save discount flag immediately — prevents duplicate discount creation
              await cartModuleService.updateCarts(cart.id, {
                metadata: {
                  ...notifiedFlags,
                  [discountFlagKey]: true,
                  last_discount_code: code,
                },
              })
              // Refresh notifiedFlags for the email flag update below
              notifiedFlags[discountFlagKey] = true
              notifiedFlags.last_discount_code = code

              logger.info(`[Brevo] Created discount code ${code} for cart ${cart.id}`)
            } catch (discountErr: any) {
              logger.error(`[Brevo] Failed to create discount: ${discountErr?.message}`)
            }
          } else if (shouldCreateDiscount && notifiedFlags[discountFlagKey]) {
            // Discount was already created in a previous run (email failed last time)
            // Re-use the existing discount code
            discountData = {
              promotion_code: notifiedFlags.last_discount_code,
            }
            logger.info(`[Brevo] Re-using existing discount ${notifiedFlags.last_discount_code} for cart ${cart.id}`)
          }

          // Send email
          await sendAbandonedCartWorkflow(container).run({
            input: {
              cartId: cart.id,
              ...discountData,
              _useDiscountTemplate: shouldCreateDiscount && !!discountData.promotion_code,
            },
          })

          // Store ISO timestamp (not boolean) so subsequent emails can calculate timing
          await cartModuleService.updateCarts(cart.id, {
            metadata: {
              ...notifiedFlags,
              [flagKey]: new Date().toISOString(),
            },
          })

          sentCount++
        } catch (error: any) {
          logger.error(`[Brevo] Failed abandoned cart email for cart ${cart.id}: ${error.message}`)
          // Email failed — but discount flag is already saved if discount was created
          // Next run will retry email WITHOUT creating a new discount
        }

        break // Only send one email per cart per job run
      }
    }

    logger.info(`[Brevo] Abandoned cart check complete. Sent ${sentCount} emails.`)
    return new StepResponse({ checked: carts.length, sent: sentCount })
  }
)

export const checkAbandonedCartsWorkflow = createWorkflow(
  "check-abandoned-carts",
  () => {
    const result = checkAbandonedCartsStep()
    return new WorkflowResponse(result)
  }
)
