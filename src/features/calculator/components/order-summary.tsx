"use client";

import { LockIcon, TagIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AnimatedPrice } from "@/features/calculator/components/animated-price";
import { useModifierText } from "@/features/calculator/components/options-panel";
import { useCalculatorStore } from "@/features/calculator/store";
import { checkPromoAction, createOrderAction } from "@/features/orders/actions";
import { CURRENCIES, DEFAULT_CURRENCY_BY_LOCALE, type ExchangeRates } from "@/features/pricing/currency";
import { applyPromo, convertCents, type PricingCatalog, type QuoteInput, type QuoteResult } from "@/features/pricing/engine";
import type { Currency } from "@/generated/prisma/enums";
import { getPathname } from "@/i18n/navigation";
import { useUIStore } from "@/stores/ui-store";

type Props = {
  catalog: PricingCatalog;
  config: QuoteInput;
  result: QuoteResult;
  rates: ExchangeRates;
  /** One-line description of the selected service, e.g. "Gold IV → Platinum IV". */
  serviceLabel: string;
};

export function OrderSummary({ catalog, config, result, rates, serviceLabel }: Props) {
  const t = useTranslations("Calculator");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const text = useModifierText();
  const [isPending, startTransition] = useTransition();
  const [promoInput, setPromoInput] = useState("");

  const promo = useCalculatorStore((state) => state.promo);
  const setPromo = useCalculatorStore((state) => state.setPromo);
  const currency: Currency = useUIStore((state) => state.currency) ?? DEFAULT_CURRENCY_BY_LOCALE[locale] ?? "USD";
  const setCurrency = useUIStore((state) => state.setCurrency);

  const money = (usdCents: number) =>
    format.number(convertCents(usdCents, rates[currency]) / 100, { style: "currency", currency });

  const quote = result.ok ? result.quote : null;
  const promoResult = quote ? applyPromo(quote.subtotalCents, promo) : null;
  // A code whose minimum isn't reached stays visible but isn't applied or sent.
  const activePromo = promoResult?.ok && promo ? promo : null;
  const totalUsd = promoResult?.ok ? promoResult.totalCents : (quote?.subtotalCents ?? 0);
  const totalCents = convertCents(totalUsd, rates[currency]);

  const applyCode = () =>
    startTransition(async () => {
      const response = await checkPromoAction(locale, promoInput);
      if (!response.success) return void toast.error(response.message);
      setPromo(response.data);
      setPromoInput("");
      toast.success(t("promo.applied", { code: response.data.code }));
    });

  const checkout = () =>
    startTransition(async () => {
      const response = await createOrderAction(locale, {
        gameSlug: catalog.slug,
        config,
        currency,
        promoCode: activePromo?.code,
        expectedTotalCents: totalCents,
      });
      if (response.success) return router.push(response.data.redirectTo);

      if (response.code === 401) {
        const callbackUrl = window.location.pathname;
        return router.push(getPathname({ href: { pathname: "/login", query: { callbackUrl } }, locale }));
      }
      toast.error(response.message);
      if (response.code === 409) router.refresh(); // reload prices and rates
    });

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>{t("summary.title")}</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 text-sm">
        {quote ? (
          <dl className="grid gap-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{serviceLabel}</dt>
              <dd className="tabular-nums">{money(quote.serviceCents)}</dd>
            </div>
            {quote.flatFeeCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("summary.flatFee")}</dt>
                <dd className="tabular-nums">{money(quote.flatFeeCents)}</dd>
              </div>
            )}
            {quote.modifiers
              .filter((line) => line.amountCents !== 0)
              .map((line) => (
                <div key={`${line.category}-${line.key}`} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {line.category === "SERVER"
                      ? t("summary.server", { server: line.key })
                      : text.label(catalog.modifiers.find((modifier) => modifier.key === line.key) ?? { key: line.key, label: line.key })}{" "}
                    <span className="text-xs">({text.percent(line.percentBp)})</span>
                  </dt>
                  <dd className="tabular-nums">
                    {line.amountCents > 0 ? "+" : "−"}
                    {money(Math.abs(line.amountCents))}
                  </dd>
                </div>
              ))}
            {activePromo && promoResult?.ok && (
              <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                <dt>{t("summary.discount", { code: activePromo.code })}</dt>
                <dd className="tabular-nums">−{money(promoResult.discountCents)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-destructive">{!result.ok && t(`errors.quote.${result.error}`)}</p>
        )}

        <Separator />

        <div className="flex items-end justify-between gap-4">
          <div className="grid gap-1">
            <span className="text-muted-foreground">{t("summary.total")}</span>
            <Select
              value={currency}
              onValueChange={(value) => {
                const next = CURRENCIES.find((code) => code === value);
                if (next) setCurrency(next);
              }}
            >
              <SelectTrigger size="sm" aria-label={t("summary.currency")} className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AnimatedPrice cents={totalCents} currency={currency} locale={locale} className="text-3xl font-bold tabular-nums" />
        </div>

        {promo ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
            <span className="flex items-center gap-2">
              <TagIcon className="size-4 text-primary" />
              <span className="font-medium">{promo.code}</span>
            </span>
            <Button variant="ghost" size="icon" aria-label={t("promo.remove")} onClick={() => setPromo(null)}>
              <XIcon />
            </Button>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (promoInput.trim()) applyCode();
            }}
          >
            <Input
              value={promoInput}
              onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
              placeholder={t("promo.placeholder")}
              aria-label={t("promo.label")}
              maxLength={30}
            />
            <Button type="submit" variant="outline" disabled={isPending || !promoInput.trim()}>
              {t("promo.apply")}
            </Button>
          </form>
        )}
        {promo && promoResult && !promoResult.ok && (
          <p className="text-xs text-destructive">
            {t("errors.promoMinAmount", {
              amount: format.number(convertCents(promoResult.minSubtotalCents, rates[currency]) / 100, {
                style: "currency",
                currency,
              }),
            })}
          </p>
        )}
      </CardContent>

      <CardFooter className="grid gap-2">
        <Button size="lg" className="w-full" disabled={!quote || isPending} onClick={checkout}>
          {t("checkout")}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <LockIcon className="size-3" />
          {t("summary.verified")}
        </p>
      </CardFooter>
    </Card>
  );
}
