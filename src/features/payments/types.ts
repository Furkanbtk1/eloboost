import type { Currency, PaymentGateway } from "@/generated/prisma/enums";

/**
 * Payment Service Pattern: every provider implements `PaymentProvider`, the
 * registry decides which ones a customer is offered, and every provider's
 * notifications end up in one place (`applyPaymentUpdate`) that moves orders on.
 */

export type PaymentProviderId = "stripe" | "coinbase" | "sandbox";

export type PaymentOrder = {
  id: string;
  orderNumber: string;
  /** Order total in cents of `currency`. */
  totalCents: number;
  currency: Currency;
  /** Short human description shown by the provider, e.g. "League of Legends · Gold IV → Platinum IV". */
  description: string;
  customer: { id: string; email: string; name: string | null; stripeCustomerId: string | null };
};

export type CreatePaymentInput = {
  order: PaymentOrder;
  /** Absolute URLs the provider sends the customer back to. */
  successUrl: string;
  cancelUrl: string;
  locale: string;
};

export type CreatedPayment = {
  /** Provider-side id, stored as Transaction.gatewayTransactionId. */
  reference: string;
  /** Hosted payment page to send the customer to. */
  redirectUrl: string;
};

export type PaymentOutcome = "paid" | "pending" | "failed" | "expired";

/** A provider notification or status lookup, normalized. */
export type PaymentUpdate = {
  reference: string;
  outcome: PaymentOutcome;
  /** Amount the provider says was charged, in cents; null when it doesn't say. */
  amountCents: number | null;
  currency: Currency | null;
  providerPaymentId?: string | null;
};

/** Thrown by `parseWebhook` when a request is not authentic. */
export class WebhookVerificationError extends Error {}

export interface PaymentProvider {
  id: PaymentProviderId;
  gateway: PaymentGateway;
  /** Currencies it can charge in. */
  currencies: readonly Currency[];
  /** ISO 3166 country codes where it is offered; null = everywhere. */
  countries: readonly string[] | null;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Current state at the provider, used when the customer returns before the webhook arrives. */
  fetchStatus(reference: string): Promise<PaymentUpdate>;
  /**
   * Verifies and normalizes a webhook. Returns null for events that don't
   * change a payment; throws WebhookVerificationError for forged requests.
   */
  parseWebhook?(rawBody: string, headers: Headers): PaymentUpdate | null;
}
