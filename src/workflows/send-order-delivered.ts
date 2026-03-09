import { createWorkflow, WorkflowResponse, createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"
import { resolveLocaleStep } from "./steps/resolve-locale"
import { CreateNotificationDTO } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

type WorkflowInput = {
    id: string
}

const loadSettingsStep = createStep(
    "load-settings-for-delivered",
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

export const sendOrderDeliveredWorkflow = createWorkflow(
    "send-order-delivered",
    ({ id }: WorkflowInput) => {
        const settings = loadSettingsStep()

        const { data: fulfillments } = useQueryGraphStep({
            entity: "fulfillment",
            fields: [
                "*",
                "order.*",
                "order.email",
                "order.shipping_address.*",
                "order.items.*",
                "order.customer.metadata", "order.customer.phone",
                "labels.*",
            ],
            filters: { id },
        })

        const locale = resolveLocaleStep({
            customerMetadata: fulfillments[0].order?.customer?.metadata,
            phone: fulfillments[0].order?.customer?.phone || fulfillments[0].order?.shipping_address?.phone,
            countryCode: fulfillments[0].order?.shipping_address?.country_code,
        })

        const notificationData: CreateNotificationDTO[] = [
            {
                to: fulfillments[0].order.email,
                channel: "email",
                template: "order.delivered",
                data: {
                    fulfillment: fulfillments[0],
                    _settings: settings,
                    _locale: locale,
                },
            },
        ]

        const notification = sendNotificationStep(notificationData)
        return new WorkflowResponse(notification)
    }
)
