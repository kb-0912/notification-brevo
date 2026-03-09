import {
  createWorkflow,
  createStep,
  WorkflowResponse,
  StepResponse,
  transform,
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
      phone: carts[0].customer?.phone,
    })

    // IMPORTANT: Use transform() to resolve proxy values before conditionals.
    // input._useDiscountTemplate is a Medusa workflow proxy — always truthy in JS.
    // transform() resolves the actual runtime value so we can branch correctly.
    const notificationData = transform(
      { input, cart: carts[0], settings, locale },
      (data) => {
        const template = data.input._useDiscountTemplate
          ? "cart.abandoned.discount"
          : "cart.abandoned"

        return [{
          to: data.cart.email,
          channel: "email",
          template,
          data: {
            cart: data.cart,
            promotion_code: data.input.promotion_code,
            discount_value: data.input.discount_value,
            discount_type: data.input.discount_type,
            discount_expires_at: data.input.discount_expires_at,
            _settings: data.settings,
            _locale: data.locale,
          },
        }] as CreateNotificationDTO[]
      }
    )

    const notification = sendNotificationStep(notificationData)
    return new WorkflowResponse(notification)
  }
)