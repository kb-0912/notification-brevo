import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Table } from "@medusajs/ui"
import { ChartBar } from "@medusajs/icons"
import { useEffect, useState } from "react"

type EmailStats = {
    delivered: number
    opened: number
    clicked: number
    bounced: number
    blocked: number
    unsubscribed: number
    invalid: number
}

type AnalyticsData = {
    stats: EmailStats
    perEvent: Record<string, EmailStats>
    startDate: string
    endDate: string
    error?: string
}

const EVENT_LABELS: Record<string, string> = {
    "order.placed": "Order Placed",
    "order.canceled": "Order Canceled",
    "order.delivered": "Order Delivered",
    "customer.created": "Customer Created",
    "promotion-new-customer": "Promotion (New Customer)",
    "promotion-expiry-reminder": "Promotion Expiry Reminder",
    "shipment.confirmed": "Shipment Confirmed",
    "cart.abandoned": "Abandoned Cart",
    "cart.abandoned.discount": "Abandoned Cart (Discount)",
    "review.request": "Review Request",
    "winback": "Win-back",
}

const BrevoAnalyticsPage = () => {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch("/admin/brevo-plugin-settings/analytics", { credentials: "include" })
            .then((res) => res.json())
            .then((d) => {
                setData(d)
                setLoading(false)
            })
            .catch(() => {
                setError("Failed to load analytics. Make sure Brevo API key is configured.")
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Text>Loading analytics...</Text>
                </div>
            </Container>
        )
    }

    if (error || !data?.stats) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Text className="text-ui-fg-error">{error || data?.error || "No data available"}</Text>
                </div>
            </Container>
        )
    }

    const { stats, perEvent } = data

    const statItems = [
        { label: "Delivered", value: stats.delivered, color: "green" as const },
        { label: "Opened", value: stats.opened, color: "blue" as const },
        { label: "Clicked", value: stats.clicked, color: "purple" as const },
        { label: "Bounced", value: stats.bounced, color: "orange" as const },
        { label: "Blocked", value: stats.blocked, color: "red" as const },
        { label: "Unsubscribed", value: stats.unsubscribed, color: "grey" as const },
    ]

    const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0"
    const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0"

    const perEventEntries = Object.entries(perEvent || {}).sort((a, b) => b[1].delivered - a[1].delivered)

    return (
        <>
            <Container className="divide-y p-0">
                <div className="px-6 py-4">
                    <Heading level="h1">Email Analytics</Heading>
                    <Text className="text-ui-fg-subtle mt-1">
                        Transactional email performance from Brevo (last 30 days)
                    </Text>
                </div>
            </Container>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {statItems.map(({ label, value, color }) => (
                    <Container key={label} className="p-0">
                        <div className="px-6 py-4 text-center">
                            <Text className="text-ui-fg-subtle text-xs uppercase">{label}</Text>
                            <Heading level="h2" className="mt-1">{value.toLocaleString()}</Heading>
                            <Badge color={color} className="mt-2">{label}</Badge>
                        </div>
                    </Container>
                ))}
            </div>

            {/* Conversion Rates */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Conversion Rates</Heading>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Metric</Table.HeaderCell>
                                <Table.HeaderCell>Rate</Table.HeaderCell>
                                <Table.HeaderCell>Details</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            <Table.Row>
                                <Table.Cell><Text className="font-medium">Open Rate</Text></Table.Cell>
                                <Table.Cell><Badge color="blue">{openRate}%</Badge></Table.Cell>
                                <Table.Cell><Text className="text-ui-fg-subtle">{stats.opened} / {stats.delivered} delivered</Text></Table.Cell>
                            </Table.Row>
                            <Table.Row>
                                <Table.Cell><Text className="font-medium">Click Rate</Text></Table.Cell>
                                <Table.Cell><Badge color="purple">{clickRate}%</Badge></Table.Cell>
                                <Table.Cell><Text className="text-ui-fg-subtle">{stats.clicked} / {stats.opened} opened</Text></Table.Cell>
                            </Table.Row>
                            <Table.Row>
                                <Table.Cell><Text className="font-medium">Bounce Rate</Text></Table.Cell>
                                <Table.Cell><Badge color="orange">{stats.delivered > 0 ? ((stats.bounced / (stats.delivered + stats.bounced)) * 100).toFixed(1) : "0"}%</Badge></Table.Cell>
                                <Table.Cell><Text className="text-ui-fg-subtle">{stats.bounced} bounced</Text></Table.Cell>
                            </Table.Row>
                        </Table.Body>
                    </Table>
                </div>
            </Container>

            {/* Per-Event Breakdown */}
            {perEventEntries.length > 0 && (
                <Container className="divide-y p-0 mt-4">
                    <div className="px-6 py-4">
                        <Heading level="h2" className="mb-2">Per-Event Breakdown</Heading>
                        <Text className="text-ui-fg-subtle mb-4">Performance by email event type (only events with activity shown)</Text>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>Event</Table.HeaderCell>
                                    <Table.HeaderCell>Sent</Table.HeaderCell>
                                    <Table.HeaderCell>Opened</Table.HeaderCell>
                                    <Table.HeaderCell>Clicked</Table.HeaderCell>
                                    <Table.HeaderCell>Open Rate</Table.HeaderCell>
                                    <Table.HeaderCell>Bounced</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {perEventEntries.map(([event, eventStats]) => {
                                    const evOpenRate = eventStats.delivered > 0
                                        ? ((eventStats.opened / eventStats.delivered) * 100).toFixed(1)
                                        : "0"
                                    return (
                                        <Table.Row key={event}>
                                            <Table.Cell>
                                                <Text className="font-medium">{EVENT_LABELS[event] || event}</Text>
                                            </Table.Cell>
                                            <Table.Cell>{eventStats.delivered.toLocaleString()}</Table.Cell>
                                            <Table.Cell>{eventStats.opened.toLocaleString()}</Table.Cell>
                                            <Table.Cell>{eventStats.clicked.toLocaleString()}</Table.Cell>
                                            <Table.Cell><Badge color="blue">{evOpenRate}%</Badge></Table.Cell>
                                            <Table.Cell>{eventStats.bounced > 0 ? eventStats.bounced.toLocaleString() : "—"}</Table.Cell>
                                        </Table.Row>
                                    )
                                })}
                            </Table.Body>
                        </Table>
                    </div>
                </Container>
            )}

            {perEventEntries.length === 0 && (
                <Container className="divide-y p-0 mt-4">
                    <div className="px-6 py-4">
                        <Heading level="h2" className="mb-2">Per-Event Breakdown</Heading>
                        <Text className="text-ui-fg-subtle">
                            No per-event data yet. Emails sent after this update will be tagged automatically and stats will appear here.
                        </Text>
                    </div>
                </Container>
            )}
        </>
    )
}

export const config = defineRouteConfig({
    label: "Email Analytics",
    icon: ChartBar,
})

export default BrevoAnalyticsPage
