import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BREVO_SETTINGS_MODULE } from "../../../modules/brevo-settings"

/**
 * Brevo webhook endpoint for email event tracking.
 * This is a PUBLIC route (no admin auth required) — Brevo sends POSTs here.
 *
 * Configure in Brevo: Settings > Webhooks > Add webhook URL:
 * https://your-domain.com/hooks/brevo-webhook
 */
export async function POST(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const logger = req.scope.resolve("logger")

    try {
        const brevoSettingsService: any = req.scope.resolve(BREVO_SETTINGS_MODULE)
        const settings = await brevoSettingsService.getSettings()

        if (!settings?.webhook_enabled) {
            return res.status(200).json({ message: "Webhook disabled" })
        }

        // Optionally verify webhook secret
        if (settings.webhook_secret) {
            const signature = req.headers["x-brevo-signature"] || req.headers["x-mailin-custom"]
            if (signature !== settings.webhook_secret) {
                return res.status(401).json({ error: "Invalid webhook signature" })
            }
        }

        const payload = req.body as Record<string, any>
        const event = payload?.event || payload?.["event-type"] || "unknown"
        const email = payload?.email || payload?.to || ""
        const messageId = payload?.["message-id"] || payload?.messageId || ""
        const tag = payload?.tag || ""

        logger.info(
            `[Brevo Webhook] event=${event} | email=${email} | messageId=${messageId} | tag=${tag}`
        )

        res.status(200).json({ received: true, event })
    } catch (error: any) {
        logger.error(`[Brevo Webhook] Error: ${error.message}`)
        res.status(500).json({ error: "Webhook processing failed" })
    }
}
