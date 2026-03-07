# @kb0912/notification-brevo

Brevo (formerly Sendinblue) notification plugin for **Medusa v2**. Handles transactional emails, automated marketing campaigns, contact sync, and event tracking — all configurable from the Medusa Admin.

## Features

### 📧 Transactional Emails

Automatically sends Brevo transactional emails on Medusa events:

| Event | Trigger | Template Params |
|---|---|---|
| **Order Placed** | `order.placed` subscriber | `order_id`, `display_id`, `total`, `items[]`, `shipping_address`, `payment_collections[]` |
| **Order Canceled** | `order.canceled` subscriber | `order_id`, `display_id`, `customer_name` |
| **Order Delivered** | `order.completed` subscriber | `customer_name`, `order.display_id`, `order.items[]`, `order.total` |
| **Customer Created** | `customer.created` subscriber | `name`, `phone`, `customer_id` |
| **Shipment Confirmed** | `shipment.created` subscriber | `customer_name`, `tracking_number`, `tracking_url`, `order.items[]` |

Each event can be individually enabled/disabled and assigned its own Brevo template ID from the Admin UI.

---

### 🎁 Promotion — New Customer Welcome

When a new customer registers, the plugin can auto-create a **unique discount code** and send it via email.

**How it works:**

1. Customer registers → `customer.created` event fires
2. Plugin creates a Medusa Promotion with:
   - **Code**: `{PREFIX}-{8-char random}` (e.g. `WELCOME-A3KF8X2N`)
   - **Rules**: `customer_id eq {customer}` (locked to this customer only)
   - **Rules**: `currency_code ne {excluded}` (optional currency exclusions)
   - **Campaign**: time-bounded with `starts_at` / `ends_at`
   - **Budget**: usage limit = 1 (single use)
3. Sends promotion email with the code

**Admin Settings:**
- Enable/disable auto-create
- Discount type: `percentage` or `fixed`
- Discount value (e.g. 10%)
- Expiry days (default: 30)
- Code prefix (default: `WELCOME`)
- Excluded currencies (e.g. VND)

---

### ⏰ Discount Expiry Reminder

A daily scheduled job checks for promotions about to expire and sends reminder emails.

**How it works:**

1. Job runs daily at 9:00 AM (`0 9 * * *`)
2. Queries all active promotions matching the configured code prefix
3. Checks campaign `ends_at` within the reminder window (e.g. 3 days before expiry)
4. Finds the associated customer via `customer_id` rule on the promotion
5. Sends reminder email (once per promotion, tracked in customer metadata)

**Admin Settings:**
- Enable/disable reminder
- Days before expiry to send (default: 3)
- Reminder template ID

---

### 🛒 Abandoned Cart Recovery

Multi-step abandoned cart email sequence with optional discount code on the final email.

**How it works:**

1. Scheduled job runs every 15 minutes (`*/15 * * * *`)
2. Finds carts where:
   - `completed_at` is null (not checked out)
   - Has an email address
   - Has at least 1 item
   - Last item activity exceeds the configured interval
3. Sends emails based on configurable intervals (e.g. 1h, 24h, 72h)
4. Tracks sent emails in cart metadata (`abandonedcart_mail_1`, `abandonedcart_mail_2`, ...)
5. Only one email is sent per cart per job run

**Discount on final email:**

On the last interval, the plugin can auto-create a limited-time discount:
- **Code**: `{PREFIX}-{8-char random}` (e.g. `COMEBACK-V7KFPPC4`)
- **Rules**: `customer_id eq {customer}` (if cart has a logged-in customer)
- **Rules**: `currency_code ne {excluded}` (optional currency exclusions)
- **Campaign**: time-bounded (default: 48 hours)
- **Budget**: usage limit (default: 1)

**Duplicate prevention:**
- Discount creation and email sending use separate metadata flags
- If discount is created but email fails → next run retries email using the existing discount code (no duplicate)
- If user returns and updates cart → timer resets based on latest item activity, but already-sent email flags persist

**Admin Settings:**
- Enable/disable abandoned cart
- Intervals (JSON array of hours, e.g. `[1, 24, 72]`)
- Max emails per cart
- Enable/disable discount on final email
- Discount type, value, max uses, expiry hours
- Code prefix (default: `COMEBACK`)
- Excluded currencies
- Separate template ID for discount email

---

### ⭐ Review Request

Sends review request emails for completed orders after a configurable delay.

- Job schedule: daily at 10:00 AM
- Only sends for orders with status "completed" (no returns/refunds)
- Tracks sent status in order metadata to prevent duplicates

**Admin Settings:**
- Enable/disable
- Days after delivery (default: 7)
- Template ID

---

### 💌 Win-back Campaign

Re-engages inactive customers who haven't ordered in a while.

- Job schedule: daily at 11:00 AM
- Finds customers whose last completed order was X+ days ago
- Sends a win-back email (once per customer, tracked in metadata)

**Admin Settings:**
- Enable/disable
- Days inactive threshold (default: 30)
- Template ID

---

### 👥 Brevo Contact Sync

Automatically syncs new customers to a Brevo contact list.

- Creates/updates Brevo contacts with `FIRSTNAME`, `LASTNAME`, `PHONE`
- Optionally adds contacts to a specific list ID

**Admin Settings:**
- Enable/disable
- Brevo List ID

---

### 📊 Event Tracking

Sends custom events to Brevo for analytics and automation triggers.

Tracked events:
- `customer_created` — when a new customer registers
- `order_placed` — when an order is placed

**Admin Settings:**
- Enable/disable

---

### 🌐 Multi-language Templates

Override template IDs per locale for multilingual stores.

**How it works:**
- Customer's preferred locale is read from `customer.metadata.preferred_locale`
- If a locale-specific template exists for the event → use it
- Otherwise → fallback to the default template

**Admin Settings:**
- Enable/disable
- JSON template map: `{ "vi": { "order.placed": 101, "order.canceled": 102 }, "en": { ... } }`

---

## Installation

```bash
# Install the plugin
yarn add @kb0912/notification-brevo

# Or link locally for development
yalc add @kb0912/notification-brevo
```

## Configuration

### 1. Register the plugin in `medusa-config.ts`

```typescript
import { defineConfig } from "@medusajs/framework/utils"

export default defineConfig({
  // ...
  plugins: [
    {
      resolve: "@kb0912/notification-brevo",
      options: {},
    },
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@kb0912/notification-brevo/providers/notifications-brevo",
            id: "brevo",
            options: {
              channels: ["email"],
              apiKey: process.env.BREVO_API_KEY,
              from: process.env.BREVO_FROM_EMAIL,
              senderName: process.env.BREVO_SENDER_NAME,
              // Optional: env-level template ID fallbacks
              orderPlacedTemplateId: process.env.BREVO_ORDER_PLACED_TEMPLATE_ID,
              orderCanceledTemplateId: process.env.BREVO_ORDER_CANCELED_TEMPLATE_ID,
              customerCreatedTemplateId: process.env.BREVO_CUSTOMER_CREATED_TEMPLATE_ID,
              shipmentConfirmedTemplateId: process.env.BREVO_SHIPMENT_CONFIRMED_TEMPLATE_ID,
              abandonedCartTemplateId: process.env.BREVO_ABANDONED_CART_TEMPLATE_ID,
            },
          },
        ],
      },
    },
  ],
})
```

### 2. Environment Variables

```env
BREVO_API_KEY=xkeysib-xxxxxxxx
BREVO_FROM_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME="Your Store"
```

### 3. Run Migrations

```bash
npx medusa db:migrate
```

### 4. Admin Settings

Navigate to **Settings → Brevo** in the Medusa Admin to configure:
- Template IDs for each event
- Enable/disable individual features
- Promotion settings (discount type, value, prefix, currency exclusions)
- Abandoned cart intervals and discount settings
- Contact sync, event tracking, and multi-language options

---

## Brevo Template Variables

Use these variables in your Brevo email templates:

### Order Placed

```
{{ params.order_id }}
{{ params.display_id }}
{{ params.customer_name }}
{{ params.total }}
{{ params.date_placed }}
{{ params.shipping_address.first_name }}
{{ params.shipping_address.address_1 }}
{{ params.shipping_address.city }}
{% for item in params.items %}
  {{ item.title }} × {{ item.quantity }} — {{ item.total }}
{% endfor %}
```

### Customer Created

```
{{ params.name }}
{{ params.customer_id }}
```

### Promotion (Welcome / Expiry Reminder)

```
{{ params.first_name }}
{{ params.promotion_code }}
{{ params.ends_at }}
{{ params.days_left }}        <!-- expiry reminder only -->
```

### Abandoned Cart

```
{{ params.name }}
{% for item in params.items %}
  {{ item.title }} × {{ item.quantity }} — {{ item.unit_price }}
{% endfor %}
{{ params.promotion_code }}           <!-- if discount enabled -->
{{ params.discount_value }}           <!-- e.g. 10 -->
{{ params.discount_type }}            <!-- "percentage" or "fixed" -->
{{ params.discount_expires_at }}      <!-- ISO date string -->
```

### Shipment Confirmed

```
{{ params.customer_name }}
{{ params.tracking_number }}
{{ params.tracking_url }}
{{ params.order.display_id }}
{% for item in params.order.items %}
  {{ item.title }} × {{ item.quantity }}
{% endfor %}
```

### Review Request

```
{{ params.customer_name }}
{{ params.display_id }}
{% for item in params.items %}
  {{ item.title }}
{% endfor %}
```

### Win-back

```
{{ params.customer_name }}
{{ params.last_order_date }}
{{ params.days_inactive }}
```

---

## Development

```bash
# Watch for changes (plugin development)
yarn dev

# Build for production
yarn build
```

## License

MIT