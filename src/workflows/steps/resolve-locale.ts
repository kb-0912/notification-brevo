import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Step: Extract the customer's preferred locale from order/customer/cart data.
 * 
 * Priority:
 * 1. customer.metadata.preferred_locale (set by storefront)
 * 2. cart.metadata.locale (set by storefront on cart)
 * 3. order.metadata.locale
 * 4. Infer from phone prefix (e.g. +84 → vi)
 * 5. Infer from shipping address country_code (e.g. vn → vi)
 * 6. null (use default template)
 * 
 * Storefront should set this when user selects language:
 *   POST /store/customers/me { metadata: { preferred_locale: "zh" } }
 *   or
 *   POST /store/carts/:id { metadata: { locale: "vi" } }
 */

// Phone prefix → locale mapping
const PHONE_PREFIX_TO_LOCALE: Record<string, string> = {
    "+84": "vi",   // Vietnam
    "+66": "th",   // Thailand
    "+82": "ko",   // South Korea
    "+81": "ja",   // Japan
    "+86": "zh",   // China
    "+886": "zh",  // Taiwan
    "+852": "zh",  // Hong Kong
    "+65": "en",   // Singapore (English)
    "+60": "ms",   // Malaysia
    "+62": "id",   // Indonesia
    "+63": "en",   // Philippines (English)
}

// Country code → locale mapping
const COUNTRY_TO_LOCALE: Record<string, string> = {
    "vn": "vi",
    "th": "th",
    "kr": "ko",
    "jp": "ja",
    "cn": "zh",
    "tw": "zh",
    "hk": "zh",
    "id": "id",
    "my": "ms",
}

function inferLocaleFromPhone(phone?: string | null): string | null {
    if (!phone) return null
    // Sort by prefix length descending to match longer prefixes first (+886 before +8)
    const sorted = Object.entries(PHONE_PREFIX_TO_LOCALE).sort((a, b) => b[0].length - a[0].length)
    for (const [prefix, locale] of sorted) {
        if (phone.startsWith(prefix)) return locale
    }
    return null
}

export const resolveLocaleStep = createStep(
    "resolve-locale",
    async (input: {
        customerMetadata?: Record<string, any> | null
        cartMetadata?: Record<string, any> | null
        orderMetadata?: Record<string, any> | null
        phone?: string | null
        countryCode?: string | null
    }) => {
        const locale =
            input.customerMetadata?.preferred_locale ||
            input.cartMetadata?.locale ||
            input.orderMetadata?.locale ||
            inferLocaleFromPhone(input.phone) ||
            (input.countryCode ? COUNTRY_TO_LOCALE[input.countryCode.toLowerCase()] : null) ||
            null

        return new StepResponse(locale)
    }
)

