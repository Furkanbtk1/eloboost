import { FlaskConicalIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelSkeleton } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SandboxButtons } from "@/features/payments/components/sandbox-buttons";
import { sandboxEnabled } from "@/features/payments/providers/sandbox";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";

type Props = PageProps<"/[locale]/checkout/sandbox/[reference]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Payments.sandbox");
  return { title: t("title"), robots: { index: false } };
}

/** Development-only stand-in for a provider's hosted payment page. */
export default function SandboxPaymentPage({ params }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <SandboxPayment params={params} />
    </Suspense>
  );
}

async function SandboxPayment({ params }: Pick<Props, "params">) {
  if (!sandboxEnabled) notFound();
  const user = await requireArea("/checkout");
  const { reference } = await params;

  const payment = await db.transaction.findFirst({
    where: { gateway: "SANDBOX", gatewayTransactionId: reference, userId: user.id },
    select: { type: true, status: true, amount: true, currency: true, order: { select: { orderNumber: true } } },
  });
  if (!payment || (!payment.order && payment.type !== "DEPOSIT")) notFound();

  const [t, format] = await Promise.all([getTranslations("Payments.sandbox"), getFormatter()]);
  const amount = format.number(payment.amount.toNumber(), { style: "currency", currency: payment.currency });

  return (
    <Card className="mx-auto max-w-lg border-dashed border-amber-500/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConicalIcon className="size-5 text-amber-500" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("body", { orderNumber: payment.order?.orderNumber ?? "WALLET" })}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-3xl font-bold tabular-nums">{amount}</p>
        {payment.status === "PENDING" ? (
          <SandboxButtons reference={reference} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("done")}</p>
            <Button asChild variant="outline" className="justify-self-start">
              <Link
                href={
                  !payment.order
                    ? "/dashboard"
                    : payment.type === "TIP"
                      ? `/dashboard/orders/${payment.order.orderNumber}`
                      : `/checkout/${payment.order.orderNumber}`
                }
              >
                {payment.order?.orderNumber ?? "WALLET"}
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
