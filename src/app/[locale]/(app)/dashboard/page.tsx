import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { getCustomerOrders } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Orders");
  return { title: t("title"), robots: { index: false } };
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireArea("/dashboard");
  const [orders, t, tPanel, text] = await Promise.all([
    getCustomerOrders(user.id),
    getTranslations("Orders"),
    getTranslations("Panel"),
    getOrderText(),
  ]);

  return (
    <>
      <PanelHeader title={tPanel("welcome", { name: user.name ?? user.email })} subtitle={t("title")} />

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
