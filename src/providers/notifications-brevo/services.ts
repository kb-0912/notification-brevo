import {
	AbstractNotificationProviderService,
	MedusaError,
} from "@medusajs/framework/utils"
import {
	ProviderSendNotificationDTO,
	ProviderSendNotificationResultsDTO,
	Logger,
} from "@medusajs/framework/types"
import { BrevoProviderConfig } from "./types"

class BrevoProviderService extends AbstractNotificationProviderService {
	static identifier = "brevo"

	protected options: BrevoProviderConfig
	protected logger: Logger
	protected brevo: any

	constructor(
		{ logger }: { logger: Logger },
		options: BrevoProviderConfig
	) {
		super()
		this.options = options
		this.logger = logger

		if (!this.options.apiKey) {
			throw new MedusaError(MedusaError.Types.INVALID_DATA, "BREVO_API_KEY must be set")
		}
		if (!this.options.from) {
			throw new MedusaError(MedusaError.Types.INVALID_DATA, "BREVO_FROM_EMAIL must be set")
		}

		// Lazy-load @getbrevo/brevo inside constructor — NOT top-level import.
		// The SDK's Fern runtime.js reads navigator.userAgent at module load time,
		// which crashes in Node.js if imported at the top of the file.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { BrevoClient } = require("@getbrevo/brevo")
		this.brevo = new BrevoClient({ apiKey: this.options.apiKey })
		this.logger.info(`[Brevo] Provider initialized successfully`)
	}

	// ─── Utility ───

	humanPrice(amount: number | null | undefined, currencyCode: string): string {
		if (!amount) return "0"
		return new Intl.NumberFormat([], {
			style: "currency",
			currencyDisplay: "narrowSymbol",
			currency: currencyCode,
		}).format(amount)
	}

	private mapPaymentMethod(providerId: string | undefined): string {
		if (!providerId) return "Unknown"
		const map: Record<string, string> = {
			"pp_bank-transfer_bank-transfer": "Bank Transfer",
			"pp_system_default": "Cash on Delivery",
		}
		if (providerId.startsWith("pp_stripe_")) return "Credit Card"
		return map[providerId] || providerId
	}

	// ─── Template Resolution ───

	private resolveTemplateId(template: string, data: any): number {
		const s = data?._settings
		const o = this.options

		// Check if event is enabled in admin settings
		const enabledMap: Record<string, boolean | undefined> = {
			"order.placed": s?.order_placed_enabled,
			"order.canceled": s?.order_canceled_enabled,
			"order.delivered": s?.order_delivered_enabled,
			"customer.created": s?.customer_created_enabled,
			"promotion-new-customer": s?.promotion_enabled,
			"shipment.confirmed": s?.shipment_confirmed_enabled,
			"cart.abandoned": s?.abandoned_cart_enabled,
			"cart.abandoned.discount": s?.abandoned_cart_enabled,
			"review.request": s?.review_request_enabled,
			"winback": s?.winback_enabled,
			"promotion-expiry-reminder": s?.promotion_expiry_reminder_enabled,
		}

		// If settings exist and event is explicitly disabled, skip
		if (s && enabledMap[template] === false) {
			throw new MedusaError(
				MedusaError.Types.NOT_ALLOWED,
				`Event "${template}" is disabled in settings.`
			)
		}

		// Multi-language: check locale-specific template override
		// _locale comes from customer.metadata.preferred_locale (set by storefront)
		const locale = data?._locale
		if (s?.multilang_enabled && s?.multilang_templates && locale) {
			const localeMap = s.multilang_templates[locale]
			if (localeMap && localeMap[template]) {
				const localeId = parseInt(localeMap[template], 10)
				if (!isNaN(localeId) && localeId > 0) {
					this.logger.info(`[Brevo] Using locale "${locale}" template ${localeId} for "${template}"`)
					return localeId
				}
			}
			// Locale configured but no template for this event → fall through to default
		}

		// Default template ID: DB settings > env vars
		const templateMap: Record<string, string | undefined> = {
			"order.placed": s?.order_placed_template_id || o.orderPlacedTemplateId,
			"order.canceled": s?.order_canceled_template_id || o.orderCanceledTemplateId,
			"order.delivered": s?.order_delivered_template_id || o.orderDeliveredTemplateId,
			"customer.created": s?.customer_created_template_id || o.customerCreatedTemplateId,
			"promotion-new-customer": s?.promotion_new_customer_template_id || o.promotionNewCustomerTemplateId,
			"shipment.confirmed": s?.shipment_confirmed_template_id || o.shipmentConfirmedTemplateId,
			"cart.abandoned": s?.abandoned_cart_template_id || o.abandonedCartTemplateId,
			"cart.abandoned.discount": s?.abandoned_cart_discount_template_id || s?.abandoned_cart_template_id || o.abandonedCartTemplateId,
			"review.request": s?.review_request_template_id,
			"winback": s?.winback_template_id,
			"promotion-expiry-reminder": s?.promotion_expiry_reminder_template_id,
		}

		const raw = templateMap[template]
		const id = parseInt(raw || "", 10)

		if (isNaN(id) || id === 0) {
			throw new MedusaError(
				MedusaError.Types.NOT_FOUND,
				`Template ID for "${template}" is not configured.`
			)
		}
		return id
	}

	// ─── Params Builder ───

	private buildParams(template: string, data: any): Record<string, any> {
		switch (template) {
			case "order.placed": {
				const order = data.order
				if (!order) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order data missing")
				return {
					order_id: order.id,
					email: order.email,
					currency_code: order.currency_code,
					date_placed: new Date(order.created_at).toLocaleDateString(),
					display_id: order.display_id,
					total: this.humanPrice(order.total, order.currency_code),
					customer_name: [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" "),
					items: Array.isArray(order.items)
						? order.items.map((item: any) => ({
							...item,
							unit_price: this.humanPrice(item.unit_price, order.currency_code),
							total: this.humanPrice(item.total, order.currency_code),
							thumbnail: item.thumbnail,
							title: item.product_title,
							description: item.product_description,
						}))
						: [],
					shipping_address: order.shipping_address,
					billing_address: order.billing_address,
					shipping_subtotal: this.humanPrice(order.shipping_subtotal, order.currency_code),
					shipping_methods: order.shipping_methods || [],
					payment_collections: order.payment_collections?.[0]?.payments?.map((p: any) => ({
						...p,
						provider_id: this.mapPaymentMethod(p.provider_id),
					})) || [],
					fulfillments: order.fulfillments || [],
				}
			}

			case "order.canceled": {
				const order = data.order
				if (!order) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order data missing")
				return {
					order_id: order.id,
					display_id: order.display_id,
					customer_name: [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") ||
						order.billing_address?.first_name || "",
				}
			}

			case "order.delivered": {
				const fulfillment = data.fulfillment
				const order = fulfillment?.order
				if (!order) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order data missing for delivery")
				return {
					customer_name: [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" "),
					order: {
						display_id: order.display_id,
						date: new Date(order.created_at).toLocaleDateString(),
						shipping_address: order.shipping_address,
						items: Array.isArray(order.items)
							? order.items.map((item: any) => ({
								title: item.product_title,
								quantity: item.quantity,
								unit_price: this.humanPrice(item.unit_price, order.currency_code),
							}))
							: [],
						total: this.humanPrice(order.total, order.currency_code),
					},
				}
			}

			case "customer.created": {
				const customer = data.customer
				if (!customer) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Customer data missing")
				return {
					name: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
					phone: customer.phone,
					customer_id: customer.id,
				}
			}

			case "promotion-new-customer":
				return {
					first_name: data.first_name,
					last_name: data.last_name,
					phone: data.phone,
					ends_at: data.ends_at,
					promotion_code: data.promotion_code,
				}

			case "shipment.confirmed": {
				const f = data.fulfillment
				if (!f) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Fulfillment data missing")
				const trackingNumbers = f.labels?.map((l: any) => l.tracking_number)?.filter(Boolean) || []
				const trackingUrls = f.labels?.map((l: any) => l.tracking_url)?.filter(Boolean) || []
				return {
					customer_name: [f.order?.shipping_address?.first_name, f.order?.shipping_address?.last_name].filter(Boolean).join(" "),
					tracking_number: trackingNumbers[0] || "",
					tracking_url: trackingUrls[0] || "",
					order: {
						display_id: f.order?.display_id,
						items: Array.isArray(f.order?.items)
							? f.order.items.map((item: any) => ({
								title: item.product_title,
								quantity: item.quantity,
								unit_price: this.humanPrice(item.unit_price, f.order?.currency_code),
							}))
							: [],
						total: this.humanPrice(f.order?.total, f.order?.currency_code),
						shipping_address: f.order?.shipping_address,
					},
				}
			}

			case "cart.abandoned":
			case "cart.abandoned.discount": {
				const cart = data.cart
				if (!cart) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Cart data missing")
				const params: Record<string, any> = {
					cart_id: cart.id,
					name: [cart.customer?.first_name, cart.customer?.last_name].filter(Boolean).join(" ") || "",
					items: Array.isArray(cart.items)
						? cart.items.map((item: any) => ({
							title: item.product_title,
							thumbnail: item.thumbnail,
							quantity: item.quantity,
							unit_price: this.humanPrice(item.unit_price, cart.currency_code),
							total: this.humanPrice(item.total, cart.currency_code),
						}))
						: [],
				}
				// Add discount code if present
				if (data.promotion_code) {
					params.promotion_code = data.promotion_code
					params.discount_value = data.discount_value
					params.discount_type = data.discount_type
					params.discount_expires_at = data.discount_expires_at
				}
				return params
			}

			case "review.request": {
				const order = data.order
				if (!order) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order data missing for review")
				return {
					customer_name: [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" "),
					display_id: order.display_id,
					items: Array.isArray(order.items)
						? order.items.map((item: any) => ({
							title: item.product_title,
							thumbnail: item.thumbnail,
						}))
						: [],
				}
			}

			case "promotion-expiry-reminder":
				return {
					first_name: data.first_name,
					last_name: data.last_name,
					promotion_code: data.promotion_code,
					expires_at: data.expires_at,
					days_left: data.days_left,
				}

			case "winback": {
				return {
					customer_name: data.customer_name || "",
					last_order_date: data.last_order_date || "",
					days_inactive: data.days_inactive || 0,
				}
			}

			default:
				throw new MedusaError(MedusaError.Types.INVALID_DATA, `Template "${template}" is not supported`)
		}
	}

	// ─── Core Send ───

	async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
		const { to, template, data } = notification

		if (!to) {
			throw new MedusaError(MedusaError.Types.INVALID_DATA, `Recipient missing for "${template}"`)
		}

		// Resolve template — catches "disabled" and "not configured" gracefully
		let templateId: number
		try {
			templateId = this.resolveTemplateId(template, data)
		} catch (error: any) {
			if (error?.type === MedusaError.Types.NOT_ALLOWED) {
				this.logger.info(`[Brevo] Skipped (disabled): ${template} to ${to}`)
				return { id: `skipped-${template}-${Date.now()}` }
			}
			if (error?.type === MedusaError.Types.NOT_FOUND) {
				this.logger.warn(`[Brevo] Skipped (no template): ${template} to ${to}`)
				return { id: `no-template-${template}-${Date.now()}` }
			}
			throw error
		}

		const params = this.buildParams(template, data)

		try {
			const result = await this.brevo.transactionalEmails.sendTransacEmail({
				sender: {
					email: this.options.from,
					name: (data as any)?._settings?.sender_name || this.options.senderName || undefined,
				},
				to: [{ email: to }],
				templateId,
				params,
				tags: [template],
			})

			this.logger.info(`[Brevo] Email sent to ${to} | template=${template} | id=${templateId}`)
			return { id: result.messageId || `${template}-${Date.now()}` }
		} catch (error: any) {
			const msg = error?.message || "Unknown error"
			this.logger.error(`[Brevo] Failed email to ${to} | template=${template} | error=${msg}`)
			throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Failed to send email: ${msg}`)
		}
	}

	// ─── Brevo Contact Sync ───

	async syncContact(data: {
		email: string
		firstName?: string
		lastName?: string
		phone?: string
		listIds?: number[]
		attributes?: Record<string, any>
	}): Promise<void> {
		try {
			await this.brevo.contacts.createContact({
				email: data.email,
				attributes: {
					FIRSTNAME: data.firstName || "",
					LASTNAME: data.lastName || "",
					PHONE: data.phone || "",
					...data.attributes,
				},
				listIds: data.listIds,
				updateEnabled: true,
			})
			this.logger.info(`[Brevo] Contact synced: ${data.email}`)
		} catch (error: any) {
			this.logger.warn(`[Brevo] Contact sync failed for ${data.email}: ${error?.message}`)
		}
	}

	// ─── Event Tracking ───

	async trackEvent(data: {
		email: string
		event: string
		eventdata?: Record<string, any>
	}): Promise<void> {
		try {
			await (this.brevo as any).event.trackEvent({
				email: data.email,
				event: data.event,
				eventdata: data.eventdata,
			})
			this.logger.info(`[Brevo] Event tracked: ${data.event} for ${data.email}`)
		} catch (error: any) {
			this.logger.warn(`[Brevo] Event tracking failed: ${data.event} - ${error?.message}`)
		}
	}

	// ─── SMS ───

	async sendSms(data: {
		to: string
		content: string
		sender?: string
	}): Promise<void> {
		try {
			await this.brevo.transactionalSms.sendTransacSms({
				sender: data.sender || this.options.senderName || "Medusa",
				recipient: data.to,
				content: data.content,
			} as any)
			this.logger.info(`[Brevo] SMS sent to ${data.to}`)
		} catch (error: any) {
			this.logger.warn(`[Brevo] SMS failed to ${data.to}: ${error?.message}`)
		}
	}

	// ─── WhatsApp ───

	async sendWhatsApp(data: {
		to: string
		templateName: string
		params?: Record<string, any>
	}): Promise<void> {
		try {
			await (this.brevo as any).transactionalWhatsApp.sendWhatsAppMessage({
				senderNumber: this.options.from,
				contactNumbers: [data.to],
				templateName: data.templateName,
				bodyVariables: data.params ? Object.values(data.params).map(String) : [],
			})
			this.logger.info(`[Brevo] WhatsApp sent to ${data.to} | template=${data.templateName}`)
		} catch (error: any) {
			this.logger.warn(`[Brevo] WhatsApp failed to ${data.to}: ${error?.message}`)
		}
	}

	async resend(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
		return this.send(notification)
	}
}

export default BrevoProviderService