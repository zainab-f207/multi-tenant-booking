export const BILLING_UNAVAILABLE_MESSAGE =
  "Stripe is not configured for this environment. Billing actions, including checkout, are currently unavailable.";

export class BillingConfigurationError extends Error {
  constructor() {
    super(BILLING_UNAVAILABLE_MESSAGE);
    this.name = "BillingConfigurationError";
  }
}
