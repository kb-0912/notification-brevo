import {
    createWorkflow,
    createStep,
    WorkflowResponse,
    StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendNotificationStep } from "./steps/send-notification"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"

const loadSettingsForWinback = createStep(
    "load-settings-for-winback",
    async (_, { container }) => {
        try {
            const svc: any = container.resolve(BREVO_SETTINGS_MODULE)
            return new StepResponse(await svc.getSettings())
        } catch {
            return new StepResponse({})
        }
    }
)

export const sendWinbackWorkflow = createWorkflow(
    "send-winback",
    (input: {
        email: string
        customerName: string
        lastOrderDate: string
        daysInactive: number
        locale?: string | null
    }) => {
        const settings = loadSettingsForWinback()

        const notification = sendNotificationStep([
            {
                to: input.email,
                channel: "email",
                template: "winback",
                data: {
                    customer_name: input.customerName,
                    last_order_date: input.lastOrderDate,
                    days_inactive: input.daysInactive,
                    _settings: settings,
                    _locale: input.locale,
                },
            },
        ])

        return new WorkflowResponse(notification)
    }
)
