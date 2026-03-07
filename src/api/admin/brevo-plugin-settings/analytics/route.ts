import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const BREVO_API = "https://api.brevo.com/v3"

// All event types that can be tagged
const EVENT_TAGS = [
    "order.placed",
    "order.canceled",
    "order.delivered",
    "customer.created",
    "promotion-new-customer",
    "promotion-expiry-reminder",
    "shipment.confirmed",
    "cart.abandoned",
    "cart.abandoned.discount",
    "review.request",
    "winback",
]

async function fetchBrevoStats(apiKey: string, startDate: string, endDate: string, tag?: string) {
    const params = new URLSearchParams({ startDate, endDate })
    if (tag) params.set("tag", tag)

    const res = await fetch(`${BREVO_API}/smtp/statistics/aggregatedReport?${params}`, {
        headers: { "api-key": apiKey, "Accept": "application/json" },
    })

    if (!res.ok) return null
    return res.json() as Promise<any>
}

/**
 * Analytics API — returns overall + per-event email statistics from Brevo.
 */
export async function GET(
    req: MedusaRequest,
    res: MedusaResponse
) {
    const logger = req.scope.resolve("logger")

    try {
        const apiKey = process.env.BREVO_API_KEY
        if (!apiKey) {
            return res.status(400).json({ error: "BREVO_API_KEY not configured" })
        }

        const endDate = new Date().toISOString().split("T")[0]
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

        // Fetch overall stats
        const overall = await fetchBrevoStats(apiKey, startDate, endDate)

        const parseStats = (data: any) => ({
            delivered: data?.requests || 0,
            opened: data?.uniqueOpens || data?.opens || 0,
            clicked: data?.uniqueClicks || data?.clicks || 0,
            bounced: (data?.hardBounces || 0) + (data?.softBounces || 0),
            blocked: data?.blocked || 0,
            unsubscribed: data?.unsubscribed || 0,
            invalid: data?.invalid || 0,
        })

        const stats = overall ? parseStats(overall) : {
            delivered: 0, opened: 0, clicked: 0, bounced: 0, blocked: 0, unsubscribed: 0, invalid: 0,
        }

        // Fetch per-event stats in parallel
        const perEventResults = await Promise.allSettled(
            EVENT_TAGS.map(async (tag) => {
                const data = await fetchBrevoStats(apiKey, startDate, endDate, tag)
                return { tag, stats: data ? parseStats(data) : null }
            })
        )

        const perEvent: Record<string, any> = {}
        for (const result of perEventResults) {
            if (result.status === "fulfilled" && result.value.stats) {
                const { tag, stats: tagStats } = result.value
                // Only include events that have activity
                if (tagStats.delivered > 0 || tagStats.opened > 0) {
                    perEvent[tag] = tagStats
                }
            }
        }

        res.json({ stats, perEvent, startDate, endDate })
    } catch (error: any) {
        logger.error(`[Brevo] Analytics error: ${error.message}`)
        res.status(500).json({ error: "Failed to fetch analytics" })
    }
}
