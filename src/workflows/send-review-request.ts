import {
    createWorkflow,
    createStep,
    WorkflowResponse,
    StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendNotificationStep } from "./steps/send-notification"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

const loadSettingsForReviewRequest = createStep(
    "load-settings-for-review-request",
    async (_, { container }) => {
        try {
            const svc: any = container.resolve(BREVO_SETTINGS_MODULE)
            return new StepResponse(await svc.getSettings())
        } catch {
            return new StepResponse({})
        }
    }
)

export const sendReviewRequestWorkflow = createWorkflow(
    "send-review-request",
    (input: {
        email: string
        orderId: string
        displayId: string
        customerName: string
        items: any[]
        locale?: string | null
    }) => {
        const settings = loadSettingsForReviewRequest()

        const notification = sendNotificationStep([
            {
                to: input.email,
                channel: "email",
                template: "review.request",
                data: {
                    order: {
                        id: input.orderId,
                        display_id: input.displayId,
                        shipping_address: { first_name: input.customerName },
                        items: input.items,
                    },
                    _settings: settings,
                    _locale: input.locale,
                },
            },
        ])

        return new WorkflowResponse(notification)
    }
)
