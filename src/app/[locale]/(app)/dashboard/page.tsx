import { ChevronRightIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { getCustomerOrders } from "@/features/orders/queries";
import { AddBalanceDialog } from "@/features/payments/components/add-balance-dialog";
import { availableProviders } from "@/features/payments/registry";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getRequestCountry } from "@/lib/geo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Orders");
  return { title: t("title"), robots: { index: false } };
}

export default function DashboardPage({ searchParams }: PageProps<"/[locale]/dashboard">) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/[locale]/dashboard">, "searchParams">) {
  const user = await requireArea("/dashboard");
  const { deposit } = await searchParams;
  const depositReturn = deposit === "success" || deposit === "cancelled" || deposit === "failed" ? deposit : null;
  const depositProviders = availableProviders("USD", await getRequestCountry());
  const [orders, wallet, t, tPanel, tWallet, text] = await Promise.all([
    getCustomerOrders(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { balance: true } }),
    getTranslations("Orders"),
    getTranslations("Panel"),
    getTranslations("Wallet"),
    getOrderText(),
  ]);

  return (
    <>
      <PanelHeader title={tPanel("welcome", { name: user.name ?? user.email })} subtitle={t("title")}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm" title={t("walletHint")}>
            <WalletIcon className="size-4 text-primary" />
            {t("wallet", { balance: text.format.number(wallet?.balance.toNumber() ?? 0, { style: "currency", currency: "USD" }) })}
          </span>
          <AddBalanceDialog providers={depositProviders} />
        </div>
      </PanelHeader>

      {depositReturn && (
        <Alert className="mb-6" variant={depositReturn === "failed" ? "destructive" : "default"}>
          <AlertDescription>{tWallet(`return.${depositReturn}`)}</AlertDescription>
        </Alert>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-10">
            <p className="text-muted-foreground">{t("empty")}</p>
            <Button asChild>
              <Link href={{ pathname: "/", hash: "games" }}>{t("browse")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => {
            const href =
              order.status === "AWAITING_PAYMENT" ? `/checkout/${order.orderNumber}` : `/dashboard/orders/${order.orderNumber}`;
            return (
              <li key={order.orderNumber}>
                <Link
                  href={href}
                  className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  {order.game.logoUrl && (
                    <Image src={order.game.logoUrl} alt="" width={44} height={44} className="rounded-lg" />
                  )}
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{order.game.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
                    </div>
                    <span className="truncate text-sm text-muted-foreground">{text.service(order)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("placedOn", { date: text.format.dateTime(order.createdAt, { dateStyle: "medium" }) })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-medium tabular-nums">
                      {text.format.number(order.total, { style: "currency", currency: order.currency })}
                    </span>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
