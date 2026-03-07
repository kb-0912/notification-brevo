/**
 * Bulk-create email templates in Brevo via API.
 * 
 * Creates all templates (en + vi + th + ko + ja), each locale in its own folder:
 *   FRAGILE_NEW_TEMPLATE_EN, FRAGILE_NEW_TEMPLATE_VI, etc.
 *
 * Usage:
 *   BREVO_API_KEY=xkeysib-xxx node scripts/upload-templates-to-brevo.js
 *
 * Prerequisites:
 *   npm install @getbrevo/brevo   (or yarn add @getbrevo/brevo)
 */
const fs = require("fs")
const path = require("path")

const API_KEY = process.env.BREVO_API_KEY
if (!API_KEY) {
    console.error("❌ Set BREVO_API_KEY env var")
    process.exit(1)
}

const SENDER_NAME = process.env.BREVO_SENDER_NAME || "FRAGILE CLUB"
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "no-reply@fragile.club"
const TEMPLATES_DIR = path.join(__dirname, "..", "templates")

// Template definitions: { filename, name, subject }
const TEMPLATES = [
    { file: "order-placed.html", name: "Order Placed", subject: "Order Confirmation #{{ params.display_id }}" },
    { file: "order-canceled.html", name: "Order Canceled", subject: "Order Canceled #{{ params.display_id }}" },
    { file: "order-delivered.html", name: "Order Delivered", subject: "Your Order Has Been Delivered" },
    { file: "customer-created.html", name: "Customer Welcome", subject: "Welcome to FRAGILE" },
    { file: "promotion-new-customer.html", name: "Welcome Discount", subject: "A Gift For You — Exclusive Discount Inside" },
    { file: "shipment-confirmed.html", name: "Shipment Confirmed", subject: "Your Order Has Been Shipped" },
    { file: "abandoned-cart.html", name: "Abandoned Cart", subject: "You Left Something Behind" },
    { file: "abandoned-cart-discount.html", name: "Abandoned Cart + Discount", subject: "A Special Offer Just For You" },
    { file: "review-request.html", name: "Review Request", subject: "How Was Your Order?" },
    { file: "winback.html", name: "Win-back", subject: "We Miss You" },
    { file: "promotion-expiry-reminder.html", name: "Promotion Expiry Reminder", subject: "Your Discount Is Expiring Soon" },
]

// Localized subjects
const SUBJECTS_I18N = {
    vi: {
        "Order Placed": "Xác Nhận Đặt Hàng",
        "Order Canceled": "Đơn Hàng Đã Bị Hủy",
        "Order Delivered": "Đơn Hàng Đã Được Giao",
        "Customer Welcome": "Chào Mừng Đến Với FRAGILE CLUB",
        "Welcome Discount": "Quà Tặng Dành Cho Bạn",
        "Shipment Confirmed": "Đơn Hàng Đã Được Vận Chuyển",
        "Abandoned Cart": "Bạn Chưa Hoàn Tất Đơn Hàng Của Mình!",
        "Abandoned Cart + Discount": "Ưu Đãi Đặc Biệt Dành Cho Bạn",
        "Review Request": "Đơn Hàng Của Bạn Thế Nào?",
        "Win-back": "We Miss You!!!",
        "Promotion Expiry Reminder": "Mã Giảm Giá Sắp Hết Hạn",
    },
    th: {
        "Order Placed": "ยืนยันคำสั่งซื้อ #{{ params.display_id }}",
        "Order Canceled": "คำสั่งซื้อถูกยกเลิก #{{ params.display_id }}",
        "Order Delivered": "จัดส่งสำเร็จ",
        "Customer Welcome": "ยินดีต้อนรับสู่ FRAGILE",
        "Welcome Discount": "ของขวัญสำหรับคุณ",
        "Shipment Confirmed": "ยืนยันการจัดส่ง",
        "Abandoned Cart": "คุณลืมสินค้าไว้",
        "Abandoned Cart + Discount": "ข้อเสนอพิเศษสำหรับคุณ",
        "Review Request": "คำสั่งซื้อของคุณเป็นอย่างไร?",
        "Win-back": "เราคิดถึงคุณ",
        "Promotion Expiry Reminder": "ส่วนลดกำลังจะหมดอายุ",
    },
    ko: {
        "Order Placed": "주문 확인 #{{ params.display_id }}",
        "Order Canceled": "주문 취소 #{{ params.display_id }}",
        "Order Delivered": "배송 완료",
        "Customer Welcome": "FRAGILE에 오신 것을 환영합니다",
        "Welcome Discount": "특별한 선물 — 할인 코드 안내",
        "Shipment Confirmed": "배송 확인",
        "Abandoned Cart": "장바구니에 상품이 남아있습니다",
        "Abandoned Cart + Discount": "특별 할인 혜택",
        "Review Request": "주문은 어떠셨나요?",
        "Win-back": "다시 만나고 싶어요",
        "Promotion Expiry Reminder": "할인 코드 만료 임박",
    },
    ja: {
        "Order Placed": "注文確認 #{{ params.display_id }}",
        "Order Canceled": "注文キャンセル #{{ params.display_id }}",
        "Order Delivered": "配送完了",
        "Customer Welcome": "FRAGILEへようこそ",
        "Welcome Discount": "あなたへのギフト — 特別割引",
        "Shipment Confirmed": "発送確認",
        "Abandoned Cart": "カートに商品が残っています",
        "Abandoned Cart + Discount": "特別割引のご案内",
        "Review Request": "ご注文はいかがでしたか？",
        "Win-back": "お待ちしています",
        "Promotion Expiry Reminder": "割引コードの有効期限が近づいています",
    },
}

const LOCALES = ["en", "vi", "th", "ko", "ja"]

/**
 * Collapse multi-line {{ }} and {% %} Jinja2 tags into single lines.
 * Brevo's lexer rejects newlines within template tags.
 */
function sanitizeJinja2(html) {
    // Collapse {{ ... }} that span multiple lines
    html = html.replace(/\{\{[^}]*\}\}/gs, (match) => match.replace(/\s*\n\s*/g, " "))
    // Collapse {% ... %} that span multiple lines
    html = html.replace(/\{%[^%]*%\}/gs, (match) => match.replace(/\s*\n\s*/g, " "))
    return html
}

async function main() {
    const headers = {
        "api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
    }

    const results = []

    for (const locale of LOCALES) {
        console.log(`\n🌐 Locale: ${locale.toUpperCase()}`)

        for (const tpl of TEMPLATES) {
            const filePath =
                locale === "en"
                    ? path.join(TEMPLATES_DIR, tpl.file)
                    : path.join(TEMPLATES_DIR, locale, tpl.file)

            if (!fs.existsSync(filePath)) {
                console.log(`   ⚠️  Skip ${tpl.file} (file not found)`)
                continue
            }

            const rawHtml = fs.readFileSync(filePath, "utf-8")
            const html = sanitizeJinja2(rawHtml)
            const templateName = `[${locale.toUpperCase()}] ${tpl.name}`

            const subject =
                locale === "en"
                    ? tpl.subject
                    : SUBJECTS_I18N[locale]?.[tpl.name] || tpl.subject

            const body = {
                templateName,
                htmlContent: html,
                subject,
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                isActive: true,
            }

            try {
                const res = await fetch("https://api.brevo.com/v3/smtp/templates", {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                })
                const data = await res.json()

                if (res.ok) {
                    console.log(`   ✅ ${templateName} → ID: ${data.id}`)
                    results.push({ locale, name: templateName, id: data.id })
                } else {
                    console.error(`   ❌ ${templateName}: ${data.message || JSON.stringify(data)}`)
                }
            } catch (err) {
                console.error(`   ❌ ${templateName}: ${err.message}`)
            }

            // Rate limit: ~100ms between calls
            await new Promise((r) => setTimeout(r, 100))
        }
    }

    // 3. Summary
    console.log("\n" + "=".repeat(60))
    console.log("📋 TEMPLATE ID SUMMARY")
    console.log("=".repeat(60))
    console.log("| Locale | Template                    | ID     |")
    console.log("|--------|-----------------------------|--------|")
    for (const r of results) {
        console.log(`| ${r.locale.padEnd(6)} | ${r.name.padEnd(27)} | ${String(r.id).padEnd(6)} |`)
    }
    console.log("=".repeat(60))
    console.log(`\nTotal: ${results.length} templates across ${LOCALES.length} locales`)
}

main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
})
