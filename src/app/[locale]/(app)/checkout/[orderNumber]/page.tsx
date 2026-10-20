import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getOrderText } from "@/features/orders/describe";
import { getCustomerOrder } from "@/features/orders/queries";
import { PaymentConfirming } from "@/features/payments/components/payment-confirming";
import { PaymentMethods } from "@/features/payments/components/payment-methods";
import { availableProviders } from "@/features/payments/registry";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { getRequestCountry } from "@/lib/geo";

type Props = PageProps<"/[locale]/checkout/[orderNumber]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Checkout");
  return { title: t("title"), robots: { index: false } };
}

export default function CheckoutPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Checkout params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Checkout({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requireArea("/checkout");
  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);
  const order = await getCustomerOrder(orderNumber, user.id);
  if (!order) notFound();
  /** Set by the provider redirect: "success" | "cancelled" | "failed". */
  const paymentReturn = typeof query.payment === "string" ? query.payment : null;
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  // Every later status except a cancellation means the order was paid.
  const wasPaid = !awaitingPayment && order.status !== "CANCELLED";
  const providers = awaitingPayment ? availableProviders(order.currency, await getRequestCountry()) : [];

  const [t, tPay, tOrderType, text] = await Promise.all([
    getTranslations("Checkout"),
    getTranslations("Payments"),
    getTranslations("OrderType"),
    getOrderText(),
  ]);
  const money = (amount: number) => text.format.number(amount, { style: "currency", currency: order.currency });
  const service = text.service(order);
  const options = text.options([order.lpGain, ...order.addOns]);

  return (
    <div className="max-w-2xl">
      <PanelHeader title={t("title")} subtitle={t("order", { number: order.orderNumber })}>
        <OrderStatusBadge status={order.status} />
      </PanelHeader>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            {order.game.logoUrl && <Image src={order.game.logoUrl} alt="" width={48} height={48} className="rounded-lg" />}
            <div>
              <CardTitle>{order.game.name}</CardTitle>
              <CardDescription>{tOrderType(order.orderType)}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <dl className="grid gap-2">
              <Row label={t("service")} value={service} />
              <Row label={t("server")} value={order.server} />
              <Row label={t("options")} value={options.length > 0 ? options.join(", ") : t("none")} />
            </dl>
            <Separator />
            <dl className="grid gap-2">
              <Row label={t("subtotal")} value={money(order.subtotal)} />
              {order.discount > 0 && (
                <Row label={`${t("discount")}${order.promoCode ? ` (${order.promoCode})` : ""}`} value={`−${money(order.discount)}`} />
              )}
              <div className="flex justify-between gap-4 text-base font-semibold">
                <dt>{t("total")}</dt>
                <dd className="tabular-nums">{money(order.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {awaitingPayment && (
          <Card>
            <CardHeader>
              <CardTitle>{tPay("title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {paymentReturn === "success" ? (
                // Back from the provider: wait for the confirmation instead of offering a second payment.
                <PaymentConfirming />
              ) : (
                <>
                  {(paymentReturn === "cancelled" || paymentReturn === "failed") && (
                    <Alert variant={paymentReturn === "failed" ? "destructive" : "default"}>
                      <AlertDescription>{tPay(paymentReturn)}</AlertDescription>
                    </Alert>
                  )}
                  <PaymentMethods orderNumber={order.orderNumber} providers={providers} amount={money(order.total)} />
                  <Button asChild variant="ghost" className="justify-self-start">
                    <Link href={`/boost/${order.game.slug}`}>{t("changeOrder")}</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {wasPaid && (
          <Card className="border-emerald-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleCheckIcon className="size-5 text-emerald-500" />
                {tPay("paidTitle")}
              </CardTitle>
              <CardDescription>{tPay("paidBody")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/dashboard/orders/${order.orderNumber}`}>{tPay("toPanel")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}
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
