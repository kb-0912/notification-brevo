import {
  createWorkflow,
  createStep,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"
import { resolveLocaleStep } from "./steps/resolve-locale"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

type WorkflowInput = {
  id: string
}

const loadSettingsStep = createStep(
  "load-settings-for-order-canceled",
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

export const sendOrderCanceledWorkflow = createWorkflow(
  "send-order-canceled",
  ({ id }: WorkflowInput) => {
    const settings = loadSettingsStep()

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id", "email", "display_id",
        "shipping_address.*", "billing_address.*",
        "customer.metadata",
      ],
      filters: { id },
    })

    const locale = resolveLocaleStep({
      customerMetadata: orders[0].customer?.metadata,
    })

    const notification = sendNotificationStep([
      {
        to: orders[0].email,
        channel: "email",
        template: "order.canceled",
        data: {
          order: orders[0],
          _settings: settings,
          _locale: locale,
        },
      },
    ])

    return new WorkflowResponse(notification)
  }
)