import { MedusaContainer } from "@medusajs/framework/types"
import { BREVO_SETTINGS_MODULE } from "../modules/brevo-settings"
import { sendReviewRequestWorkflow } from "../workflows/send-review-request"

const BATCH_SIZE = 50

/**
 * Scheduled job: Send review request emails for COMPLETED orders
 * (no returns/refunds) after the configured number of days.
 *
 * Guard: Uses metadata flag `review_request_sent` as primary dedup.
 * Window: Scans orders completed in the last 30 days (wide) to
 * catch any missed orders if the job was down. The metadata flag
 * prevents duplicate sends.
 */
export default async function reviewRequestJob(container: MedusaContainer) {
    const logger = container.resolve("logger")
    const query = container.resolve("query")

    let settings: any
    try {
        const svc: any = container.resolve(BREVO_SETTINGS_MODULE)
        settings = await svc.getSettings()
    } catch {
        return
    }

    if (!settings?.review_request_enabled) return

    const daysAfter = settings.review_request_days_after || 7
    // Wide window: target date to 30 days ago — flag prevents duplicates
    const targetDate = new Date(Date.now() - daysAfter * 24 * 60 * 60 * 1000)
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    let sent = 0
    let offset = 0

    try {
        while (true) {
            const { data: orders } = await query.graph({
                entity: "order",
                fields: [
                    "id", "email", "display_id", "created_at", "status", "metadata",
                    "shipping_address.first_name", "shipping_address.last_name",
                    "items.product_title", "items.thumbnail",
                    "returns.id",
                    "customer.metadata",
                ],
                filters: {
                    created_at: { $gte: windowStart.toISOString(), $lte: targetDate.toISOString() },
                    status: "completed",
                },
                pagination: {
                    skip: offset,
                    take: BATCH_SIZE,
                },
            })

            if (!orders.length) break

            for (const order of orders) {
                if (!order.email) continue

                // Skip orders that have been returned/refunded
                const returns = (order as any).returns || []
                if (returns.length > 0) continue

                // Primary guard: skip if already sent
                const meta = (order.metadata as Record<string, any>) || {}
                if (meta.review_request_sent) continue

                try {
                    await sendReviewRequestWorkflow(container).run({
                        input: {
                            email: order.email,
                            orderId: order.id,
                            displayId: String(order.display_id),
                            customerName: [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" "),
                            items: order.items || [],
                            locale: (order as any).customer?.metadata?.preferred_locale || null,
                        },
                    })

                    const orderService: any = container.resolve("order")
                    await orderService.updateOrders(order.id, {
                        metadata: { ...meta, review_request_sent: true },
                    })
                    sent++
                } catch (err: any) {
                    logger.error(`[Brevo] Review request failed for order ${order.id}: ${err.message}`)
                }
            }

            offset += BATCH_SIZE
            if (orders.length < BATCH_SIZE) break
        }

        if (sent > 0) {
            logger.info(`[Brevo] Sent ${sent} review request emails`)
        }
    } catch (err: any) {
        logger.error(`[Brevo] Review request job error: ${err.message}`)
    }
}

export const config = {
    name: "review-request",
    schedule: "0 10 * * *",
}
