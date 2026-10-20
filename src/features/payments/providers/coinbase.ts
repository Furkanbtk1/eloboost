import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { CURRENCIES } from "@/features/pricing/currency";
import type { Currency } from "@/generated/prisma/enums";
import { env } from "@/lib/env";

import { WebhookVerificationError, type PaymentOutcome, type PaymentProvider, type PaymentUpdate } from "../types";

/** Coinbase Commerce: crypto payments (BTC, ETH, USDC...) on a Coinbase-hosted page. */

const API_URL = "https://api.commerce.coinbase.com";
const API_VERSION = "2018-03-22";

const chargeSchema = z.object({
  code: z.string(),
  hosted_url: z.url().optional(),
  pricing: z.object({ local: z.object({ amount: z.string(), currency: z.string() }) }).partial().optional(),
  timeline: z.array(z.object({ status: z.string() })).default([]),
});
type Charge = z.infer<typeof chargeSchema>;

const webhookSchema = z.object({ event: z.object({ type: z.string(), data: chargeSchema }) });

/** Latest timeline status -> outcome. UNRESOLVED means under/over-paid and needs review. */
function outcomeOf(charge: Charge): PaymentOutcome {
  switch (charge.timeline.at(-1)?.status) {
    case "COMPLETED":
    case "RESOLVED":
      return "paid";
    case "EXPIRED":
    case "CANCELED":
      return "expired";
    case "UNRESOLVED":
      return "failed";
    default:
      return "pending";
  }
}

function toUpdate(charge: Charge, outcome: PaymentOutcome = outcomeOf(charge)): PaymentUpdate {
  const local = charge.pricing?.local;
  const currency: Currency | null = CURRENCIES.find((code) => code === local?.currency) ?? null;
  return {
    reference: charge.code,
    outcome,
    amountCents: local?.amount ? Math.round(Number(local.amount) * 100) : null,
    currency,
  };
}

function createCoinbaseProvider(apiKey: string, webhookSecret: string): PaymentProvider {
  async function api(path: string, init?: RequestInit): Promise<Charge> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "X-CC-Api-Key": apiKey, "X-CC-Version": API_VERSION, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Coinbase Commerce ${response.status}: ${await response.text()}`);
    return z.object({ data: chargeSchema }).parse(await response.json()).data;
  }

  return {
    id: "coinbase",
    gateway: "COINBASE",
    // Fiat currencies the charge can be priced in.
    currencies: ["USD", "EUR", "GBP"],
    countries: null,

    async createPayment({ order, successUrl, cancelUrl }) {
      const charge = await api("/charges", {
        method: "POST",
        body: JSON.stringify({
          name: `EloBoost ${order.orderNumber}`,
          description: order.description.slice(0, 200),
          pricing_type: "fixed_price",
          local_price: { amount: (order.totalCents / 100).toFixed(2), currency: order.currency },
          metadata: { orderId: order.id, orderNumber: order.orderNumber, customerId: order.customer.id },
          redirect_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });
      if (!charge.hosted_url) throw new Error("Coinbase Commerce did not return a hosted URL");
      return { reference: charge.code, redirectUrl: charge.hosted_url };
    },

    async fetchStatus(reference) {
      return toUpdate(await api(`/charges/${encodeURIComponent(reference)}`));
    },

    parseWebhook(rawBody, headers) {
      // Signature = hex HMAC-SHA256 of the raw body with the webhook shared secret.
      const signature = headers.get("x-cc-webhook-signature") ?? "";
      const expected = createHmac("sha256", webhookSecret).update(rawBody, "utf8").digest("hex");
      const valid =
        signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      if (!valid) throw new WebhookVerificationError("Invalid Coinbase Commerce signature");

      const { event } = webhookSchema.parse(JSON.parse(rawBody));
      switch (event.type) {
        case "charge:confirmed":
        case "charge:resolved":
          return toUpdate(event.data, "paid");
        case "charge:failed":
          return toUpdate(event.data, "failed");
        default:
          return null; // charge:created / pending / delayed don't change the order
      }
    },
  };
}

export const coinbaseProvider =
  env.COINBASE_COMMERCE_API_KEY && env.COINBASE_COMMERCE_WEBHOOK_SECRET
    ? createCoinbaseProvider(env.COINBASE_COMMERCE_API_KEY, env.COINBASE_COMMERCE_WEBHOOK_SECRET)
    : null;
