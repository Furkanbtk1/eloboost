import "server-only";

import Stripe from "stripe";

import { CURRENCIES } from "@/features/pricing/currency";
import type { Currency } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { WebhookVerificationError, type PaymentProvider, type PaymentUpdate, type PaymentOrder } from "../types";

/** Stripe Checkout: cards, Apple Pay and Google Pay on a Stripe-hosted page. */

const CHECKOUT_LOCALES = ["en", "tr", "de", "es"] as const satisfies readonly Stripe.Checkout.SessionCreateParams.Locale[];
const SESSION_LIFETIME_SECONDS = 60 * 60; // Stripe's minimum is 30 minutes

function toCurrency(value: string | null): Currency | null {
  return CURRENCIES.find((code) => code === value?.toUpperCase()) ?? null;
}

function toUpdate(session: Stripe.Checkout.Session): PaymentUpdate {
  const outcome =
    session.status === "expired" ? "expired" : session.payment_status === "paid" ? "paid" : "pending";
  return {
    reference: session.id,
    outcome,
    amountCents: session.amount_total,
    currency: toCurrency(session.currency),
    providerPaymentId:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
  };
}

/** Reuses the customer's Stripe customer so saved cards and receipts stay in one place. */
async function ensureCustomer(client: Stripe, customer: PaymentOrder["customer"]): Promise<string> {
  if (customer.stripeCustomerId) return customer.stripeCustomerId;
  const created = await client.customers.create({
    email: customer.email,
    name: customer.name ?? undefined,
    metadata: { userId: customer.id },
  });
  await db.user.update({ where: { id: customer.id }, data: { stripeCustomerId: created.id } });
  return created.id;
}

function createStripeProvider(secretKey: string, webhookSecret: string): PaymentProvider {
  const client = new Stripe(secretKey);

  return {
    id: "stripe",
    gateway: "STRIPE",
    currencies: CURRENCIES,
    countries: null,

    async createPayment({ order, successUrl, cancelUrl, locale }) {
      const session = await client.checkout.sessions.create({
        mode: "payment",
        customer: await ensureCustomer(client, order.customer),
        client_reference_id: order.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: order.currency.toLowerCase(),
              unit_amount: order.totalCents,
              product_data: { name: `${order.orderNumber} · ${order.description}` },
            },
          },
        ],
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
        payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.orderNumber } },
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: CHECKOUT_LOCALES.find((code) => code === locale) ?? "auto",
        expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { reference: session.id, redirectUrl: session.url };
    },

    async fetchStatus(reference) {
      return toUpdate(await client.checkout.sessions.retrieve(reference));
    },

    parseWebhook(rawBody, headers) {
      const signature = headers.get("stripe-signature");
      if (!signature) throw new WebhookVerificationError("Missing Stripe-Signature header");

      let event: Stripe.Event;
      try {
        event = Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (error) {
        throw new WebhookVerificationError(error instanceof Error ? error.message : "Invalid signature");
      }

      switch (event.type) {
        case "checkout.session.completed": // card payments are paid here; delayed methods report "unpaid"
        case "checkout.session.async_payment_succeeded":
        case "checkout.session.expired":
          return toUpdate(event.data.object);
        case "checkout.session.async_payment_failed":
          return { ...toUpdate(event.data.object), outcome: "failed" };
        default:
          return null;
      }
    },
  };
}

export const stripeProvider =
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
    ? createStripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
    : null;
