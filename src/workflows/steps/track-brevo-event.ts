import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BREVO_SETTINGS_MODULE } from "../../modules/brevo-settings"

/**
 * Step: Track an event in Brevo for automation triggers.
 */
export const trackBrevoEventStep = createStep(
    "track-brevo-event",
    async (input: {
        email: string
        event: string
        eventdata?: Record<string, any>
    }, { container }) => {
        const logger = container.resolve("logger")

        let settings: any
        try {
            const brevoSettingsService: any = container.resolve(BREVO_SETTINGS_MODULE)
            settings = await brevoSettingsService.getSettings()
        } catch {
            settings = {}
        }

        if (!settings?.event_tracking_enabled) {
            return new StepResponse({ tracked: false })
        }

        try {
            const notificationService = container.resolve("notification")
            const providers = (notificationService as any).providersMap_ || (notificationService as any).providers_
            let brevoProvider: any = null

            if (providers) {
                for (const [, provider] of providers) {
                    if (provider?.constructor?.identifier === "brevo" || provider?.trackEvent) {
                        brevoProvider = provider
                        break
                    }
                }
            }

            if (brevoProvider?.trackEvent) {
                await brevoProvider.trackEvent({
                    email: input.email,
                    event: input.event,
                    eventdata: input.eventdata,
                })
            }
        } catch (error: any) {
            logger.warn(`[Brevo] Event tracking error: ${error?.message}`)
        }

        return new StepResponse({ tracked: true })
    }
)
