
export interface StripeCustomerClient {
  customers: {
    create(
      params: { name: string; metadata: Record<string, string> },
      options: { idempotencyKey: string }
    ): Promise<{ id: string }>;
  };
}

export interface StripeCheckoutClient {
  checkout: {
    sessions: {
      create(params: {
        mode: "subscription";
        customer: string;
        line_items: { price: string; quantity: number }[];
        success_url: string;
        cancel_url: string;
        metadata: Record<string, string>;
      }): Promise<{ id: string; url: string | null }>;
    };
  };
}

export type StripeBillingClient = StripeCustomerClient & StripeCheckoutClient;