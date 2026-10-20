import { ArrowLeftIcon, ShieldCheckIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelSkeleton } from "@/components/layout/panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CredentialsForm } from "@/features/orders/components/credentials-form";
import { OrderStepper } from "@/features/orders/components/order-stepper";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { getCustomerOrderDetail } from "@/features/orders/queries";
import { EDITABLE_STATUSES } from "@/features/orders/workflow";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/dashboard/orders/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: orderNumber, robots: { index: false } };
}

export default function CustomerOrderPage({ params }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <CustomerOrder params={params} />
    </Suspense>
  );
}

async function CustomerOrder({ params }: Pick<Props, "params">) {
  const user = await requireArea("/dashboard");
  const { orderNumber } = await params;
  const order = await getCustomerOrderDetail(orderNumber, user.id);
  if (!order) notFound();

  const [t, text] = await Promise.all([getTranslations("Orders"), getOrderText()]);
  const date = (value: Date) => text.format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const editable = (EDITABLE_STATUSES as readonly string[]).includes(order.status);
  const options = text.options([order.lpGain, ...order.addOns]);

  const progress = (() => {
    const current = order.currentRank;
    if (!current) return null;
    if (current.done !== undefined) return t("detail.progressDone", { done: current.done, total: order.quantity ?? 0 });
    return t("detail.progressRank", { rank: text.rank(current) });
  })();

  const notices: Partial<Record<OrderStatus, string>> = {
    PAUSED: t("detail.paused"),
    DISPUTED: t("detail.disputed"),
    CANCELLED: t("detail.cancelled"),
    AWAITING_PAYMENT: t("detail.awaitingPayment"),
  };
  const notice = notices[order.status];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {order.game.logoUrl && <Image src={order.game.logoUrl} alt="" width={52} height={52} className="rounded-xl" />}
          <div>
            <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
              <Link href="/dashboard">
                <ArrowLeftIcon />
                {t("detail.back")}
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {order.game.name} <span className="font-mono text-base text-muted-foreground">{order.orderNumber}</span>
            </h1>
            <p className="text-muted-foreground">{text.service(order)}</p>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6">
          <OrderStepper status={order.status} />
          {notice && (
            <Alert variant={order.status === "CANCELLED" || order.status === "DISPUTED" ? "destructive" : "default"}>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {progress && (
            <p className="text-sm">
              <span className="font-medium">{t("detail.progress")}:</span> {progress}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="size-5 text-primary" />
                {t("vault.title")}
              </CardTitle>
              <CardDescription>{t("vault.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {editable ? (
                <CredentialsForm
                  orderNumber={order.orderNumber}
                  username={order.credentials?.username ?? ""}
                  hasPassword={order.credentials?.hasPassword ?? false}
                  notes={order.notes ?? ""}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.status === "AWAITING_PAYMENT" ? t("vault.notYet") : t("vault.removed")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("vault.accessTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.accessLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("vault.accessNone")}</p>
              ) : (
                <ul className="grid gap-1.5 text-sm">
                  {order.accessLog.map((entry) => (
                    <li key={entry.at.toISOString()}>{t("vault.accessEntry", { vpn: entry.vpnLocation, date: date(entry.at) })}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("detail.booster")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {order.booster ? (
                <div className="grid gap-1">
                  <span className="font-medium">{order.booster.name}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
                    {t("detail.boosterStats", {
                      rating: text.format.number(order.booster.rating, { maximumFractionDigits: 1 }),
                      count: order.booster.completedOrders,
                    })}
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground">{t("detail.noBooster")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("detail.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <dl className="grid gap-2">
                <Row label={t("detail.service")} value={text.service(order)} />
                <Row label={t("detail.server")} value={order.server} />
                <Row label={t("detail.options")} value={options.length > 0 ? options.join(", ") : t("detail.none")} />
              </dl>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t("detail.total")}</span>
                <span className="tabular-nums">
                  {text.format.number(order.total, { style: "currency", currency: order.currency })}
                </span>
              </div>
              {order.status === "AWAITING_PAYMENT" && (
                <Button asChild>
                  <Link href={`/checkout/${order.orderNumber}`}>{t("pay")}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
