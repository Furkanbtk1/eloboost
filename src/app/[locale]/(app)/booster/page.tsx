import { ChevronRightIcon, InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBoosterContext, getBoosterOrders } from "@/features/booster/queries";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Header");
  return { title: t("myPanel"), robots: { index: false } };
}

export default function BoosterPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <BoosterWorkspace />
    </Suspense>
  );
}

async function BoosterWorkspace() {
  const user = await requireArea("/booster");
  const [booster, t, tPanel] = await Promise.all([
    getBoosterContext(user.id),
    getTranslations("Booster"),
    getTranslations("Panel"),
  ]);
  const status = booster?.status ?? "PENDING_APPROVAL";

  const header = (
    <PanelHeader title={tPanel("welcome", { name: user.name ?? user.email })} subtitle={t("subtitle")}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {t("statusLabel")}
        <Badge variant={status === "ACTIVE" ? "default" : status === "SUSPENDED" ? "destructive" : "secondary"}>
          {t(`status.${status}`)}
        </Badge>
      </div>
    </PanelHeader>
  );

  if (!booster || status !== "ACTIVE") {
    return (
      <>
        {header}
        <Alert variant={status === "SUSPENDED" ? "destructive" : "default"}>
          <AlertDescription>{status === "SUSPENDED" ? t("suspendedNotice") : t("pendingNotice")}</AlertDescription>
        </Alert>
      </>
    );
  }

  const [orders, text] = await Promise.all([getBoosterOrders(booster.userId), getOrderText()]);
  const usd = (amount: number) => text.format.number(amount, { style: "currency", currency: "USD" });
  const stats = [
    { label: t("stats.balance"), value: usd(booster.balance) },
    { label: t("stats.lifetime"), value: usd(booster.totalEarnings) },
    { label: t("stats.completed"), value: text.format.number(booster.completedOrders) },
    { label: t("stats.rating"), value: `${text.format.number(booster.rating, { maximumFractionDigits: 1 })} ★` },
  ];

  return (
    <>
      {header}
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>{t("myOrders")}</CardTitle>
            <Button asChild>
              <Link href="/booster/pool">
                <InboxIcon />
                {t("openPool")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
            ) : (
              <ul className="grid gap-2">
                {orders.map((order) => (
                  <li key={order.orderNumber}>
                    <Link
                      href={`/booster/orders/${order.orderNumber}`}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50"
                    >
                      {order.game.logoUrl && (
                        <Image src={order.game.logoUrl} alt="" width={36} height={36} className="rounded-md" />
                      )}
                      <div className="grid min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{text.service(order)}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {order.orderNumber} · {order.server}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums">{usd(order.payoutUsd)}</span>
                      <OrderStatusBadge status={order.status} />
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
