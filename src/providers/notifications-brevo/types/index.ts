export interface BrevoProviderConfig {
  apiKey: string
  from: string
  senderName?: string

  // Template IDs (env-level fallbacks, overridden by DB settings)
  orderPlacedTemplateId?: string
  orderCanceledTemplateId?: string
  orderDeliveredTemplateId?: string
  customerCreatedTemplateId?: string
  promotionNewCustomerTemplateId?: string
  shipmentConfirmedTemplateId?: string
  abandonedCartTemplateId?: string
}