import "server-only";

import { randomUUID } from "node:crypto";

import { hasLocale } from "next-intl";

import { CURRENCIES } from "@/features/pricing/currency";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

import type { PaymentProvider } from "../types";

/**
 * Simulated provider for development: its "hosted page" is our own
 * /checkout/sandbox/[reference] page, where the tester picks the outcome.
 * Hard-disabled in production regardless of PAYMENTS_SANDBOX.
 */
export const sandboxEnabled = env.PAYMENTS_SANDBOX && env.NODE_ENV !== "production";

export const sandboxProvider: PaymentProvider | null = sandboxEnabled
  ? {
      id: "sandbox",
      gateway: "SANDBOX",
      currencies: CURRENCIES,
      countries: null,

      async createPayment({ locale }) {
        const reference = `sbx_${randomUUID()}`;
        const path = getPathname({
          href: `/checkout/sandbox/${reference}`,
          locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
        });
        return { reference, redirectUrl: new URL(path, env.NEXT_PUBLIC_APP_URL).toString() };
      },

      // The outcome is applied directly by the sandbox page, so there is nothing to look up.
      async fetchStatus(reference) {
        return { reference, outcome: "pending", amountCents: null, currency: null };
      },
    }
  : null;
