import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ClaimButton } from "@/features/booster/components/claim-button";
import { getOrderPool, requireActiveBooster } from "@/features/booster/queries";
import { getOrderText } from "@/features/orders/describe";
import { channels, events } from "@/lib/realtime/channels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Booster.pool");
  return { title: t("title"), robots: { index: false } };
}

export default function OrderPoolPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <OrderPool />
    </Suspense>
  );
}

async function OrderPool() {
  const booster = await requireActiveBooster("/booster/pool");
  const [orders, t, tOrderType, text] = await Promise.all([
    getOrderPool(booster),
    getTranslations("Booster.pool"),
    getTranslations("OrderType"),
    getOrderText(),
  ]);

  return (
    <>
      <LiveRefresh channel={channels.boosterPool} event={events.poolChanged} />
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => {
            const options = text.options([order.lpGain, ...order.addOns]);
            return (
              <li key={order.orderNumber}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                    {order.game.logoUrl && (
                      <Image src={order.game.logoUrl} alt="" width={48} height={48} className="rounded-lg" />
                    )}
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{text.service(order)}</span>
                        <Badge variant="secondary">{tOrderType(order.orderType)}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {order.game.name} · {t("server", { server: order.server })} ·{" "}
                        <span className="font-mono">{order.orderNumber}</span>
                      </span>
                      {options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {options.map((option) => (
                            <Badge key={option} variant="outline">
                              {option}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {t("earn", { amount: text.format.number(order.payoutUsd, { style: "currency", currency: "USD" }) })}
                      </span>
                      <ClaimButton orderNumber={order.orderNumber} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
