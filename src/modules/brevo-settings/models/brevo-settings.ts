import { model } from "@medusajs/framework/utils"

const BrevoSettings = model.define("brevo_settings", {
  id: model.id().primaryKey(),

  // ─── Email Template IDs ───
  order_placed_template_id: model.text().nullable(),
  order_canceled_template_id: model.text().nullable(),
  order_delivered_template_id: model.text().nullable(),
  customer_created_template_id: model.text().nullable(),
  promotion_new_customer_template_id: model.text().nullable(),
  shipment_confirmed_template_id: model.text().nullable(),
  abandoned_cart_template_id: model.text().nullable(),
  review_request_template_id: model.text().nullable(),
  winback_template_id: model.text().nullable(),

  // ─── Sender ───
  sender_name: model.text().nullable(),

  // ─── Enable/disable per event ───
  order_placed_enabled: model.boolean().default(true),
  order_canceled_enabled: model.boolean().default(true),
  order_delivered_enabled: model.boolean().default(true),
  customer_created_enabled: model.boolean().default(true),
  promotion_enabled: model.boolean().default(true),
  shipment_confirmed_enabled: model.boolean().default(true),

  // ─── Promotion New Customer Config ───
  promotion_auto_create: model.boolean().default(false),
  promotion_discount_type: model.text().default("percentage"),
  promotion_discount_value: model.number().default(10),
  promotion_expiry_days: model.number().default(30),
  promotion_excluded_currencies: model.json().nullable(),
  promotion_excluded_countries: model.json().nullable(),  // e.g. ["vn","th"]
  promotion_code_prefix: model.text().default("WELCOME"),

  // ─── Discount Expiry Reminder ───
  promotion_expiry_reminder_enabled: model.boolean().default(false),
  promotion_expiry_reminder_template_id: model.text().nullable(),
  promotion_expiry_reminder_days_before: model.number().default(3),

  // ─── Abandoned Cart ───
  abandoned_cart_enabled: model.boolean().default(false),
  abandoned_cart_intervals: model.json().nullable(),
  abandoned_cart_max_emails: model.number().default(3),

  // ─── Abandoned Cart Discount ───
  abandoned_cart_discount_enabled: model.boolean().default(false),
  abandoned_cart_discount_type: model.text().default("percentage"),
  abandoned_cart_discount_value: model.number().default(10),
  abandoned_cart_discount_max_uses: model.number().default(1),
  abandoned_cart_discount_expires_hours: model.number().default(48),
  abandoned_cart_discount_template_id: model.text().nullable(),
  abandoned_cart_discount_excluded_currencies: model.json().nullable(),
  abandoned_cart_discount_excluded_countries: model.json().nullable(),
  abandoned_cart_discount_code_prefix: model.text().default("COMEBACK"),

  // ─── Brevo Contact Sync ───
  contact_sync_enabled: model.boolean().default(false),
  contact_sync_list_id: model.number().nullable(),

  // ─── Event Tracking ───
  event_tracking_enabled: model.boolean().default(false),

  // ─── Review Request ───
  review_request_enabled: model.boolean().default(false),
  review_request_days_after: model.number().default(7),

  // ─── Win-back Campaign ───
  winback_enabled: model.boolean().default(false),
  winback_days_inactive: model.number().default(30),

  // ─── Multi-language Templates ───
  // JSON map: { "vi": { "order.placed": 101, "order.canceled": 102 }, "en": { ... } }
  multilang_enabled: model.boolean().default(false),
  multilang_templates: model.json().nullable(),

  // ─── Webhook ───
  webhook_enabled: model.boolean().default(false),
  webhook_secret: model.text().nullable(),

  // ─── WhatsApp ───
  whatsapp_enabled: model.boolean().default(false),
  whatsapp_order_placed_template: model.text().nullable(),
  whatsapp_shipment_template: model.text().nullable(),
  whatsapp_abandoned_cart_template: model.text().nullable(),

  // ─── SMS ───
  sms_enabled: model.boolean().default(false),
  sms_sender: model.text().nullable(),
  sms_order_placed_content: model.text().nullable(),
  sms_shipment_content: model.text().nullable(),
})

export default BrevoSettings
