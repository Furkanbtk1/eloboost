import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelSkeleton } from "@/components/layout/panel";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressForm } from "@/features/booster/components/progress-form";
import { RevealCredentials } from "@/features/booster/components/reveal-credentials";
import { StatusActions } from "@/features/booster/components/status-actions";
import { getBoosterOrder, requireActiveBooster } from "@/features/booster/queries";
import { OrderChat } from "@/features/chat/components/order-chat";
import { getChatState } from "@/features/chat/queries";
import { OpenDispute } from "@/features/disputes/components/open-dispute";
import { getOpenDispute } from "@/features/disputes/queries";
import { canOpenDispute } from "@/features/disputes/rules";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { allowedTransitions, CREDENTIAL_STATUSES } from "@/features/orders/workflow";
import { getPricingCatalog } from "@/features/pricing/catalog";
import { maxRating, stepLabel } from "@/features/pricing/engine";
import { Link } from "@/i18n/navigation";
import { channels, events } from "@/lib/realtime/channels";

type Props = PageProps<"/[locale]/booster/orders/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: orderNumber, robots: { index: false } };
}

export default function BoosterOrderPage({ params }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <BoosterOrder params={params} />
    </Suspense>
  );
}

async function BoosterOrder({ params }: Pick<Props, "params">) {
  const booster = await requireActiveBooster("/booster");
  const { orderNumber } = await params;
  const order = await getBoosterOrder(orderNumber, booster.userId);
  if (!order) notFound();

  const [t, text, catalog, chat, dispute] = await Promise.all([
    getTranslations("Booster.workspace"),
    getOrderText(),
    getPricingCatalog(order.game.slug),
    getChatState(order.orderNumber),
    order.status === "DISPUTED" ? getOpenDispute(order.orderNumber) : Promise.resolve(null),
  ]);
  const date = (value: Date) => text.format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const options = text.options([order.lpGain, ...order.addOns]);
  const canReport = order.status === "IN_PROGRESS" || order.status === "PAUSED";
  const credentialsOpen = (CREDENTIAL_STATUSES as readonly string[]).includes(order.status);

  // What the progress control offers depends on the service.
  const progress = (() => {
    if (!catalog) return null;
    if (order.orderType !== "DIVISION") {
      return { kind: "number" as const, label: t("progressDone"), min: 0, max: order.quantity ?? 0, value: order.currentRank?.done ?? 0 };
    }
    if (catalog.rankSystem === "RATING") {
      return {
        kind: "number" as const,
        label: t("progressRating"),
        min: 0,
        max: maxRating(catalog),
        value: order.currentRank?.rating ?? order.startRank.rating ?? 0,
      };
    }
    const from = order.startRank.position ?? 0;
    const to = order.desiredRank.position ?? from;
    return {
      kind: "rank" as const,
      label: t("progressRank"),
      options: catalog.steps
        .filter((step) => step.position >= from && step.position <= to)
        .map((step) => ({ value: step.position, label: stepLabel(step) })),
      value: order.currentRank?.position ?? from,
    };
  })();

  return (
    <div className="grid gap-6">
      <LiveRefresh channel={channels.order(order.orderNumber)} event={events.orderUpdated} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
            <Link href="/booster">
              <ArrowLeftIcon />
              {t("back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{text.service(order)}</h1>
          <p className="text-muted-foreground">
            {order.game.name} · {order.server} · <span className="font-mono">{order.orderNumber}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canOpenDispute(order.status) && <OpenDispute orderNumber={order.orderNumber} />}
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {order.status === "DISPUTED" && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("disputed")}
            {dispute && <span className="mt-1 block text-xs whitespace-pre-wrap opacity-90">“{dispute.reason}”</span>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("status")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <StatusActions orderNumber={order.orderNumber} transitions={allowedTransitions(order.status)} />
              {canReport && progress && (
                <div className="grid gap-2">
                  <span className="text-sm font-medium">{t("progress")}</span>
                  <ProgressForm orderNumber={order.orderNumber} {...progress} />
                </div>
              )}
            </CardContent>
          </Card>

          {chat && (
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
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRoundIcon className="size-4 text-primary" />
                {t("credentials")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!credentialsOpen ? (
                <p className="text-sm text-muted-foreground">{t("credentialsClosed")}</p>
              ) : order.hasCredentials ? (
                <RevealCredentials orderNumber={order.orderNumber} />
              ) : (
                <p className="text-sm text-muted-foreground">{t("credentialsMissing")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("details")}</CardTitle>
              <CardDescription>
                {text.format.number(order.payoutUsd, { style: "currency", currency: "USD" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {options.length > 0 && <p>{options.join(", ")}</p>}
              <div className="grid gap-1">
                <span className="font-medium">{t("notes")}</span>
                <p className="whitespace-pre-wrap text-muted-foreground">{order.notes ?? t("noNotes")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("accessTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {order.accessLog.map((entry, index) => (
                  <li key={index}>{t("accessEntry", { vpn: entry.vpnLocation, date: date(entry.at) })}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
