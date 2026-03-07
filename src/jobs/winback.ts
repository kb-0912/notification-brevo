import { MedusaContainer } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"
import { sendWinbackWorkflow } from "../workflows/send-winback"

const BATCH_SIZE = 100

/**
 * Scheduled job: Find customers whose LAST COMPLETED order was X+ days ago
 * and send a win-back email. Uses pagination to avoid fetching all customers
 * at once. Tracks `winback_sent_at` in customer metadata to prevent duplicates.
 */
export default async function winbackJob(container: MedusaContainer) {
    const logger = container.resolve("logger")
    const query = container.resolve("query")

    let settings: any
    try {
        const svc: any = container.resolve(BREVO_SETTINGS_MODULE)
        settings = await svc.getSettings()
    } catch {
        return
    }

    if (!settings?.winback_enabled) return

    const daysInactive = settings.winback_days_inactive || 30
    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000)

    let sent = 0
    let offset = 0

    try {
        while (true) {
            const { data: customers } = await query.graph({
                entity: "customer",
                fields: [
                    "id", "email", "first_name", "last_name", "metadata",
                    "orders.created_at", "orders.status",
                ],
                filters: {
                    has_account: true,
                },
                pagination: {
                    skip: offset,
                    take: BATCH_SIZE,
                },
            })

            if (!customers.length) break

            for (const customer of customers) {
                if (!customer.email) continue
                const meta = (customer.metadata as Record<string, any>) || {}

                // Skip if win-back already sent recently
                if (meta.winback_sent_at) {
                    const lastSent = new Date(meta.winback_sent_at)
                    const daysSinceSent = (Date.now() - lastSent.getTime()) / (24 * 60 * 60 * 1000)
                    if (daysSinceSent < daysInactive) continue
                }

                // Only count COMPLETED orders (ignore canceled, pending, etc.)
                const allOrders = (customer as any).orders || []
                const completedOrders = allOrders.filter(
                    (o: any) => o.status === "completed"
                )

                // Skip customers with no completed orders
                if (!completedOrders.length) continue

                // Find the date of the most recent completed order
                const lastCompletedDate = completedOrders
                    .map((o: any) => new Date(o.created_at).getTime())
                    .reduce((max: number, t: number) => Math.max(max, t), 0)

                // Skip if customer has a recent completed order (still active)
                if (lastCompletedDate > cutoffDate.getTime()) continue

                try {
                    await sendWinbackWorkflow(container).run({
                        input: {
                            email: customer.email,
                            customerName: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
                            lastOrderDate: new Date(lastCompletedDate).toLocaleDateString(),
                            daysInactive,
                            locale: meta?.preferred_locale || null,
                        },
                    })

                    const customerService: any = container.resolve("customer")
                    await customerService.updateCustomers(customer.id, {
                        metadata: { ...meta, winback_sent_at: new Date().toISOString() },
                    })
                    sent++
                } catch (err: any) {
                    logger.error(`[Brevo] Win-back failed for ${customer.email}: ${err.message}`)
                }
            }

            offset += BATCH_SIZE
            if (customers.length < BATCH_SIZE) break
        }

        if (sent > 0) {
            logger.info(`[Brevo] Sent ${sent} win-back emails`)
        }
    } catch (err: any) {
        logger.error(`[Brevo] Win-back job error: ${err.message}`)
    }
}

export const config = {
    name: "winback-campaign",
    schedule: "0 11 * * *",
}
