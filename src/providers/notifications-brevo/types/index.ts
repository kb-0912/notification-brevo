export interface BrevoProviderConfig {
    apiKey: string;
    from: string;
    orderPlacedTemplateId: string;
    orderCanceledTemplateId: string;
    customerCreatedTemplateId: string;
    abandonedCartTemplateId: string;
    abandonedCartIntervals: string
    abandoned_cart: {
      first: {
        delay: string
      },
      second:  {
        delay: string
      },
      third:  {
        delay: string
      },
    }
  }
  