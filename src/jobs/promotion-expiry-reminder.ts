import { MedusaContainer } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

const BATCH_SIZE = 100

/**
 * Scheduled Job: Check for discount codes about to expire.
 *
 * Strategy: Query promotions with campaigns ending within the reminder window,
 * then find the associated customer via the promotion's customer_id rule.
 * Uses pagination to avoid loading all promotions at once.
 *
 * Schedule: Runs once daily at 9 AM.
 */
export default async function promotionExpiryReminder(container: MedusaContainer) {
    const logger = container.resolve("logger")

    let settings: any
    try {
        const brevoSettingsService: any = container.resolve(BREVO_SETTINGS_MODULE)
        settings = await brevoSettingsService.getSettings()
    } catch {
        return
    }

    if (!settings?.promotion_expiry_reminder_enabled || !settings?.promotion_expiry_reminder_template_id) {
        return
    }

    const daysBefore = settings.promotion_expiry_reminder_days_before || 3
    const codePrefix = (settings.promotion_code_prefix || "WELCOME").toUpperCase()

    logger.info(`[Brevo] Checking promotion expiry reminders (${daysBefore} days before, prefix=${codePrefix})`)

    const now = new Date()
    const reminderWindowStart = now
    const reminderWindowEnd = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000)

    let sentCount = 0
    let offset = 0

    try {
        const promotionService: any = container.resolve("promotion")
        const customerService: any = container.resolve("customer")
        const notificationService: any = container.resolve("notification")

        while (true) {
            const promotions = await promotionService.listPromotions(
                { status: "active" },
                {
                    relations: ["campaign", "rules", "rules.values"],
                    skip: offset,
                    take: BATCH_SIZE,
                }
            )

            if (!promotions.length) break

            for (const promo of promotions) {
                // Only process promotions with our prefix
                if (!promo.code?.startsWith(codePrefix + "-")) continue

                // Check campaign end date is in the reminder window
                const campaign = promo.campaign
                if (!campaign?.ends_at) continue

                const endsAt = new Date(campaign.ends_at)
                if (endsAt <= reminderWindowStart) continue // Already expired
                if (endsAt > reminderWindowEnd) continue // Not yet in reminder window

                // Find customer_id from promotion rules
                const customerRule = promo.rules?.find((r: any) =>
                    r.attribute === "customer_id" && r.operator === "eq"
                )
                if (!customerRule?.values?.length) continue
                const customerId = customerRule.values[0].value

                // Check if reminder was already sent (stored in customer metadata)
                let customer: any
                try {
                    customer = await customerService.retrieveCustomer(customerId)
                } catch {
                    continue // Customer may have been deleted
                }

                const metadata = (customer?.metadata || {}) as Record<string, any>
                const reminderKey = `promo_reminder_${promo.code}`
                if (metadata[reminderKey]) continue // Already sent

                const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

                logger.info(`[Brevo] Sending expiry reminder to ${customer.email} — code ${promo.code} expires in ${daysLeft} day(s)`)

                try {
                    await notificationService.createNotifications({
                        to: customer.email,
                        channel: "email",
                        template: "promotion-expiry-reminder",
                        data: {
                            first_name: customer.first_name,
                            last_name: customer.last_name,
                            promotion_code: promo.code,
                            expires_at: endsAt.toISOString(),
                            days_left: daysLeft,
                            _settings: settings,
                        },
                    })

                    // Mark reminder as sent in customer metadata
                    await customerService.updateCustomers(customerId, {
                        metadata: {
                            ...metadata,
                            [reminderKey]: true,
                        },
                    })

                    sentCount++
                } catch (error: any) {
                    logger.warn(`[Brevo] Expiry reminder failed for ${customer.email}: ${error?.message}`)
                }
            }

            offset += BATCH_SIZE
            if (promotions.length < BATCH_SIZE) break
        }

        logger.info(`[Brevo] Expiry reminder check complete. Sent ${sentCount} reminders.`)
    } catch (error: any) {
        logger.error(`[Brevo] Expiry reminder job error: ${error?.message}`)
    }
}

export const config = {
    name: "promotion-expiry-reminder",
    schedule: "0 9 * * *", // 9 AM daily
}
