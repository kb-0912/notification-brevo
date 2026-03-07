import {
  createWorkflow,
  createStep,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"
import { resolveLocaleStep } from "./steps/resolve-locale"
import { CreateNotificationDTO } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

type WorkflowInput = {
  cartId: string
  promotion_code?: string
  discount_value?: number
  discount_type?: string
  discount_expires_at?: string
  _useDiscountTemplate?: boolean
}

const loadSettingsStep = createStep(
  "load-settings-for-abandoned-cart",
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

export const sendAbandonedCartWorkflow = createWorkflow(
  "send-abandoned-cart",
  (input: WorkflowInput) => {
    const settings = loadSettingsStep()

    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "email",
        "created_at",
        "metadata",
        "customer.first_name",
        "customer.last_name",
        "customer.phone",
        "customer.metadata",
        "currency_code",
        "items.*",
      ],
      filters: { id: input.cartId },
    })

    // Resolve locale from customer or cart metadata
    const locale = resolveLocaleStep({
      customerMetadata: carts[0].customer?.metadata,
      cartMetadata: carts[0].metadata,
    })

    const template = input._useDiscountTemplate ? "cart.abandoned.discount" : "cart.abandoned"

    const notificationData: CreateNotificationDTO[] = [
      {
        to: carts[0].email,
        channel: "email",
        template,
        data: {
          cart: carts[0],
          promotion_code: input.promotion_code,
          discount_value: input.discount_value,
          discount_type: input.discount_type,
          discount_expires_at: input.discount_expires_at,
          _settings: settings,
          _locale: locale,
        },
      },
    ]

    const notification = sendNotificationStep(notificationData)
    return new WorkflowResponse(notification)
  }
)