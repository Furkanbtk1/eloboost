import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelSkeleton } from "@/components/layout/panel";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DisputeResolutionForm } from "@/features/admin/components/dispute-resolution";
import { getAdminOrder } from "@/features/admin/orders";
import { OrderChat } from "@/features/chat/components/order-chat";
import { getChatState } from "@/features/chat/queries";
import { getOrderDisputes } from "@/features/disputes/queries";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { channels, events } from "@/lib/realtime/channels";

type Props = PageProps<"/[locale]/admin/orders/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: orderNumber, robots: { index: false } };
}

export default function AdminOrderPage({ params }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminOrder params={params} />
    </Suspense>
  );
}

async function AdminOrder({ params }: Pick<Props, "params">) {
  const user = await requireArea("/admin/orders");
  const { orderNumber } = await params;
  const order = await getAdminOrder(orderNumber);
  if (!order) notFound();

  const [disputes, chat, t, tDispute, tType, tRole, text, format] = await Promise.all([
    getOrderDisputes(order.id),
    getChatState(order.orderNumber),
    getTranslations("Admin.orders.detail"),
    getTranslations("Admin.disputes"),
    getTranslations("Admin.transactionType"),
    getTranslations("Roles"),
    getOrderText(),
    getFormatter(),
  ]);
  const money = (value: number, currency = order.currency) => format.number(value, { style: "currency", currency });
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const open = disputes.find((dispute) => dispute.status === "OPEN");
  const timeline = (["createdAt", "paidAt", "assignedAt", "startedAt", "completedAt", "cancelledAt"] as const).flatMap((key) => {
    const at = order.timeline[key];
    return at ? [{ key, at }] : [];
  });

  return (
    <div className="grid gap-6">
      <LiveRefresh channel={channels.order(order.orderNumber)} event={events.orderUpdated} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {order.game.logoUrl && <Image src={order.game.logoUrl} alt="" width={52} height={52} className="rounded-xl" />}
          <div>
            <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
              <Link href="/admin/orders">
                <ArrowLeftIcon />
                {t("back")}
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {order.game.name} <span className="font-mono text-base text-muted-foreground">{order.orderNumber}</span>
            </h1>
            <p className="text-muted-foreground">
              {text.service(order)} · {order.server} · {money(order.total)}
            </p>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {open && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlertIcon className="size-5 text-destructive" />
              {tDispute("openTitle")}
            </CardTitle>
            <CardDescription>
              {tDispute("openedBy", { name: open.openedBy.name, role: tRole(open.openedBy.role), date: date(open.createdAt) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{open.reason}</p>
            {user.role === "ADMIN" ? (
              <DisputeResolutionForm
                disputeId={open.id}
                currency={order.currency}
                total={order.total}
                boosterCut={order.boosterCut}
                hasBooster={order.booster !== null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{tDispute("adminOnly")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
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
              <CardTitle className="text-base">{t("transactions")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {order.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
              ) : (
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <tbody>
                    {order.transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-t first:border-0">
                        <td className="py-2">{tType(transaction.type)}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {transaction.gateway} · {transaction.status}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{transaction.user}</td>
                        <td className="py-2 text-right tabular-nums">{money(transaction.amount, transaction.currency)}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">{date(transaction.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {disputes.some((dispute) => dispute.status === "RESOLVED") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tDispute("history")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {disputes
                  .filter((dispute) => dispute.status === "RESOLVED")
                  .map((dispute) => (
                    <div key={dispute.id} className="grid gap-1 border-t pt-3 first:border-0 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {dispute.resolution && <Badge>{tDispute(`resolutions.${dispute.resolution}`)}</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {dispute.resolvedBy} · {dispute.resolvedAt && date(dispute.resolvedAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{dispute.reason}</p>
                      {dispute.adminNote && <p>{dispute.adminNote}</p>}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("people")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Person label={t("customer")} person={order.customer} linkable={user.role === "ADMIN"} />
              {order.booster ? (
                <Person label={t("booster")} person={order.booster} linkable={user.role === "ADMIN"} />
              ) : (
                <p className="text-muted-foreground">{t("noBooster")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("money")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Row label={t("total")} value={money(order.total)} />
                <Row label={t("boosterCut")} value={money(order.boosterCut)} />
                <Row label={t("platformCut")} value={money(order.platformCut)} />
                {order.currency !== "USD" && (
                  <Row label={t("rate")} value={`1 ${order.currency} = ${format.number(order.exchangeRate, { maximumFractionDigits: 6 })} USD`} />
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                {timeline.map(({ key, at }) => (
                  <Row key={key} label={t(`events.${key}`)} value={date(at)} />
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("access")}</CardTitle>
              <CardDescription>{order.hasCredentials ? t("credentialsStored") : t("credentialsNone")}</CardDescription>
            </CardHeader>
            <CardContent>
              {order.accessLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noAccess")}</p>
              ) : (
                <ul className="grid gap-1.5 text-xs">
                  {order.accessLog.map((entry) => (
                    <li key={entry.at.toISOString()} className="grid">
                      <span>
                        {entry.booster} · {entry.vpnLocation}
                      </span>
                      <span className="text-muted-foreground">
                        {date(entry.at)} · {entry.ipAddress ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Person({ label, person, linkable }: { label: string; person: { id: string; name: string; email: string }; linkable: boolean }) {
  return (
    <div className="grid">
      <span className="text-xs text-muted-foreground">{label}</span>
      {linkable ? (
        <Link href={`/admin/users/${person.id}`} className="font-medium hover:underline">
          {person.name}
        </Link>
      ) : (
        <span className="font-medium">{person.name}</span>
      )}
      <span className="text-xs text-muted-foreground">{person.email}</span>
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
