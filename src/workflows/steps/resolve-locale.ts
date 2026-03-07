import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Step: Extract the customer's preferred locale from order/customer/cart data.
 * 
 * Priority:
 * 1. customer.metadata.preferred_locale (set by storefront)
 * 2. cart.metadata.locale (set by storefront on cart)
 * 3. null (use default template)
 * 
 * Storefront should set this when user selects language:
 *   POST /store/customers/me { metadata: { preferred_locale: "zh" } }
 *   or
 *   POST /store/carts/:id { metadata: { locale: "vi" } }
 */
export const resolveLocaleStep = createStep(
    "resolve-locale",
    async (input: {
        customerMetadata?: Record<string, any> | null
        cartMetadata?: Record<string, any> | null
        orderMetadata?: Record<string, any> | null
    }) => {
        const locale =
            input.customerMetadata?.preferred_locale ||
            input.cartMetadata?.locale ||
            input.orderMetadata?.locale ||
            null

        return new StepResponse(locale)
    }
)
