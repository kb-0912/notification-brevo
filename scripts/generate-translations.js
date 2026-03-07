/**
 * Generate fully translated email templates for all locales.
 * Run: node scripts/generate-translations.js
 *
 * Output: templates/{vi,th,ko,ja}/*.html
 */
const fs = require("fs")
const path = require("path")

const TEMPLATES_DIR = path.join(__dirname, "..", "templates")
const LOCALES = ["vi", "th", "ko", "ja"]

// ──── Shared components ────

const FOOTER = {
    en: `©2025 <a href="https://fragile.club">fragile.club</a> ·
                            <a href="https://fragile.club/support">Terms and Conditions & Privacy Policy</a>`,
    vi: `©2025 <a href="https://fragile.club">fragile.club</a> ·
                            <a href="https://fragile.club/support">Điều khoản & Chính sách bảo mật</a>`,
    th: `©2025 <a href="https://fragile.club">fragile.club</a> ·
                            <a href="https://fragile.club/support">ข้อกำหนดและนโยบายความเป็นส่วนตัว</a>`,
    ko: `©2025 <a href="https://fragile.club">fragile.club</a> ·
                            <a href="https://fragile.club/support">이용약관 및 개인정보처리방침</a>`,
    ja: `©2025 <a href="https://fragile.club">fragile.club</a> ·
                            <a href="https://fragile.club/support">利用規約とプライバシーポリシー</a>`,
}

function wrap(title, bodyHtml, locale) {
    return `<!DOCTYPE html>
<html>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${title}</title>
    <style type="text/css">
        a { color: inherit !important; text-decoration: none; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    </style>

    <header>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
            <tbody>
                <tr>
                    <td align="center" style="padding-top: 80px;">
                        <a href="https://fragile.club">
                            <img width="200px" src="https://fragile.club/new_logo_r_black.png" style="max-width: 100%;">
                        </a>
                    </td>
                </tr>
            </tbody>
        </table>
    </header>

    <div style="max-width:600px;margin:20px auto 40px;padding:0 20px;">
${bodyHtml}
    </div>

    <footer>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto 0;">
            <tbody>
                <tr height="40px"></tr>
                <tr>
                    <td align="center">
                        <span style="font-size:12px;color:#888888;">
                            ${FOOTER[locale]}
                        </span>
                    </td>
                </tr>
                <tr height="10px"></tr>
                <tr>
                    <td align="center">
                        <span style="font-size:12px;color:#888888;">
                            FRGL LLC - FRAGILE, 15757 SW 74th Ave, Tigard, Oregon 97224
                        </span>
                    </td>
                </tr>
                <tr height="10px"></tr>
            </tbody>
        </table>
    </footer>
</body>
</html>`
}

function heading(text) {
    return `        <table width="100%" style="border-collapse: collapse;">
            <tbody>
                <tr>
                    <td align="center">
                        <span style="font-size:16px;font-weight:500;">${text}</span>
                    </td>
                </tr>
                <tr style="height:20px;"></tr>`
}

function paragraph(text) {
    return `                <tr>
                    <td style="line-height: 18px;">
                        <span style="font-size:12px;">${text}</span>
                    </td>
                </tr>`
}

function closeTable() {
    return `            </tbody>
        </table>`
}

function cta(href, text) {
    return `        <table width="100%" style="border-collapse: collapse; margin-top: 25px;">
            <tbody>
                <tr>
                    <td align="center">
                        <a href="${href}" style="border:1px solid #111;padding:10px 46px;font-size:12px;text-transform:uppercase;letter-spacing:1px;text-decoration:none;display:inline-block;color:#111;background:none;">${text}</a>
                    </td>
                </tr>
            </tbody>
        </table>`
}

function codeBox(labelText, codeVar, subText) {
    return `        <table width="100%" style="border-collapse: collapse; margin-top: 25px;">
            <tbody>
                <tr>
                    <td align="center">
                        <table cellpadding="0" cellspacing="0" border="0" style="background:#eee; padding: 5px;">
                            <tbody>
                                <tr>
                                    <td align="center">
                                        <span style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;">${labelText}</span><br>
                                        <span style="font-size:24px;font-weight:700;letter-spacing:3px;">${codeVar}</span>
                                        ${subText ? `<br><br><span style="font-size:12px;color:#888;">${subText}</span>` : ""}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>`
}

function cartItems(qtyLabel) {
    return `        <table width="100%" style="border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">{{ cartHeading }}</span></td></tr>
                <tr style="height:10px;"></tr>
                <tr><td>
                    {% for item in params.items %}
                    <table width="100%" style="margin-bottom: 15px; border-bottom: 1px solid #eee;">
                        <tbody><tr>
                            <td width="18%" style="vertical-align:top;padding-right:20px;padding-bottom:15px;">
                                <img src="{{ item.thumbnail }}" alt="{{ item.title }}" style="max-width:100%;">
                            </td>
                            <td width="62%" style="vertical-align:top;padding-right:20px;">
                                <span style="font-size:12px;">{{ item.title }}<br>${qtyLabel}: {{ item.quantity }}</span>
                            </td>
                            <td width="20%" align="right" style="vertical-align:top;">
                                <span style="font-size:12px;">{{ item.unit_price }}</span>
                            </td>
                        </tr></tbody>
                    </table>
                    {% endfor %}
                </td></tr>
            </tbody>
        </table>`
}

// ──── Translation strings per locale ────

const L = {
    vi: {
        // order-canceled
        oc_title: "Đơn Hàng Đã Hủy #{{ params.display_id }}",
        oc_heading: "ĐƠN HÀNG ĐÃ HỦY",
        oc_dear: "{{ params.customer_name }} thân mến,",
        oc_body1: 'Chúng tôi xin thông báo rằng đơn hàng <strong>#{{ params.display_id }}</strong> của bạn đã bị hủy.',
        oc_body2: "Nếu bạn đã thanh toán, khoản hoàn tiền sẽ được xử lý về phương thức thanh toán ban đầu trong 5–10 ngày làm việc.",
        oc_body3: 'Nếu bạn có câu hỏi, vui lòng <a href="https://fragile.club/support">liên hệ với chúng tôi</a>.',
        oc_body4: "Chúng tôi hy vọng sớm được phục vụ bạn.",

        // order-delivered
        od_title: "Đơn Hàng Đã Giao",
        od_heading: "ĐƠN HÀNG ĐÃ GIAO",
        od_dear: "{{ params.customer_name }} thân mến,",
        od_body: 'Tin vui! Đơn hàng <strong>#{{ params.order.display_id }}</strong> của bạn đã được giao.<br><br>Chúng tôi hy vọng bạn yêu thích sản phẩm. Nếu có vấn đề gì, đừng ngần ngại <a href="https://fragile.club/support">liên hệ với chúng tôi</a>.',
        od_items: "SẢN PHẨM ĐÃ GIAO",
        od_total: "Tổng",
        od_qty: "SL",

        // customer-created
        cc_title: "Chào Mừng Đến Với FRAGILE",
        cc_heading: "CHÀO MỪNG ĐẾN VỚI FRAGILE",
        cc_dear: "{{ params.name }} thân mến,",
        cc_body: 'Chào mừng bạn đến với <strong>FRAGILE</strong>! Chúng tôi rất vui khi bạn tham gia cộng đồng của chúng tôi.<br><br>Tài khoản của bạn đã được tạo thành công. Bạn có thể theo dõi đơn hàng, danh sách yêu thích và các đặc quyền thành viên.<br><br>Bắt đầu khám phá tại <a href="https://fragile.club">fragile.club</a>.',

        // promotion-new-customer
        pn_title: "Quà Tặng Dành Cho Bạn",
        pn_heading: "QUÀ TẶNG DÀNH CHO BẠN",
        pn_dear: "{{ params.first_name }} thân mến,",
        pn_body: 'Chào mừng đến với <strong>FRAGILE</strong>! Để cảm ơn bạn đã tham gia, đây là mã giảm giá độc quyền cho đơn hàng đầu tiên.',
        pn_code_label: "Mã của bạn",
        pn_valid: "Có hiệu lực đến {{ params.ends_at }}",
        pn_cta: "Mua ngay",

        // shipment-confirmed
        sc_title: "Xác Nhận Vận Chuyển",
        sc_heading: "XÁC NHẬN VẬN CHUYỂN",
        sc_dear: "{{ params.customer_name }} thân mến,",
        sc_body: "Đơn hàng <strong>#{{ params.order.display_id }}</strong> đã được gửi! Đây là thông tin theo dõi:",
        sc_tracking: "MÃ THEO DÕI",
        sc_track_btn: "Theo dõi đơn hàng",
        sc_items: "SẢN PHẨM ĐÃ GỬI",
        sc_qty: "SL",

        // abandoned-cart
        ac_title: "Bạn Đã Để Lại Sản Phẩm",
        ac_heading: "VẪN ĐANG SUY NGHĨ?",
        ac_dear: "{% if params.name != \"\" %}{{ params.name }} thân mến,{% endif %}",
        ac_body: "Bạn đã để lại một số sản phẩm trong giỏ hàng. Chúng vẫn đang chờ bạn — nhưng sẽ không chờ mãi đâu.",
        ac_cart: "GIỎ HÀNG CỦA BẠN",
        ac_qty: "SL",
        ac_cta: "Hoàn tất đơn hàng",

        // abandoned-cart-discount
        acd_title: "Ưu Đãi Đặc Biệt Dành Cho Bạn",
        acd_heading: "ĐỪNG BỎ LỠ",
        acd_body: "Giỏ hàng vẫn đang chờ bạn — và chúng tôi đã thêm mã giảm giá đặc biệt dành riêng cho bạn.<br><br>Sử dụng mã bên dưới trước khi hết hạn!",
        acd_code_label: "Mã độc quyền của bạn",
        acd_discount_info: '{{ params.discount_value }}{% if params.discount_type == "percentage" %}%{% endif %} giảm · Hết hạn {{ params.discount_expires_at }}',
        acd_cart: "GIỎ HÀNG CỦA BẠN",
        acd_cta: "Hoàn tất đơn hàng",

        // review-request
        rr_title: "Đơn Hàng Của Bạn Thế Nào?",
        rr_heading: "ĐƠN HÀNG CỦA BẠN THẾ NÀO?",
        rr_dear: "{{ params.customer_name }} thân mến,",
        rr_body: 'Chúng tôi hy vọng bạn hài lòng với đơn hàng <strong>#{{ params.display_id }}</strong>.<br><br>Phản hồi của bạn rất quan trọng với chúng tôi. Bạn có thể dành chút thời gian để chia sẻ suy nghĩ không?',
        rr_items: "SẢN PHẨM TỪ ĐƠN HÀNG",
        rr_cta: "Viết đánh giá",

        // winback
        wb_title: "Chúng Tôi Nhớ Bạn",
        wb_heading: "CHÚNG TÔI NHỚ BẠN",
        wb_dear: "{{ params.customer_name }} thân mến,",
        wb_body: 'Đã {{ params.days_inactive }} ngày kể từ đơn hàng cuối vào {{ params.last_order_date }}. Chúng tôi đã bổ sung nhiều sản phẩm mới mà bạn chắc chắn sẽ thích.<br><br>Quay lại xem những gì mới nhất tại FRAGILE.',
        wb_cta: "Xem hàng mới",

        // promotion-expiry-reminder
        pe_title: "Mã Giảm Giá Sắp Hết Hạn",
        pe_heading: "ĐỪNG ĐỂ HẾT HẠN",
        pe_dear: "{{ params.first_name }} thân mến,",
        pe_body: 'Nhắc nhở — mã giảm giá độc quyền của bạn sẽ hết hạn trong <strong>{{ params.days_left }} ngày</strong> nữa!<br><br>Sử dụng trước khi hết hạn.',
        pe_code_label: "Mã của bạn",
        pe_expires: "Hết hạn {{ params.expires_at }}",
        pe_cta: "Mua ngay",
    },
    th: {
        oc_title: "คำสั่งซื้อถูกยกเลิก #{{ params.display_id }}",
        oc_heading: "คำสั่งซื้อถูกยกเลิก",
        oc_dear: "เรียน {{ params.customer_name }},",
        oc_body1: 'เราเขียนมาเพื่อแจ้งให้คุณทราบว่าคำสั่งซื้อ <strong>#{{ params.display_id }}</strong> ของคุณถูกยกเลิกแล้ว',
        oc_body2: "หากมีการชำระเงินแล้ว การคืนเงินจะดำเนินการไปยังวิธีการชำระเงินเดิมภายใน 5–10 วันทำการ",
        oc_body3: 'หากคุณมีคำถาม กรุณา<a href="https://fragile.club/support">ติดต่อเรา</a>',
        oc_body4: "เราหวังว่าจะได้ให้บริการคุณอีกครั้ง",

        od_title: "จัดส่งสำเร็จ",
        od_heading: "จัดส่งสำเร็จ",
        od_dear: "เรียน {{ params.customer_name }},",
        od_body: 'ข่าวดี! คำสั่งซื้อ <strong>#{{ params.order.display_id }}</strong> ของคุณได้จัดส่งแล้ว<br><br>เราหวังว่าคุณจะชอบสินค้าใหม่ หากมีปัญหา กรุณา<a href="https://fragile.club/support">ติดต่อเรา</a>',
        od_items: "สินค้าที่จัดส่ง",
        od_total: "ยอดรวม",
        od_qty: "จำนวน",

        cc_title: "ยินดีต้อนรับสู่ FRAGILE",
        cc_heading: "ยินดีต้อนรับสู่ FRAGILE",
        cc_dear: "เรียน {{ params.name }},",
        cc_body: 'ยินดีต้อนรับสู่ <strong>FRAGILE</strong>! เรายินดีเป็นอย่างยิ่งที่คุณเข้าร่วมชุมชนของเรา<br><br>บัญชีของคุณถูกสร้างเรียบร้อยแล้ว คุณสามารถติดตามคำสั่งซื้อ สิ่งที่อยากได้ และสิทธิพิเศษสำหรับสมาชิก<br><br>เริ่มสำรวจได้ที่ <a href="https://fragile.club">fragile.club</a>',

        pn_title: "ของขวัญสำหรับคุณ",
        pn_heading: "ของขวัญสำหรับคุณ",
        pn_dear: "เรียน {{ params.first_name }},",
        pn_body: 'ยินดีต้อนรับสู่ <strong>FRAGILE</strong>! เพื่อขอบคุณที่เข้าร่วมกับเรา นี่คือส่วนลดพิเศษสำหรับคำสั่งซื้อแรกของคุณ',
        pn_code_label: "รหัสของคุณ",
        pn_valid: "ใช้ได้ถึง {{ params.ends_at }}",
        pn_cta: "ช้อปเลย",

        sc_title: "ยืนยันการจัดส่ง",
        sc_heading: "ยืนยันการจัดส่ง",
        sc_dear: "เรียน {{ params.customer_name }},",
        sc_body: "คำสั่งซื้อ <strong>#{{ params.order.display_id }}</strong> ของคุณได้ถูกจัดส่งแล้ว! นี่คือรายละเอียดการติดตาม:",
        sc_tracking: "หมายเลขติดตาม",
        sc_track_btn: "ติดตามพัสดุ",
        sc_items: "สินค้าที่จัดส่ง",
        sc_qty: "จำนวน",

        ac_title: "คุณลืมสินค้าไว้",
        ac_heading: "ยังคิดอยู่?",
        ac_dear: '{% if params.name != "" %}เรียน {{ params.name }},{% endif %}',
        ac_body: "คุณมีสินค้าค้างอยู่ในตะกร้า สินค้ายังรอคุณอยู่ — แต่จะไม่รอตลอดไป",
        ac_cart: "ตะกร้าของคุณ",
        ac_qty: "จำนวน",
        ac_cta: "สั่งซื้อให้เสร็จ",

        acd_title: "ข้อเสนอพิเศษสำหรับคุณ",
        acd_heading: "อย่าพลาด",
        acd_body: "ตะกร้าของคุณยังรออยู่ — และเราได้เพิ่มส่วนลดพิเศษให้คุณ<br><br>ใช้รหัสด้านล่างก่อนหมดอายุ!",
        acd_code_label: "รหัสพิเศษของคุณ",
        acd_discount_info: '{{ params.discount_value }}{% if params.discount_type == "percentage" %}%{% endif %} ส่วนลด · หมดอายุ {{ params.discount_expires_at }}',
        acd_cart: "ตะกร้าของคุณ",
        acd_cta: "สั่งซื้อให้เสร็จ",

        rr_title: "คำสั่งซื้อของคุณเป็นอย่างไร?",
        rr_heading: "คำสั่งซื้อของคุณเป็นอย่างไร?",
        rr_dear: "เรียน {{ params.customer_name }},",
        rr_body: 'เราหวังว่าคุณจะพอใจกับคำสั่งซื้อ <strong>#{{ params.display_id }}</strong><br><br>ความคิดเห็นของคุณมีความสำคัญกับเรา คุณสามารถสละเวลาแบ่งปันความคิดเห็นได้ไหม?',
        rr_items: "สินค้าจากคำสั่งซื้อ",
        rr_cta: "เขียนรีวิว",

        wb_title: "เราคิดถึงคุณ",
        wb_heading: "เราคิดถึงคุณ",
        wb_dear: "เรียน {{ params.customer_name }},",
        wb_body: 'ผ่านมา {{ params.days_inactive }} วันแล้วตั้งแต่คำสั่งซื้อล่าสุดของคุณเมื่อ {{ params.last_order_date }} เรามีสินค้าใหม่ที่คุณต้องชอบ<br><br>กลับมาดูสินค้าใหม่ล่าสุดที่ FRAGILE',
        wb_cta: "ดูสินค้ามาใหม่",

        pe_title: "ส่วนลดกำลังจะหมดอายุ",
        pe_heading: "อย่าปล่อยให้หมดอายุ",
        pe_dear: "เรียน {{ params.first_name }},",
        pe_body: 'รหัสส่วนลดพิเศษของคุณจะหมดอายุใน <strong>{{ params.days_left }} วัน</strong>!<br><br>ใช้ก่อนหมดเขต',
        pe_code_label: "รหัสของคุณ",
        pe_expires: "หมดอายุ {{ params.expires_at }}",
        pe_cta: "ช้อปเลย",
    },
    ko: {
        oc_title: "주문 취소 #{{ params.display_id }}",
        oc_heading: "주문 취소",
        oc_dear: "{{ params.customer_name }}님께,",
        oc_body1: '주문 <strong>#{{ params.display_id }}</strong>이(가) 취소되었음을 알려드립니다.',
        oc_body2: "결제가 이루어진 경우 원래 결제 수단으로 5~10 영업일 내에 환불 처리됩니다.",
        oc_body3: '문의사항이 있으시면 <a href="https://fragile.club/support">문의해 주세요</a>.',
        oc_body4: "다시 찾아주시기를 바랍니다.",

        od_title: "배송 완료",
        od_heading: "배송 완료",
        od_dear: "{{ params.customer_name }}님께,",
        od_body: '좋은 소식입니다! 주문 <strong>#{{ params.order.display_id }}</strong>이(가) 배송 완료되었습니다.<br><br>새 제품이 마음에 드시길 바랍니다. 문제가 있으시면 <a href="https://fragile.club/support">문의해 주세요</a>.',
        od_items: "배송된 상품",
        od_total: "합계",
        od_qty: "수량",

        cc_title: "FRAGILE에 오신 것을 환영합니다",
        cc_heading: "FRAGILE에 오신 것을 환영합니다",
        cc_dear: "{{ params.name }}님께,",
        cc_body: '<strong>FRAGILE</strong>에 오신 것을 환영합니다! 저희 커뮤니티에 합류해 주셔서 기쁩니다.<br><br>계정이 성공적으로 생성되었습니다. 주문 추적, 위시리스트 및 회원 전용 혜택을 이용하실 수 있습니다.<br><br>지금 바로 <a href="https://fragile.club">fragile.club</a>에서 탐색하세요.',

        pn_title: "특별한 선물",
        pn_heading: "특별한 선물",
        pn_dear: "{{ params.first_name }}님께,",
        pn_body: '<strong>FRAGILE</strong>에 오신 것을 환영합니다! 가입 감사의 의미로 첫 주문 할인을 드립니다.',
        pn_code_label: "할인 코드",
        pn_valid: "유효기간 {{ params.ends_at }}",
        pn_cta: "지금 쇼핑하기",

        sc_title: "배송 확인",
        sc_heading: "배송 확인",
        sc_dear: "{{ params.customer_name }}님께,",
        sc_body: "주문 <strong>#{{ params.order.display_id }}</strong>이(가) 발송되었습니다! 추적 정보:",
        sc_tracking: "운송장 번호",
        sc_track_btn: "배송 추적",
        sc_items: "발송된 상품",
        sc_qty: "수량",

        ac_title: "장바구니에 상품이 남아있습니다",
        ac_heading: "아직 고민 중이신가요?",
        ac_dear: '{% if params.name != "" %}{{ params.name }}님께,{% endif %}',
        ac_body: "장바구니에 상품이 남아있습니다. 아직 기다리고 있지만, 영원히 기다리지는 않습니다.",
        ac_cart: "장바구니",
        ac_qty: "수량",
        ac_cta: "주문 완료하기",

        acd_title: "특별 할인 혜택",
        acd_heading: "놓치지 마세요",
        acd_body: "장바구니가 아직 기다리고 있습니다 — 특별 할인도 준비했어요.<br><br>만료 전에 아래 코드를 사용하세요!",
        acd_code_label: "회원 전용 코드",
        acd_discount_info: '{{ params.discount_value }}{% if params.discount_type == "percentage" %}%{% endif %} 할인 · 만료일 {{ params.discount_expires_at }}',
        acd_cart: "장바구니",
        acd_cta: "주문 완료하기",

        rr_title: "주문은 어떠셨나요?",
        rr_heading: "주문은 어떠셨나요?",
        rr_dear: "{{ params.customer_name }}님께,",
        rr_body: '주문 <strong>#{{ params.display_id }}</strong>을(를) 만족스럽게 사용하고 계시길 바랍니다.<br><br>고객님의 소중한 피드백을 기다리고 있습니다.',
        rr_items: "주문 상품",
        rr_cta: "리뷰 작성하기",

        wb_title: "다시 만나고 싶어요",
        wb_heading: "다시 만나고 싶어요",
        wb_dear: "{{ params.customer_name }}님께,",
        wb_body: '마지막 주문일 {{ params.last_order_date }}로부터 {{ params.days_inactive }}일이 지났습니다. 새로운 상품들을 만나보세요.<br><br>FRAGILE의 새로운 컬렉션을 확인해 보세요.',
        wb_cta: "신상품 보기",

        pe_title: "할인 코드 만료 임박",
        pe_heading: "만료되기 전에",
        pe_dear: "{{ params.first_name }}님께,",
        pe_body: '회원 전용 할인 코드가 <strong>{{ params.days_left }}일</strong> 후 만료됩니다!<br><br>만료 전에 사용하세요.',
        pe_code_label: "할인 코드",
        pe_expires: "만료일 {{ params.expires_at }}",
        pe_cta: "지금 쇼핑하기",
    },
    ja: {
        oc_title: "注文キャンセル #{{ params.display_id }}",
        oc_heading: "注文キャンセル",
        oc_dear: "{{ params.customer_name }}様、",
        oc_body1: 'ご注文 <strong>#{{ params.display_id }}</strong> がキャンセルされたことをお知らせいたします。',
        oc_body2: "お支払い済みの場合、5〜10営業日以内に元の決済方法に返金処理されます。",
        oc_body3: 'ご質問がございましたら<a href="https://fragile.club/support">お問い合わせください</a>。',
        oc_body4: "またのご利用をお待ちしております。",

        od_title: "配送完了",
        od_heading: "配送完了",
        od_dear: "{{ params.customer_name }}様、",
        od_body: 'ご注文 <strong>#{{ params.order.display_id }}</strong> が配送されました。<br><br>気に入っていただけると嬉しいです。何かございましたら<a href="https://fragile.club/support">お問い合わせください</a>。',
        od_items: "配送済み商品",
        od_total: "合計",
        od_qty: "数量",

        cc_title: "FRAGILEへようこそ",
        cc_heading: "FRAGILEへようこそ",
        cc_dear: "{{ params.name }}様、",
        cc_body: '<strong>FRAGILE</strong>へようこそ！コミュニティへのご参加を歓迎いたします。<br><br>アカウントが正常に作成されました。注文追跡、ウィッシュリスト、会員特典をご利用いただけます。<br><br><a href="https://fragile.club">fragile.club</a>で探索を始めましょう。',

        pn_title: "あなたへのギフト",
        pn_heading: "あなたへのギフト",
        pn_dear: "{{ params.first_name }}様、",
        pn_body: '<strong>FRAGILE</strong>へようこそ！ご参加ありがとうございます。初回ご注文に使える特別割引をプレゼントいたします。',
        pn_code_label: "割引コード",
        pn_valid: "有効期限 {{ params.ends_at }}",
        pn_cta: "今すぐ購入",

        sc_title: "発送確認",
        sc_heading: "発送確認",
        sc_dear: "{{ params.customer_name }}様、",
        sc_body: "ご注文 <strong>#{{ params.order.display_id }}</strong> が発送されました！追跡情報：",
        sc_tracking: "追跡番号",
        sc_track_btn: "配送を追跡",
        sc_items: "発送済み商品",
        sc_qty: "数量",

        ac_title: "カートに商品が残っています",
        ac_heading: "まだお考え中ですか？",
        ac_dear: '{% if params.name != "" %}{{ params.name }}様、{% endif %}',
        ac_body: "カートに商品が残っています。まだお待ちしていますが、いつまでもとは限りません。",
        ac_cart: "カート",
        ac_qty: "数量",
        ac_cta: "ご注文を完了する",

        acd_title: "特別割引のご案内",
        acd_heading: "お見逃しなく",
        acd_body: "カートはまだ待っています — 特別割引もご用意しました。<br><br>有効期限前に以下のコードをお使いください！",
        acd_code_label: "限定コード",
        acd_discount_info: '{{ params.discount_value }}{% if params.discount_type == "percentage" %}%{% endif %} 割引 · 有効期限 {{ params.discount_expires_at }}',
        acd_cart: "カート",
        acd_cta: "ご注文を完了する",

        rr_title: "ご注文はいかがでしたか？",
        rr_heading: "ご注文はいかがでしたか？",
        rr_dear: "{{ params.customer_name }}様、",
        rr_body: 'ご注文 <strong>#{{ params.display_id }}</strong> をお楽しみいただけていると嬉しいです。<br><br>お客様のご意見は私たちにとって大切です。ぜひ感想をお聞かせください。',
        rr_items: "ご注文の商品",
        rr_cta: "レビューを書く",

        wb_title: "お待ちしています",
        wb_heading: "お待ちしています",
        wb_dear: "{{ params.customer_name }}様、",
        wb_body: '{{ params.last_order_date }}の最後のご注文から{{ params.days_inactive }}日が経ちました。新商品も入荷しています。<br><br>FRAGILEの最新コレクションをチェックしてください。',
        wb_cta: "新着商品を見る",

        pe_title: "割引コードの有効期限が近づいています",
        pe_heading: "期限切れにしないで",
        pe_dear: "{{ params.first_name }}様、",
        pe_body: '限定割引コードの有効期限が<strong>{{ params.days_left }}日</strong>後に切れます！<br><br>お早めにご利用ください。',
        pe_code_label: "割引コード",
        pe_expires: "有効期限 {{ params.expires_at }}",
        pe_cta: "今すぐ購入",
    },
}

// ──── Template builders ────

function buildOrderCanceled(t, locale) {
    const body = [
        heading(t.oc_heading),
        paragraph(`${t.oc_dear}<br><br>${t.oc_body1}<br><br>${t.oc_body2}<br><br>${t.oc_body3}<br><br>${t.oc_body4}`),
        closeTable(),
    ].join("\n")
    return wrap(t.oc_title, body, locale)
}

function buildOrderDelivered(t, locale) {
    const body = [
        heading(t.od_heading),
        paragraph(`${t.od_dear}<br><br>${t.od_body}`),
        closeTable(),
        `
        <table width="100%" style="border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">${t.od_items}</span></td></tr>
                <tr style="height:10px;"></tr>
                <tr><td>
                    {% for item in params.order.items %}
                    <table width="100%" style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <tbody><tr><td style="vertical-align: top;">
                            <span style="font-size:12px;">{{ item.title }} — ${t.od_qty}: {{ item.quantity }} — {{ item.unit_price }}</span>
                        </td></tr></tbody>
                    </table>
                    {% endfor %}
                </td></tr>
            </tbody>
        </table>`,
        `
        <table width="100%" style="background-color: #f3f3f3; padding: 20px; border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr>
                    <td><span style="font-size:12px;">${t.od_total}</span></td>
                    <td align="right"><span style="font-size:12px;font-weight:500;">{{ params.order.total }}</span></td>
                </tr>
            </tbody>
        </table>`,
    ].join("\n")
    return wrap(t.od_title, body, locale)
}

function buildCustomerCreated(t, locale) {
    const body = [heading(t.cc_heading), paragraph(`${t.cc_dear}<br><br>${t.cc_body}`), closeTable()].join("\n")
    return wrap(t.cc_title, body, locale)
}

function buildPromotionNewCustomer(t, locale) {
    const body = [
        heading(t.pn_heading),
        paragraph(`${t.pn_dear}<br><br>${t.pn_body}`),
        closeTable(),
        codeBox(t.pn_code_label, "{{ params.promotion_code }}", t.pn_valid),
        cta("https://fragile.club", t.pn_cta),
    ].join("\n")
    return wrap(t.pn_title, body, locale)
}

function buildShipmentConfirmed(t, locale) {
    const body = [
        heading(t.sc_heading),
        paragraph(`${t.sc_dear}<br><br>${t.sc_body}`),
        closeTable(),
        `
        {% if params.tracking_number != "" %}
        <table width="100%" style="background-color: #f3f3f3; padding: 20px; border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">${t.sc_tracking}</span></td></tr>
                <tr><td><span style="font-size:12px;font-weight:700;letter-spacing:1px;">{{ params.tracking_number }}</span></td></tr>
                {% if params.tracking_url != "" %}
                <tr style="height:15px;"></tr>
                <tr><td>
                    <a href="{{ params.tracking_url }}" style="border:1px solid #111;padding:10px 46px;font-size:12px;text-transform:uppercase;letter-spacing:1px;text-decoration:none;display:inline-block;color:#111;background:none;">${t.sc_track_btn}</a>
                </td></tr>
                {% endif %}
            </tbody>
        </table>
        {% endif %}`,
        `
        <table width="100%" style="border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">${t.sc_items}</span></td></tr>
                <tr style="height:10px;"></tr>
                <tr><td>
                    {% for item in params.order.items %}
                    <table width="100%" style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <tbody><tr><td><span style="font-size:12px;">{{ item.title }} — ${t.sc_qty}: {{ item.quantity }} — {{ item.unit_price }}</span></td></tr></tbody>
                    </table>
                    {% endfor %}
                </td></tr>
            </tbody>
        </table>`,
    ].join("\n")
    return wrap(t.sc_title, body, locale)
}

function buildAbandonedCart(t, locale) {
    const body = [
        heading(t.ac_heading),
        paragraph(`${t.ac_dear}<br><br>${t.ac_body}`),
        closeTable(),
        `
        <table width="100%" style="border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">${t.ac_cart}</span></td></tr>
                <tr style="height:10px;"></tr>
                <tr><td>
                    {% for item in params.items %}
                    <table width="100%" style="margin-bottom: 15px; border-bottom: 1px solid #eee;">
                        <tbody><tr>
                            <td width="18%" style="vertical-align:top;padding-right:20px;padding-bottom:15px;">
                                <img src="{{ item.thumbnail }}" alt="{{ item.title }}" style="max-width:100%;">
                            </td>
                            <td width="62%" style="vertical-align:top;padding-right:20px;">
                                <span style="font-size:12px;">{{ item.title }}<br>${t.ac_qty}: {{ item.quantity }}</span>
                            </td>
                            <td width="20%" align="right" style="vertical-align:top;">
                                <span style="font-size:12px;">{{ item.unit_price }}</span>
                            </td>
                        </tr></tbody>
                    </table>
                    {% endfor %}
                </td></tr>
            </tbody>
        </table>`,
        cta("https://fragile.club/cart/recover/{{ params.cart_id }}", t.ac_cta),
    ].join("\n")
    return wrap(t.ac_title, body, locale)
}

function buildAbandonedCartDiscount(t, locale) {
    const body = [
        heading(t.acd_heading),
        paragraph(`${t.ac_dear}<br><br>${t.acd_body}`),
        closeTable(),
        codeBox(t.acd_code_label, "{{ params.promotion_code }}", t.acd_discount_info),
        `
        <table width="100%" style="border-collapse: collapse; margin-top: 25px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">${t.acd_cart}</span></td></tr>
                <tr style="height:10px;"></tr>
                <tr><td>
                    {% for item in params.items %}
                    <table width="100%" style="margin-bottom: 15px; border-bottom: 1px solid #eee;">
                        <tbody><tr>
                            <td width="18%" style="vertical-align:top;padding-right:20px;padding-bottom:15px;">
                                <img src="{{ item.thumbnail }}" alt="{{ item.title }}" style="max-width:100%;">
                            </td>
                            <td width="62%" style="vertical-align:top;padding-right:20px;">
                                <span style="font-size:12px;">{{ item.title }}<br>${t.ac_qty}: {{ item.quantity }}</span>
                            </td>
                            <td width="20%" align="right" style="vertical-align:top;">
                                <span style="font-size:12px;">{{ item.unit_price }}</span>
                            </td>
                        </tr></tbody>
                    </table>
                    {% endfor %}
                </td></tr>
            </tbody>
        </table>`,
        cta("https://fragile.club/cart/recover/{{ params.cart_id }}", t.acd_cta),
    ].join("\n")
    return wrap(t.acd_title, body, locale)
}

function buildReviewRequest(t, locale) {
    const body = [
        heading(t.rr_heading),
        paragraph(`${t.rr_dear}<br><br>${t.rr_body}`),
        closeTable(),
        `
        <table width="100%" style="border-collapse: collapse; margin-top: 20px;">
            <tbody>
                <tr><td><span style="font-size:12px;font-weight:500;">${t.rr_items}</span></td></tr>
                <tr style="height:10px;"></tr>
                <tr><td>
                    {% for item in params.items %}
                    <table width="100%" style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <tbody><tr>
                            <td width="20%" style="vertical-align:top;padding-right:15px;padding-bottom:10px;">
                                {% if item.thumbnail %}<img src="{{ item.thumbnail }}" alt="{{ item.title }}" style="max-width:100%;">{% endif %}
                            </td>
                            <td style="vertical-align:top;"><span style="font-size:12px;">{{ item.title }}</span></td>
                        </tr></tbody>
                    </table>
                    {% endfor %}
                </td></tr>
            </tbody>
        </table>`,
        cta("https://fragile.club/review", t.rr_cta),
    ].join("\n")
    return wrap(t.rr_title, body, locale)
}

function buildWinback(t, locale) {
    const body = [
        heading(t.wb_heading),
        paragraph(`${t.wb_dear}<br><br>${t.wb_body}`),
        closeTable(),
        cta("https://fragile.club/new-arrivals", t.wb_cta),
    ].join("\n")
    return wrap(t.wb_title, body, locale)
}

function buildPromotionExpiryReminder(t, locale) {
    const body = [
        heading(t.pe_heading),
        paragraph(`${t.pe_dear}<br><br>${t.pe_body}`),
        closeTable(),
        codeBox(t.pe_code_label, "{{ params.promotion_code }}", t.pe_expires),
        cta("https://fragile.club", t.pe_cta),
    ].join("\n")
    return wrap(t.pe_title, body, locale)
}

// ──── Generate all ────

const BUILDERS = {
    "order-canceled.html": buildOrderCanceled,
    "order-delivered.html": buildOrderDelivered,
    "customer-created.html": buildCustomerCreated,
    "promotion-new-customer.html": buildPromotionNewCustomer,
    "shipment-confirmed.html": buildShipmentConfirmed,
    "abandoned-cart.html": buildAbandonedCart,
    "abandoned-cart-discount.html": buildAbandonedCartDiscount,
    "review-request.html": buildReviewRequest,
    "winback.html": buildWinback,
    "promotion-expiry-reminder.html": buildPromotionExpiryReminder,
}

for (const locale of LOCALES) {
    const t = L[locale]
    const dir = path.join(TEMPLATES_DIR, locale)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    for (const [file, builder] of Object.entries(BUILDERS)) {
        const html = builder(t, locale)
        fs.writeFileSync(path.join(dir, file), html, "utf-8")
        console.log(`✅ ${locale}/${file}`)
    }
}

console.log("\nDone! Generated translations for:", LOCALES.join(", "))
console.log("Note: order-placed.html is not auto-generated (uses original user template)")
