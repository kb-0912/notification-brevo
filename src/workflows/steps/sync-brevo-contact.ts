import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BREVO_SETTINGS_MODULE } from "../../modules/brevo-settings"

/**
 * Step: Sync a contact to Brevo when customer is created or places an order.
 */
export const syncBrevoContactStep = createStep(
    "sync-brevo-contact",
    async (input: {
        email: string
        firstName?: string
        lastName?: string
        phone?: string
        orderId?: string
    }, { container }) => {
        const logger = container.resolve("logger")

        // Check if contact sync is enabled
        let settings: any
        try {
            const brevoSettingsService: any = container.resolve(BREVO_SETTINGS_MODULE)
            settings = await brevoSettingsService.getSettings()
        } catch {
            settings = {}
        }

        if (!settings?.contact_sync_enabled) {
            logger.info("[Brevo] Contact sync disabled, skipping.")
            return new StepResponse({ synced: false })
        }

        try {
            const notificationService = container.resolve("notification")
            // Access the brevo provider directly
            const providers = (notificationService as any).providersMap_ || (notificationService as any).providers_
            let brevoProvider: any = null

            // Try to find the brevo provider
            if (providers) {
                for (const [, provider] of providers) {
                    if (provider?.constructor?.identifier === "brevo" || provider?.syncContact) {
                        brevoProvider = provider
                        break
                    }
                }
            }

            if (brevoProvider?.syncContact) {
                await brevoProvider.syncContact({
                    email: input.email,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    phone: input.phone,
                    listIds: settings.contact_sync_list_id ? [settings.contact_sync_list_id] : undefined,
                    attributes: input.orderId ? { LAST_ORDER_ID: input.orderId } : undefined,
                })
            } else {
                logger.warn("[Brevo] Could not find Brevo provider for contact sync")
            }
        } catch (error: any) {
            logger.warn(`[Brevo] Contact sync error: ${error?.message}`)
        }

        return new StepResponse({ synced: true })
    }
)
