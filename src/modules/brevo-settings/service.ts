import { MedusaService } from "@medusajs/framework/utils"
import BrevoSettings from "./models/brevo-settings"

// All writable fields from the brevo_settings model
const ALLOWED_FIELDS = new Set([
    "order_placed_template_id",
    "order_canceled_template_id",
    "order_delivered_template_id",
    "customer_created_template_id",
    "promotion_new_customer_template_id",
    "shipment_confirmed_template_id",
    "abandoned_cart_template_id",
    "review_request_template_id",
    "winback_template_id",
    "sender_name",
    "order_placed_enabled",
    "order_canceled_enabled",
    "order_delivered_enabled",
    "customer_created_enabled",
    "promotion_enabled",
    "promotion_auto_create",
    "promotion_discount_type",
    "promotion_discount_value",
    "promotion_expiry_days",
    "promotion_excluded_currencies",
    "promotion_code_prefix",
    "promotion_expiry_reminder_enabled",
    "promotion_expiry_reminder_template_id",
    "promotion_expiry_reminder_days_before",
    "shipment_confirmed_enabled",
    "abandoned_cart_enabled",
    "abandoned_cart_intervals",
    "abandoned_cart_max_emails",
    "abandoned_cart_discount_enabled",
    "abandoned_cart_discount_type",
    "abandoned_cart_discount_value",
    "abandoned_cart_discount_max_uses",
    "abandoned_cart_discount_expires_hours",
    "abandoned_cart_discount_template_id",
    "abandoned_cart_discount_excluded_currencies",
    "abandoned_cart_discount_code_prefix",
    "contact_sync_enabled",
    "contact_sync_list_id",
    "event_tracking_enabled",
    "review_request_enabled",
    "review_request_days_after",
    "winback_enabled",
    "winback_days_inactive",
    "multilang_enabled",
    "multilang_templates",
    "webhook_enabled",
    "webhook_secret",
    "whatsapp_enabled",
    "whatsapp_order_placed_template",
    "whatsapp_shipment_template",
    "whatsapp_abandoned_cart_template",
    "sms_enabled",
    "sms_sender",
    "sms_order_placed_content",
    "sms_shipment_content",
])

class BrevoSettingsModuleService extends MedusaService({
    BrevoSettings,
}) {
    /**
     * Get the singleton settings record, or create a default one if none exists.
     */
    async getSettings() {
        const [settings] = await this.listBrevoSettings({}, { take: 1 })
        if (settings) {
            return settings
        }
        const created = await this.createBrevoSettings({})
        return created
    }

    /**
     * Upsert settings - always update the singleton record.
     * Strips unknown fields to prevent MikroORM errors.
     */
    async upsertSettings(data: Record<string, any>) {
        const existing = await this.getSettings()

        // Only keep fields that exist in the model
        const cleanData: Record<string, any> = {}
        for (const [key, value] of Object.entries(data)) {
            if (ALLOWED_FIELDS.has(key)) {
                cleanData[key] = value
            }
        }

        // MikroORM deep-merges JSON objects, which means deleting keys
        // from a JSON field (e.g. removing a locale from multilang_templates)
        // has no effect — the old keys persist.
        // Fix: nullify JSON fields first, then set the new value.
        const JSON_FIELDS = ["multilang_templates", "abandoned_cart_intervals", "promotion_excluded_currencies", "abandoned_cart_discount_excluded_currencies"]
        for (const field of JSON_FIELDS) {
            if (field in cleanData) {
                await this.updateBrevoSettings({
                    id: existing.id,
                    [field]: null,
                })
            }
        }

        const updated = await this.updateBrevoSettings({
            id: existing.id,
            ...cleanData,
        })
        return updated
    }
}

export default BrevoSettingsModuleService
