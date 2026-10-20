import "server-only";

import type { Currency, PaymentGateway } from "@/generated/prisma/enums";

import { coinbaseProvider } from "./providers/coinbase";
import { sandboxProvider } from "./providers/sandbox";
import { stripeProvider } from "./providers/stripe";
import type { PaymentProvider, PaymentProviderId } from "./types";

/**
 * Configured providers in display order. To add one (PayPal, PayTR, Iyzico,
 * NOWPayments, Xsolla...), implement PaymentProvider in ./providers and list it
 * here with its currencies/countries; checkout and webhooks pick it up.
 */
const providers: PaymentProvider[] = [stripeProvider, coinbaseProvider, sandboxProvider].filter(
  (provider) => provider !== null,
);

export function getProvider(id: string): PaymentProvider | undefined {
  return providers.find((provider) => provider.id === id);
}

export function getProviderByGateway(gateway: PaymentGateway): PaymentProvider | undefined {
  return providers.find((provider) => provider.gateway === gateway);
}

/** Providers a customer may use for an order in `currency`, from `country` (ISO code, null if unknown). */
export function availableProviders(currency: Currency, country: string | null): PaymentProviderId[] {
  return providers
    .filter(
      (provider) =>
        provider.currencies.includes(currency) &&
        (provider.countries === null || (country !== null && provider.countries.includes(country))),
    )
    .map((provider) => provider.id);
}
