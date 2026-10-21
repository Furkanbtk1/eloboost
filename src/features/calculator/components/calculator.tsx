"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberPicker } from "@/features/calculator/components/number-picker";
import { OptionsPanel } from "@/features/calculator/components/options-panel";
import { OrderSummary } from "@/features/calculator/components/order-summary";
import { RankPicker } from "@/features/calculator/components/rank-picker";
import { normalizeConfig, rankBounds, withCurrent, withOrderType, withTarget } from "@/features/calculator/config";
import { useCalculatorStore } from "@/features/calculator/store";
import type { ExchangeRates } from "@/features/pricing/currency";
import {
  calculateQuote,
  POINTS_BUCKETS,
  QUANTITY_LIMITS,
  stepLabel,
  type PricingCatalog,
  type QuoteInput,
} from "@/features/pricing/engine";
import { cn } from "@/lib/utils";

export function Calculator({ catalog, rates }: { catalog: PricingCatalog; rates: ExchangeRates }) {
  const t = useTranslations("Calculator");
  const tOrderType = useTranslations("OrderType");
  const format = useFormatter();

  const saved = useCalculatorStore((state) => state.configs[catalog.slug]);
  const saveConfig = useCalculatorStore((state) => state.saveConfig);
  useEffect(() => {
    void useCalculatorStore.persist.rehydrate();
  }, []);

  // Links from the service tabs arrive as /boost/<game>#service=WIN: open that service once.
  useEffect(() => {
    const wanted = /^#service=([A-Z]+)$/.exec(window.location.hash)?.[1];
    const orderType = catalog.orderTypes.find((type) => type === wanted);
    if (!orderType) return;
    const current = normalizeConfig(catalog, useCalculatorStore.getState().configs[catalog.slug]);
    if (current.orderType !== orderType) useCalculatorStore.getState().saveConfig(catalog.slug, withOrderType(current, orderType));
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [catalog]);

  const config = useMemo(() => normalizeConfig(catalog, saved), [catalog, saved]);
  const result = useMemo(() => calculateQuote(catalog, config), [catalog, config]);
  const update = (next: QuoteInput) => saveConfig(catalog.slug, next);

  const tiered = catalog.rankSystem === "DIVISION";
  const bounds = rankBounds(catalog);
  const rankName = (value: number) => {
    const step = catalog.steps[value];
    return tiered && step ? stepLabel(step) : format.number(value);
  };

  const serviceLabel = {
    DIVISION: t("lines.climb", { from: rankName(config.current), to: rankName(config.target) }),
    WIN: t("lines.wins", { count: config.quantity, rank: rankName(config.current) }),
    PLACEMENT: t("lines.games", { count: config.quantity, rank: rankName(config.current) }),
    COACHING: t("lines.hours", { count: config.quantity }),
  }[config.orderType];

  const rankControl = (value: number, onChange: (value: number) => void, min: number, max: number, label: string) =>
    tiered ? (
      <RankPicker steps={catalog.steps} value={value} onChange={onChange} min={min} max={max} />
    ) : (
      <NumberPicker label={label} value={value} onChange={onChange} min={min} max={max} step={bounds.step} />
    );

  const isDivision = config.orderType === "DIVISION";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="grid gap-6">
        {catalog.orderTypes.length > 1 && (
          <Tabs
            value={config.orderType}
            onValueChange={(value) => {
              const orderType = catalog.orderTypes.find((type) => type === value);
              if (orderType) update(withOrderType(config, orderType));
            }}
          >
            <TabsList className="w-full">
              {catalog.orderTypes.map((orderType) => (
                <TabsTrigger key={orderType} value={orderType}>
                  {tOrderType(orderType)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {config.orderType !== "COACHING" && (
          <div className={cn("grid gap-6", isDivision && "md:grid-cols-2")}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {config.orderType === "PLACEMENT"
                    ? t("lastSeasonRank")
                    : tiered
                      ? t("currentRank")
                      : t("currentRating")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                {rankControl(
                  config.current,
                  (value) => update(withCurrent(catalog, config, value)),
                  bounds.min,
                  isDivision ? bounds.max - bounds.step : bounds.max,
                  t("currentRating"),
                )}
                {isDivision && tiered && (
                  <div className="grid gap-2">
                    <span className="text-sm text-muted-foreground">{t("currentPoints")}</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {POINTS_BUCKETS.map((bucket) => (
                        <button
                          key={bucket.key}
                          type="button"
                          aria-pressed={config.currentPoints === bucket.key}
                          onClick={() => update({ ...config, currentPoints: bucket.key })}
                          className={cn(
                            "rounded-md border py-1.5 text-xs font-medium tabular-nums transition-colors",
                            config.currentPoints === bucket.key
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-accent",
                          )}
                        >
                          {bucket.key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isDivision && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tiered ? t("desiredRank") : t("desiredRating")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {rankControl(
                    config.target,
                    (value) => update(withTarget(catalog, config, value)),
                    config.current + bounds.step,
                    bounds.max,
                    t("desiredRating"),
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {config.orderType !== "DIVISION" && (
          <Card>
            <CardContent className="pt-6">
              <NumberPicker
                label={t(`quantity.${config.orderType}`)}
                value={config.quantity}
                onChange={(quantity) => update({ ...config, quantity })}
                min={QUANTITY_LIMITS[config.orderType].min}
                max={QUANTITY_LIMITS[config.orderType].max}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <OptionsPanel catalog={catalog} config={config} onChange={update} />
          </CardContent>
        </Card>
      </div>

      <OrderSummary catalog={catalog} config={config} result={result} rates={rates} serviceLabel={serviceLabel} />
    </div>
  );
}
