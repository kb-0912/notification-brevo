import {
  createWorkflow,
  createStep,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"
import { sendMultiChannelStep } from "./steps/send-multi-channel"
import { resolveLocaleStep } from "./steps/resolve-locale"
import { CreateNotificationDTO } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

type WorkflowInput = {
  id: string
}

const loadSettingsStep = createStep(
  "load-settings-for-shipment-confirmation",
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

export const sendShipmentConfirmationWorkflow = createWorkflow(
  "send-shipment-confirmation",
  ({ id }: WorkflowInput) => {
    const settings = loadSettingsStep()

    const { data: fulfillments } = useQueryGraphStep({
      entity: "fulfillment",
      fields: [
        "*",
        "id",
        "tracking_numbers",
        "order.*",
        "order.email",
        "order.shipping_address.*",
        "order.billing_address.*",
        "order.items.*",
        "order.shipping_methods.*",
        "order.customer.metadata",
        "labels.*",
      ],
      filters: { id },
    })

    const locale = resolveLocaleStep({
      customerMetadata: fulfillments[0].order?.customer?.metadata,
    })

    const notificationData: CreateNotificationDTO[] = [
      {
        to: fulfillments[0].order.email,
        channel: "email",
        template: "shipment.confirmed",
        data: {
          fulfillment: fulfillments[0],
          _settings: settings,
          _locale: locale,
        },
      },
    ]

    const notification = sendNotificationStep(notificationData)

    // SMS / WhatsApp
    sendMultiChannelStep({
      email: fulfillments[0].order.email,
      phone: fulfillments[0].order.shipping_address?.phone,
      event: "shipment_created",
      displayId: fulfillments[0].order.display_id,
    })

    return new WorkflowResponse(notification)
  }
)