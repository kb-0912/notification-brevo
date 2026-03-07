import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Label, Input, Switch, Button, Badge, Select, Toaster, toast, Drawer, Checkbox } from "@medusajs/ui"
import { EnvelopeSolid } from "@medusajs/icons"
import { useEffect, useState } from "react"

type BrevoSettings = Record<string, any>
type SelectOption = { value: string; label: string }

const BrevoSettingsPage = () => {
    const [settings, setSettings] = useState<BrevoSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [intervalsText, setIntervalsText] = useState("")
    const [currencies, setCurrencies] = useState<SelectOption[]>([])
    const [countries, setCountries] = useState<SelectOption[]>([])
    const [modal, setModal] = useState<{ key: string; title: string; options: SelectOption[] } | null>(null)
    const [drawerSearch, setDrawerSearch] = useState("")

    useEffect(() => {
        Promise.all([
            fetch("/admin/brevo-plugin-settings", { credentials: "include" }).then(r => r.json()),
            fetch("/admin/currencies", { credentials: "include" }).then(r => r.json()).catch(() => ({ currencies: [] })),
            fetch("/admin/regions", { credentials: "include" }).then(r => r.json()).catch(() => ({ regions: [] })),
        ]).then(([settingsData, currData, regionData]) => {
            setSettings(settingsData.settings)
            const intervals = Array.isArray(settingsData.settings.abandoned_cart_intervals)
                ? settingsData.settings.abandoned_cart_intervals
                : []
            setIntervalsText(intervals.join(", "))
            const currOpts = (currData.currencies || []).map((c: any) => ({
                value: c.code, label: `${c.name || c.code.toUpperCase()} (${c.code.toUpperCase()})`,
            })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
            setCurrencies(currOpts)

            // Extract unique countries from all regions
            const countryMap = new Map<string, string>()
            for (const region of (regionData.regions || [])) {
                for (const c of (region.countries || [])) {
                    if (c.iso_2 && !countryMap.has(c.iso_2)) {
                        countryMap.set(c.iso_2, c.display_name || c.name || c.iso_2.toUpperCase())
                    }
                }
            }
            const countryOpts = Array.from(countryMap.entries()).map(([code, name]) => ({
                value: code, label: name,
            })).sort((a, b) => a.label.localeCompare(b.label))
            setCountries(countryOpts)

            setLoading(false)
        }).catch(() => {
            toast.error("Failed to load Brevo settings")
            setLoading(false)
        })
    }, [])

    const handleSave = async () => {
        if (!settings) return
        setSaving(true)

        const intervals = intervalsText
            .split(",")
            .map((s: string) => parseInt(s.trim(), 10))
            .filter((n: number) => !isNaN(n) && n > 0)

        try {
            const res = await fetch("/admin/brevo-plugin-settings", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...settings,
                    abandoned_cart_intervals: intervals,
                }),
            })
            if (!res.ok) throw new Error("Save failed")
            // Re-fetch to get properly serialized JSON fields
            const getRes = await fetch("/admin/brevo-plugin-settings", { credentials: "include" })
            const data = await getRes.json()
            setSettings(data.settings)
            const newIntervals = Array.isArray(data.settings.abandoned_cart_intervals)
                ? data.settings.abandoned_cart_intervals
                : []
            setIntervalsText(newIntervals.join(", "))
            toast.success("Settings saved successfully")
        } catch {
            toast.error("Failed to save settings")
        } finally {
            setSaving(false)
        }
    }

    const update = (key: string, value: any) => {
        setSettings((prev: BrevoSettings | null) => (prev ? { ...prev, [key]: value } : prev))
    }

    if (loading) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4"><Text>Loading Brevo settings...</Text></div>
            </Container>
        )
    }

    if (!settings) {
        return (
            <Container className="divide-y p-0">
                <div className="px-6 py-4"><Text className="text-ui-fg-error">Failed to load settings.</Text></div>
            </Container>
        )
    }

    return (
        <>
            <Toaster />
            {/* Header */}
            <Container className="divide-y p-0">
                <div className="flex items-center justify-between px-6 py-4">
                    <div>
                        <Heading level="h1">Brevo Email Settings</Heading>
                        <Text className="text-ui-fg-subtle mt-1">Configure all email, SMS, WhatsApp, and automation settings.</Text>
                    </div>
                    <Button onClick={handleSave} isLoading={saving}>Save Changes</Button>
                </div>
            </Container>

            {/* Sender */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Sender</Heading>
                    <div className="grid grid-cols-1 gap-4 max-w-md">
                        <div>
                            <Label htmlFor="sender_name">Sender Name</Label>
                            <Input id="sender_name" placeholder="My Store" value={settings.sender_name || ""}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("sender_name", e.target.value)} />
                            <Text className="text-ui-fg-subtle text-xs mt-1">Display name in "From" field. Email is set via BREVO_FROM_EMAIL.</Text>
                        </div>
                    </div>
                </div>
            </Container>

            {/* Email Templates */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Email Templates</Heading>
                    <Text className="text-ui-fg-subtle mb-4">Brevo template ID for each event. Toggle to enable/disable.</Text>
                    <div className="space-y-4">
                        {([
                            { key: "order_placed", label: "Order Placed" },
                            { key: "order_canceled", label: "Order Canceled" },
                            { key: "order_delivered", label: "Order Delivered" },
                            { key: "customer_created", label: "Customer Created" },
                            { key: "shipment_confirmed", label: "Shipment Confirmed" },
                        ] as const).map(({ key, label, ...rest }) => {
                            const enabledField = ("enabledKey" in rest ? (rest as any).enabledKey : `${key}_enabled`) as string
                            return (
                                <div key={key} className="flex items-center gap-4 p-3 border rounded-lg">
                                    <Switch checked={settings[enabledField] as boolean}
                                        onCheckedChange={(v: boolean) => update(enabledField, v)} />
                                    <div className="flex-1"><Label>{label}</Label></div>
                                    <Input className="w-32" placeholder="Template ID"
                                        value={settings[`${key}_template_id`] as string || ""}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(`${key}_template_id`, e.target.value)} />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </Container>

            {/* Promotion New Customer Config */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Promotion — New Customer</Heading>
                    <Text className="text-ui-fg-subtle mb-4">Auto-create a discount code when a new customer registers and send it via email.</Text>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.promotion_auto_create}
                            onCheckedChange={(v: boolean) => {
                                update("promotion_auto_create", v)
                                update("promotion_enabled", v)
                            }} />
                        <div className="flex-1"><Label>Auto-create Discount for New Customers</Label></div>
                    </div>
                    {settings.promotion_auto_create && (
                        <div className="grid grid-cols-2 gap-4 max-w-lg ml-4 mt-2">
                            <div className="col-span-2">
                                <Label>Promotion Email Template ID</Label>
                                <Input placeholder="Brevo template ID" value={settings.promotion_new_customer_template_id || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("promotion_new_customer_template_id", e.target.value)} />
                            </div>
                            <div>
                                <Label>Code Prefix</Label>
                                <Input placeholder="WELCOME" value={settings.promotion_code_prefix || "WELCOME"}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("promotion_code_prefix", e.target.value.toUpperCase())} />
                                <Text className="text-ui-fg-subtle text-xs mt-1">Code format: PREFIX-8CHARS (e.g. WELCOME-A3KF8X2N)</Text>
                            </div>
                            <div>
                                <Label>Discount Type</Label>
                                <Select value={settings.promotion_discount_type || "percentage"}
                                    onValueChange={(v: string) => {
                                        if (v !== (settings.promotion_discount_type || "percentage")) update("promotion_discount_type", v)
                                    }}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="Select type" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Item value="percentage">Percentage (%)</Select.Item>
                                        <Select.Item value="fixed">Fixed Amount</Select.Item>
                                    </Select.Content>
                                </Select>
                            </div>
                            <div>
                                <Label>Discount Value</Label>
                                <Input type="number" min={1} value={settings.promotion_discount_value || 10}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("promotion_discount_value", parseInt(e.target.value, 10) || 10)} />
                            </div>
                            <div>
                                <Label>Expires After (days)</Label>
                                <Input type="number" min={1} max={365} value={settings.promotion_expiry_days || 30}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("promotion_expiry_days", parseInt(e.target.value, 10) || 30)} />
                                <Text className="text-ui-fg-subtle text-xs mt-1">Discount code valid for X days after creation.</Text>
                            </div>
                            <div className="col-span-2">
                                <Label>Excluded Currencies</Label>
                                <Text className="text-ui-fg-subtle text-xs mb-2">Discount will NOT apply to orders in these currencies.</Text>
                                <div className="flex items-center gap-2 mt-1">
                                    <Button variant="secondary" size="small" onClick={() => setModal({ key: "promotion_excluded_currencies", title: "Select Excluded Currencies", options: currencies })}>
                                        Select Currencies
                                    </Button>
                                    <div className="flex flex-wrap gap-1">
                                        {((settings.promotion_excluded_currencies || []) as string[]).map((c: string) => (
                                            <Badge key={c} color="red" className="font-mono text-xs">{c.toUpperCase()}</Badge>
                                        ))}
                                        {(settings.promotion_excluded_currencies || []).length === 0 && <Text className="text-ui-fg-subtle text-xs">None</Text>}
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <Label>Excluded Countries</Label>
                                <Text className="text-ui-fg-subtle text-xs mb-2">Customers from these countries will NOT receive a promotion code.</Text>
                                <div className="flex items-center gap-2 mt-1">
                                    <Button variant="secondary" size="small" onClick={() => setModal({ key: "promotion_excluded_countries", title: "Select Excluded Countries", options: countries })}>
                                        Select Countries
                                    </Button>
                                    <div className="flex flex-wrap gap-1">
                                        {((settings.promotion_excluded_countries || []) as string[]).map((c: string) => (
                                            <Badge key={c} color="red" className="font-mono text-xs">{c.toUpperCase()}</Badge>
                                        ))}
                                        {(settings.promotion_excluded_countries || []).length === 0 && <Text className="text-ui-fg-subtle text-xs">None</Text>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Container>

            {/* Discount Expiry Reminder */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Discount Expiry Reminder</Heading>
                    <Text className="text-ui-fg-subtle mb-4">Send a reminder email when a customer's discount code is about to expire.</Text>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.promotion_expiry_reminder_enabled}
                            onCheckedChange={(v: boolean) => update("promotion_expiry_reminder_enabled", v)} />
                        <div className="flex-1"><Label>Enable Expiry Reminder</Label></div>
                        <Input className="w-32" placeholder="Template ID" value={settings.promotion_expiry_reminder_template_id || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("promotion_expiry_reminder_template_id", e.target.value)} />
                    </div>
                    {settings.promotion_expiry_reminder_enabled && (
                        <div className="max-w-md ml-4">
                            <Label>Days Before Expiry</Label>
                            <Input type="number" min={1} max={30} value={settings.promotion_expiry_reminder_days_before || 3}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("promotion_expiry_reminder_days_before", parseInt(e.target.value, 10) || 3)} />
                            <Text className="text-ui-fg-subtle text-xs mt-1">Send reminder X days before discount expires.</Text>
                        </div>
                    )}
                </div>
            </Container>
            {/* Abandoned Cart */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Abandoned Cart</Heading>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.abandoned_cart_enabled}
                            onCheckedChange={(v: boolean) => update("abandoned_cart_enabled", v)} />
                        <div className="flex-1"><Label>Enable Abandoned Cart Emails</Label></div>
                        <Input className="w-32" placeholder="Template ID" value={settings.abandoned_cart_template_id || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_template_id", e.target.value)} />
                    </div>
                    {settings.abandoned_cart_enabled && (
                        <div className="grid grid-cols-1 gap-4 max-w-md ml-4 mt-2">
                            <div>
                                <Label>Reminder Intervals (hours)</Label>
                                <Input placeholder="1, 24, 72" value={intervalsText}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntervalsText(e.target.value)} />
                                <Text className="text-ui-fg-subtle text-xs mt-1">Comma-separated. E.g. "1, 24, 72"</Text>
                            </div>
                            <div>
                                <Label>Max Emails Per Cart</Label>
                                <Input type="number" min={1} max={10} value={settings.abandoned_cart_max_emails}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_max_emails", parseInt(e.target.value, 10) || 1)} />
                            </div>
                        </div>
                    )}

                    {/* Discount Code Sub-section */}
                    {settings.abandoned_cart_enabled && (
                        <div className="mt-6 pt-4 border-t">
                            <Text className="text-ui-fg-subtle mb-4 text-sm">Auto-generate a discount code on the final reminder email.</Text>
                            <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                                <Switch checked={settings.abandoned_cart_discount_enabled}
                                    onCheckedChange={(v: boolean) => update("abandoned_cart_discount_enabled", v)} />
                                <div className="flex-1"><Label>Enable Discount on Final Email</Label></div>
                            </div>
                            {settings.abandoned_cart_discount_enabled && (
                                <div className="grid grid-cols-2 gap-4 max-w-lg ml-4 mt-2">
                                    <div>
                                        <Label>Discount Type</Label>
                                        <Select value={settings.abandoned_cart_discount_type || "percentage"}
                                            onValueChange={(v: string) => {
                                                if (v !== (settings.abandoned_cart_discount_type || "percentage")) update("abandoned_cart_discount_type", v)
                                            }}>
                                            <Select.Trigger>
                                                <Select.Value placeholder="Select type" />
                                            </Select.Trigger>
                                            <Select.Content>
                                                <Select.Item value="percentage">Percentage (%)</Select.Item>
                                                <Select.Item value="fixed">Fixed Amount</Select.Item>
                                            </Select.Content>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Discount Value</Label>
                                        <Input type="number" min={1} value={settings.abandoned_cart_discount_value || 10}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_discount_value", parseInt(e.target.value, 10) || 10)} />
                                    </div>
                                    <div>
                                        <Label>Max Uses Per Code</Label>
                                        <Input type="number" min={1} value={settings.abandoned_cart_discount_max_uses || 1}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_discount_max_uses", parseInt(e.target.value, 10) || 1)} />
                                    </div>
                                    <div>
                                        <Label>Expires After (hours)</Label>
                                        <Input type="number" min={1} value={settings.abandoned_cart_discount_expires_hours || 48}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_discount_expires_hours", parseInt(e.target.value, 10) || 48)} />
                                    </div>
                                    <div>
                                        <Label>Code Prefix</Label>
                                        <Input placeholder="COMEBACK" value={settings.abandoned_cart_discount_code_prefix || "COMEBACK"}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_discount_code_prefix", e.target.value.toUpperCase())} />
                                        <Text className="text-ui-fg-subtle text-xs mt-1">Code format: PREFIX-8CHARS (e.g. COMEBACK-B7TK9W3P)</Text>
                                    </div>
                                    <div className="col-span-2">
                                        <Label>Discount Email Template ID (optional)</Label>
                                        <Input placeholder="Leave blank to use abandoned cart template" value={settings.abandoned_cart_discount_template_id || ""}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("abandoned_cart_discount_template_id", e.target.value)} />
                                        <Text className="text-ui-fg-subtle text-xs mt-1">Separate template for the discount email. Falls back to abandoned cart template.</Text>
                                    </div>
                                    <div className="col-span-2">
                                        <Label>Excluded Currencies</Label>
                                        <Text className="text-ui-fg-subtle text-xs mb-2">Discount will NOT apply to orders in these currencies.</Text>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Button variant="secondary" size="small" onClick={() => setModal({ key: "abandoned_cart_discount_excluded_currencies", title: "Select Excluded Currencies", options: currencies })}>
                                                Select Currencies
                                            </Button>
                                            <div className="flex flex-wrap gap-1">
                                                {((settings.abandoned_cart_discount_excluded_currencies || []) as string[]).map((c: string) => (
                                                    <Badge key={c} color="red" className="font-mono text-xs">{c.toUpperCase()}</Badge>
                                                ))}
                                                {(settings.abandoned_cart_discount_excluded_currencies || []).length === 0 && <Text className="text-ui-fg-subtle text-xs">None</Text>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <Label>Excluded Countries</Label>
                                        <Text className="text-ui-fg-subtle text-xs mb-2">Customers from these countries will NOT receive a discount code.</Text>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Button variant="secondary" size="small" onClick={() => setModal({ key: "abandoned_cart_discount_excluded_countries", title: "Select Excluded Countries", options: countries })}>
                                                Select Countries
                                            </Button>
                                            <div className="flex flex-wrap gap-1">
                                                {((settings.abandoned_cart_discount_excluded_countries || []) as string[]).map((c: string) => (
                                                    <Badge key={c} color="red" className="font-mono text-xs">{c.toUpperCase()}</Badge>
                                                ))}
                                                {(settings.abandoned_cart_discount_excluded_countries || []).length === 0 && <Text className="text-ui-fg-subtle text-xs">None</Text>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Container>

            {/* Contact Sync */}
            <Container className="divide-y p-0 mt-4">
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Brevo Contact Sync</Heading>
                    <Text className="text-ui-fg-subtle mb-4">Sync customers to Brevo Contacts when they register or place an order.</Text>
                    <div className="flex items-center gap-4 p-3 border rounded-lg">
                        <Switch checked={settings.contact_sync_enabled}
                            onCheckedChange={(v: boolean) => update("contact_sync_enabled", v)} />
                        <div className="flex-1"><Label>Enable Contact Sync</Label></div>
                        <Input className="w-40" placeholder="Brevo List ID (opt)" type="number"
                            value={settings.contact_sync_list_id || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("contact_sync_list_id", parseInt(e.target.value, 10) || null)} />
                    </div>
                </div>
            </Container >

            {/* Event Tracking */}
            < Container className="divide-y p-0 mt-4" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Event Tracking</Heading>
                    <Text className="text-ui-fg-subtle mb-4">Send events to Brevo for automation triggers (order_placed, customer_created, etc.)</Text>
                    <div className="flex items-center gap-4 p-3 border rounded-lg">
                        <Switch checked={settings.event_tracking_enabled}
                            onCheckedChange={(v: boolean) => update("event_tracking_enabled", v)} />
                        <div className="flex-1"><Label>Enable Event Tracking</Label></div>
                    </div>
                </div>
            </Container >

            {/* Review Request */}
            < Container className="divide-y p-0 mt-4" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Review Request</Heading>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.review_request_enabled}
                            onCheckedChange={(v: boolean) => update("review_request_enabled", v)} />
                        <div className="flex-1"><Label>Send Review Request Email</Label></div>
                        <Input className="w-32" placeholder="Template ID" value={settings.review_request_template_id || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("review_request_template_id", e.target.value)} />
                    </div>
                    {settings.review_request_enabled && (
                        <div className="max-w-md ml-4">
                            <Label>Days After Order</Label>
                            <Input type="number" min={1} max={60} value={settings.review_request_days_after || 7}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("review_request_days_after", parseInt(e.target.value, 10) || 7)} />
                            <Text className="text-ui-fg-subtle text-xs mt-1">Send review request X days after order placed.</Text>
                        </div>
                    )}
                </div>
            </Container >

            {/* Win-back */}
            < Container className="divide-y p-0 mt-4" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Win-back Campaign</Heading>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.winback_enabled}
                            onCheckedChange={(v: boolean) => update("winback_enabled", v)} />
                        <div className="flex-1"><Label>Enable Win-back Emails</Label></div>
                        <Input className="w-32" placeholder="Template ID" value={settings.winback_template_id || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("winback_template_id", e.target.value)} />
                    </div>
                    {settings.winback_enabled && (
                        <div className="max-w-md ml-4">
                            <Label>Days Inactive</Label>
                            <Input type="number" min={7} max={365} value={settings.winback_days_inactive || 30}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("winback_days_inactive", parseInt(e.target.value, 10) || 30)} />
                            <Text className="text-ui-fg-subtle text-xs mt-1">Send win-back email to customers inactive for X days.</Text>
                        </div>
                    )}
                </div>
            </Container >

            {/* Multi-language */}
            < Container className="divide-y p-0 mt-4" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Multi-language Templates</Heading>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.multilang_enabled}
                            onCheckedChange={(v: boolean) => update("multilang_enabled", v)} />
                        <div className="flex-1"><Label>Enable Multi-language</Label></div>
                    </div>
                    {settings.multilang_enabled && (() => {
                        const EVENT_OPTIONS = [
                            { value: "order.placed", label: "Order Placed" },
                            { value: "order.canceled", label: "Order Canceled" },
                            { value: "order.delivered", label: "Order Delivered" },
                            { value: "customer.created", label: "Customer Created" },
                            { value: "promotion-new-customer", label: "Welcome Discount" },
                            { value: "shipment.confirmed", label: "Shipment Confirmed" },
                            { value: "cart.abandoned", label: "Cart Abandoned" },
                            { value: "cart.abandoned.discount", label: "Cart Abandoned (Discount)" },
                            { value: "review.request", label: "Review Request" },
                            { value: "winback", label: "Win-back" },
                            { value: "promotion-expiry-reminder", label: "Promotion Expiry Reminder" },
                        ]

                        // Parse multilang_templates object into flat rows for UI
                        const templates: Record<string, Record<string, string>> = settings.multilang_templates || {}
                        const locales = Object.keys(templates)

                        const addLocale = (code: string) => {
                            const key = code.trim().toLowerCase()
                            if (!key || templates[key]) return
                            update("multilang_templates", { ...templates, [key]: {} })
                        }

                        const removeLocale = (locale: string) => {
                            const next = { ...templates }
                            delete next[locale]
                            update("multilang_templates", next)
                        }

                        const setTemplate = (locale: string, event: string, value: string) => {
                            const localeMap = { ...(templates[locale] || {}) }
                            if (value.trim() === "") {
                                delete localeMap[event]
                            } else {
                                localeMap[event] = value
                            }
                            update("multilang_templates", { ...templates, [locale]: localeMap })
                        }

                        const addEventToLocale = (locale: string) => {
                            const usedEvents = Object.keys(templates[locale] || {})
                            const available = EVENT_OPTIONS.filter(e => !usedEvents.includes(e.value))
                            if (!available.length) return
                            const localeMap = { ...(templates[locale] || {}), [available[0].value]: "" }
                            update("multilang_templates", { ...templates, [locale]: localeMap })
                        }

                        return (
                            <div className="ml-4 space-y-4">
                                <Text className="text-ui-fg-subtle text-sm">
                                    Override template IDs per language. Customer locale is set via <code>customer.metadata.preferred_locale</code> from storefront.
                                    If no match → uses default template ID above.
                                </Text>

                                {locales.map((locale) => {
                                    const events = templates[locale] || {}
                                    const eventKeys = Object.keys(events)

                                    return (
                                        <div key={locale} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge color="blue" className="text-sm font-mono">{locale.toUpperCase()}</Badge>
                                                    <Text className="text-ui-fg-subtle text-xs">{eventKeys.length} template(s)</Text>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" size="small" onClick={() => addEventToLocale(locale)}>+ Event</Button>
                                                    <Button variant="danger" size="small" onClick={() => removeLocale(locale)}>Remove</Button>
                                                </div>
                                            </div>

                                            {eventKeys.length === 0 && (
                                                <Text className="text-ui-fg-subtle text-xs italic">No templates configured. Click "+ Event" to add.</Text>
                                            )}

                                            <div className="space-y-2">
                                                {eventKeys.map((event) => (
                                                    <div key={event} className="flex items-center gap-3">
                                                        <div className="flex-1">
                                                            <Select value={event}
                                                                onValueChange={(newEvent: string) => {
                                                                    if (newEvent === event) return
                                                                    const val = events[event]
                                                                    const next = { ...events }
                                                                    delete next[event]
                                                                    next[newEvent] = val
                                                                    update("multilang_templates", { ...templates, [locale]: next })
                                                                }}>
                                                                <Select.Trigger>
                                                                    <Select.Value />
                                                                </Select.Trigger>
                                                                <Select.Content>
                                                                    {EVENT_OPTIONS.map(opt => (
                                                                        <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
                                                                    ))}
                                                                </Select.Content>
                                                            </Select>
                                                        </div>
                                                        <Input className="w-28" placeholder="Template ID"
                                                            value={events[event] || ""}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplate(locale, event, e.target.value)} />
                                                        <Button variant="danger" size="small"
                                                            onClick={() => {
                                                                const next = { ...(templates[locale] || {}) }
                                                                delete next[event]
                                                                update("multilang_templates", { ...templates, [locale]: next })
                                                            }}>×</Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}

                                <div className="flex items-center gap-2">
                                    <Input className="w-28" placeholder="vi, en, zh..."
                                        id="_newLocaleInput"
                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                            if (e.key === "Enter") {
                                                addLocale((e.target as HTMLInputElement).value);
                                                (e.target as HTMLInputElement).value = ""
                                            }
                                        }} />
                                    <Button variant="secondary" onClick={() => {
                                        const input = document.getElementById("_newLocaleInput") as HTMLInputElement
                                        if (input) { addLocale(input.value); input.value = "" }
                                    }}>+ Add Language</Button>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </Container >

            {/* Webhook */}
            < Container className="divide-y p-0 mt-4" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">Webhook</Heading>
                    <Text className="text-ui-fg-subtle mb-4">Receive Brevo email events (delivered, opened, clicked, bounced).</Text>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.webhook_enabled}
                            onCheckedChange={(v: boolean) => update("webhook_enabled", v)} />
                        <div className="flex-1"><Label>Enable Webhook</Label></div>
                    </div>
                    {settings.webhook_enabled && (
                        <div className="grid grid-cols-1 gap-4 max-w-lg ml-4">
                            <div>
                                <Label>Webhook URL</Label>
                                <Input readOnly value={`${window.location.origin}/hooks/brevo-webhook`} />
                                <Text className="text-ui-fg-subtle text-xs mt-1">Configure this URL in Brevo → Settings → Webhooks.</Text>
                            </div>
                            <div>
                                <Label>Webhook Secret (optional)</Label>
                                <Input placeholder="Optional secret for verification" value={settings.webhook_secret || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("webhook_secret", e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>
            </Container >

            {/* WhatsApp */}
            < Container className="divide-y p-0 mt-4" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">WhatsApp Notifications</Heading>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.whatsapp_enabled}
                            onCheckedChange={(v: boolean) => update("whatsapp_enabled", v)} />
                        <div className="flex-1"><Label>Enable WhatsApp</Label></div>
                    </div>
                    {settings.whatsapp_enabled && (
                        <div className="grid grid-cols-1 gap-4 max-w-md ml-4">
                            <div>
                                <Label>Order Placed Template</Label>
                                <Input placeholder="Brevo WhatsApp template name" value={settings.whatsapp_order_placed_template || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("whatsapp_order_placed_template", e.target.value)} />
                            </div>
                            <div>
                                <Label>Shipment Template</Label>
                                <Input placeholder="Brevo WhatsApp template name" value={settings.whatsapp_shipment_template || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("whatsapp_shipment_template", e.target.value)} />
                            </div>
                            <div>
                                <Label>Abandoned Cart Template</Label>
                                <Input placeholder="Brevo WhatsApp template name" value={settings.whatsapp_abandoned_cart_template || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("whatsapp_abandoned_cart_template", e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>
            </Container >

            {/* SMS */}
            < Container className="divide-y p-0 mt-4 mb-8" >
                <div className="px-6 py-4">
                    <Heading level="h2" className="mb-4">SMS Notifications</Heading>
                    <div className="flex items-center gap-4 mb-4 p-3 border rounded-lg">
                        <Switch checked={settings.sms_enabled}
                            onCheckedChange={(v: boolean) => update("sms_enabled", v)} />
                        <div className="flex-1"><Label>Enable SMS</Label></div>
                    </div>
                    {settings.sms_enabled && (
                        <div className="grid grid-cols-1 gap-4 max-w-md ml-4">
                            <div>
                                <Label>SMS Sender Name</Label>
                                <Input placeholder="MyStore" value={settings.sms_sender || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("sms_sender", e.target.value)} />
                                <Text className="text-ui-fg-subtle text-xs mt-1">Max 11 chars, alphanumeric.</Text>
                            </div>
                            <div>
                                <Label>Order Placed SMS Content</Label>
                                <Input placeholder="Your order #{{display_id}} has been placed!" value={settings.sms_order_placed_content || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("sms_order_placed_content", e.target.value)} />
                            </div>
                            <div>
                                <Label>Shipment SMS Content</Label>
                                <Input placeholder="Your order #{{display_id}} has been shipped!" value={settings.sms_shipment_content || ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("sms_shipment_content", e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>
            </Container >

            {/* Multi-select Drawer */}
            <Drawer open={!!modal} onOpenChange={(open) => { if (!open) { setModal(null); setDrawerSearch("") } }}>
                <Drawer.Content>
                    <Drawer.Header>
                        <Drawer.Title>{modal?.title || ""}</Drawer.Title>
                    </Drawer.Header>
                    <Drawer.Body className="overflow-y-auto">
                        {modal && (() => {
                            const [search, setSearch] = [drawerSearch, setDrawerSearch]
                            const currentSelected = new Set<string>((settings?.[modal.key] || []) as string[])
                            const filtered = modal.options.filter((o) =>
                                o.label.toLowerCase().includes(search.toLowerCase()) ||
                                o.value.toLowerCase().includes(search.toLowerCase())
                            )
                            return (
                                <div className="space-y-1">
                                    <Input placeholder="Search..." value={search}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
                                    <div className="mt-3 space-y-0.5">
                                        {filtered.length === 0 && <Text className="text-ui-fg-subtle text-sm py-4 text-center">No results</Text>}
                                        {filtered.map((opt) => {
                                            const isChecked = currentSelected.has(opt.value)
                                            return (
                                                <label key={opt.value}
                                                    className="flex items-center gap-3 py-2 px-3 cursor-pointer hover:bg-ui-bg-base-hover rounded-lg">
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => {
                                                            const arr = (settings?.[modal.key] || []) as string[]
                                                            const next = isChecked
                                                                ? arr.filter((c: string) => c !== opt.value)
                                                                : [...arr, opt.value]
                                                            update(modal.key, next)
                                                        }}
                                                    />
                                                    <span className="text-sm flex-1">{opt.label}</span>
                                                    <span className="text-xs text-ui-fg-subtle font-mono">{opt.value.toUpperCase()}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })()}
                    </Drawer.Body>
                    <Drawer.Footer>
                        <div className="flex items-center justify-between w-full">
                            <Text className="text-xs text-ui-fg-subtle">
                                {((settings?.[modal?.key || ""] || []) as string[]).length} selected
                            </Text>
                            <Button variant="secondary" size="small" onClick={() => setModal(null)}>Done</Button>
                        </div>
                    </Drawer.Footer>
                </Drawer.Content>
            </Drawer>
        </>
    )
}

export const config = defineRouteConfig({
    label: "Brevo",
    icon: EnvelopeSolid,
})

export default BrevoSettingsPage
