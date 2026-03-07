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
import { sendMultiChannelStep } from "./steps/send-multi-channel"
import { resolveLocaleStep } from "./steps/resolve-locale"
import { CreateNotificationDTO } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

type WorkflowInput = {
	id: string
}

const loadSettingsStep = createStep(
	"load-settings-for-order-confirmation",
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

export const sendOrderConfirmationWorkflow = createWorkflow(
	"send-order-confirmation",
	({ id }: WorkflowInput) => {
		const settings = loadSettingsStep()

		const { data: orders } = useQueryGraphStep({
			entity: "order",
			fields: [
				"*", "id", "created_at", "email", "currency_code", "display_id",
				"shipping_subtotal", "total", "items.*",
				"billing_address.*", "shipping_address.*",
				"payment_collections.*", "payment_collections.payments.*",
				"fulfillments.*", "shipping_methods.*",
				"customer.metadata",
			],
			filters: { id },
		})

		// Resolve customer preferred language
		const locale = resolveLocaleStep({
			customerMetadata: orders[0].customer?.metadata,
		})

		// Send email notification
		const notificationData: CreateNotificationDTO[] = [
			{
				to: orders[0].email,
				channel: "email",
				template: "order.placed",
				data: {
					order: orders[0],
					_settings: settings,
					_locale: locale,
				},
			},
		]
		const notification = sendNotificationStep(notificationData)

		// Sync contact to Brevo
		syncBrevoContactStep({
			email: orders[0].email,
			firstName: orders[0].shipping_address?.first_name,
			lastName: orders[0].shipping_address?.last_name,
			orderId: orders[0].id,
		})

		// Track order event
		trackBrevoEventStep({
			email: orders[0].email,
			event: "order_placed",
			eventdata: {
				order_id: orders[0].id,
				display_id: orders[0].display_id,
				total: orders[0].total,
				currency_code: orders[0].currency_code,
			},
		})

		// SMS / WhatsApp
		sendMultiChannelStep({
			email: orders[0].email,
			phone: orders[0].shipping_address?.phone,
			event: "order_placed",
			displayId: orders[0].display_id,
		})

		return new WorkflowResponse(notification)
	}
)