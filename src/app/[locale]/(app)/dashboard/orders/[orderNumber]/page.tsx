import { ArrowLeftIcon, ShieldCheckIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelSkeleton } from "@/components/layout/panel";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderChat } from "@/features/chat/components/order-chat";
import { getChatState } from "@/features/chat/queries";
import { OpenDispute } from "@/features/disputes/components/open-dispute";
import { getOpenDispute } from "@/features/disputes/queries";
import { canOpenDispute } from "@/features/disputes/rules";
import { ReviewForm, SubmittedReview, TipForm, TipThanks } from "@/features/feedback/components/feedback-cards";
import { getFeedbackState } from "@/features/feedback/queries";
import { CredentialsForm } from "@/features/orders/components/credentials-form";
import { OrderStepper } from "@/features/orders/components/order-stepper";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { getCustomerOrderDetail } from "@/features/orders/queries";
import { EDITABLE_STATUSES } from "@/features/orders/workflow";
import { availableProviders } from "@/features/payments/registry";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { getRequestCountry } from "@/lib/geo";
import { channels, events } from "@/lib/realtime/channels";

type Props = PageProps<"/[locale]/dashboard/orders/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: orderNumber, robots: { index: false } };
}

export default function CustomerOrderPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <CustomerOrder params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerOrder({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requireArea("/dashboard");
  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);
  const order = await getCustomerOrderDetail(orderNumber, user.id);
  if (!order) notFound();
  /** Back from a tip payment: "success" | "cancelled" | "failed". */
  const tipReturn = typeof query.tip === "string" ? query.tip : null;

  const [t, tFeedback, text, chat, dispute, feedback] = await Promise.all([
    getTranslations("Orders"),
    getTranslations("Feedback"),
    getOrderText(),
    getChatState(order.orderNumber),
    order.status === "DISPUTED" ? getOpenDispute(order.orderNumber) : Promise.resolve(null),
    order.status === "COMPLETED" ? getFeedbackState(order.orderNumber, user.id) : Promise.resolve(null),
  ]);
  const tipProviders = feedback && !feedback.tip ? availableProviders(order.currency, await getRequestCountry()) : [];
  const money = (value: number, currency = order.currency) => text.format.number(value, { style: "currency", currency });
  const showChat = chat && (chat.messages.length > 0 || (order.status !== "AWAITING_PAYMENT" && order.status !== "CANCELLED"));
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
      <LiveRefresh channel={channels.order(order.orderNumber)} event={events.orderUpdated} />
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
        <div className="flex flex-wrap items-center gap-2">
          {canOpenDispute(order.status) && <OpenDispute orderNumber={order.orderNumber} />}
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {tipReturn && (
        <Alert variant={tipReturn === "failed" ? "destructive" : "default"}>
          <AlertDescription>{tFeedback(`tip.return.${tipReturn === "success" ? "success" : tipReturn === "failed" ? "failed" : "cancelled"}`)}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6">
          <OrderStepper status={order.status} />
          {notice && (
            <Alert variant={order.status === "CANCELLED" || order.status === "DISPUTED" ? "destructive" : "default"}>
              <AlertDescription>
                {notice}
                {dispute && <span className="mt-1 block text-xs whitespace-pre-wrap opacity-90">“{dispute.reason}”</span>}
              </AlertDescription>
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
          {showChat && (
            <OrderChat
              orderNumber={chat.orderNumber}
              role={chat.role}
              closedReason={chat.closedReason}
              uploadsEnabled={chat.uploadsEnabled}
              initialMessages={chat.messages}
            />
          )}

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

          {feedback && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tFeedback("review.title")}</CardTitle>
                  {!feedback.review && <CardDescription>{tFeedback("review.description")}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {feedback.review ? (
                    <SubmittedReview
                      rating={feedback.review.rating}
                      comment={feedback.review.comment}
                      label={tFeedback("review.stars", { count: feedback.review.rating })}
                    />
                  ) : (
                    <ReviewForm orderNumber={order.orderNumber} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tFeedback("tip.title")}</CardTitle>
                  {!feedback.tip && <CardDescription>{tFeedback("tip.description")}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {feedback.tip ? (
                    <TipThanks label={tFeedback("tip.sent", { amount: money(feedback.tip.amount, feedback.tip.currency) })} />
                  ) : (
                    <TipForm
                      orderNumber={order.orderNumber}
                      options={feedback.tipOptions.map((option) => ({
                        percent: option.percent,
                        label: money(option.amount),
                        usd: Math.round(option.amount * feedback.exchangeRate * 100) / 100,
                      }))}
                      providers={tipProviders}
                      walletUsd={feedback.walletUsd}
                      walletLabel={money(feedback.walletUsd, "USD")}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}

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
