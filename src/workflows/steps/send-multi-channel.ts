import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BREVO_SETTINGS_MODULE } from "../../modules/brevo-settings"

/**
 * Step: Send SMS and/or WhatsApp notification via Brevo.
 * Loads settings internally from the container — avoids proxy issues.
 */
export const sendMultiChannelStep = createStep(
    "send-multi-channel",
    async (input: {
        email: string
        phone?: string
        event: string // e.g. "order_placed", "shipment_created"
        displayId?: string | number
    }, { container }) => {
        const logger = container.resolve("logger")

        if (!input.phone) {
            return new StepResponse({ sms: false, whatsapp: false })
        }

        let settings: any
        try {
            const svc: any = container.resolve(BREVO_SETTINGS_MODULE)
            settings = await svc.getSettings()
        } catch {
            return new StepResponse({ sms: false, whatsapp: false })
        }

        let smsSent = false
        let whatsappSent = false

        // Resolve Brevo provider
        let brevoProvider: any = null
        try {
            const notificationService: any = container.resolve("notification")
            // Try multiple patterns to find the provider
            if (notificationService.retrieveProvider) {
                brevoProvider = notificationService.retrieveProvider("brevo")
            }
        } catch {
            // Provider not available, skip silently
            return new StepResponse({ sms: false, whatsapp: false })
        }

        if (!brevoProvider) {
            return new StepResponse({ sms: false, whatsapp: false })
        }

        // Resolve SMS content from settings
        const smsContentMap: Record<string, string> = {
            order_placed: settings.sms_order_placed_content || `Your order #${input.displayId || ""} has been placed!`,
            shipment_created: settings.sms_shipment_content || `Your order #${input.displayId || ""} has been shipped!`,
        }

        // Resolve WhatsApp template name from settings
        const whatsappTemplateMap: Record<string, string> = {
            order_placed: settings.whatsapp_order_placed_template || "",
            shipment_created: settings.whatsapp_shipment_template || "",
        }

        // Send SMS
        if (settings?.sms_enabled && smsContentMap[input.event] && brevoProvider.sendSms) {
            try {
                await brevoProvider.sendSms({
                    to: input.phone,
                    content: smsContentMap[input.event],
                    sender: settings.sms_sender || undefined,
                })
                smsSent = true
            } catch (err: any) {
                logger.warn(`[Brevo] SMS failed: ${err?.message}`)
            }
        }

        // Send WhatsApp
        if (settings?.whatsapp_enabled && whatsappTemplateMap[input.event] && brevoProvider.sendWhatsApp) {
            try {
                await brevoProvider.sendWhatsApp({
                    to: input.phone,
                    templateName: whatsappTemplateMap[input.event],
                    params: { display_id: String(input.displayId || "") },
                })
                whatsappSent = true
            } catch (err: any) {
                logger.warn(`[Brevo] WhatsApp failed: ${err?.message}`)
            }
        }

        return new StepResponse({ sms: smsSent, whatsapp: whatsappSent })
    }
)
