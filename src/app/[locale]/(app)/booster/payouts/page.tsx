import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBooster } from "@/features/booster/queries";
import { CancelPayoutButton, PayoutDetailsForm, PayoutRequestForm } from "@/features/payouts/components/payout-forms";
import { getBoosterPayouts } from "@/features/payouts/queries";
import type { PayoutStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Payouts");
  return { title: t("title"), robots: { index: false } };
}

export default function BoosterPayoutsPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <BoosterPayouts />
    </Suspense>
  );
}

const STATUS_VARIANT: Record<PayoutStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "outline",
  REJECTED: "destructive",
  PAID: "default",
};

async function BoosterPayouts() {
  const booster = await requireActiveBooster("/booster/payouts");
  const [payouts, t, format] = await Promise.all([
    getBoosterPayouts(booster.userId),
    getTranslations("Payouts"),
    getFormatter(),
  ]);
  const usd = (value: number) => format.number(value, { style: "currency", currency: "USD" });
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

  const disabledReason = payouts.open
    ? t("request.alreadyOpen")
    : !payouts.details
      ? t("request.needDetails")
      : payouts.balance < payouts.minPayout
        ? t("request.belowMinimum", { min: usd(payouts.minPayout), balance: usd(payouts.balance) })
        : null;

  return (
    <>
      <Button asChild variant="link" className="mb-2 h-auto p-0 text-muted-foreground">
        <Link href="/booster">
          <ArrowLeftIcon />
          {t("back")}
        </Link>
      </Button>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardDescription>{t("balance")}</CardDescription>
                <CardTitle className="text-2xl">{usd(payouts.balance)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t("minimum")}</CardDescription>
                <CardTitle className="text-2xl">{usd(payouts.minPayout)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("request.title")}</CardTitle>
              {payouts.details && <CardDescription>{t("request.to", { destination: payouts.details.masked })}</CardDescription>}
            </CardHeader>
            <CardContent>
              <PayoutRequestForm balance={payouts.balance} minPayout={payouts.minPayout} disabledReason={disabledReason} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("history")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {payouts.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
              ) : (
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-normal">{t("date")}</th>
                      <th className="pb-2 text-right font-normal">{t("amount")}</th>
                      <th className="pb-2 font-normal">{t("method")}</th>
                      <th className="pb-2 font-normal">{t("status")}</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.history.map((row) => (
                      <tr key={row.id} className="border-t align-top">
                        <td className="py-2.5">{date(row.createdAt)}</td>
                        <td className="py-2.5 text-right tabular-nums">{usd(row.amount)}</td>
                        <td className="py-2.5">{t(`details.methods.${row.method}`)}</td>
                        <td className="py-2.5">
                          <Badge variant={STATUS_VARIANT[row.status]}>{t(`statuses.${row.status}`)}</Badge>
                          {row.adminNote && <p className="mt-1 text-xs text-muted-foreground">{row.adminNote}</p>}
                          {row.reference && <p className="mt-1 font-mono text-xs text-muted-foreground">{row.reference}</p>}
                        </td>
                        <td className="py-2.5 text-right">{row.status === "PENDING" && <CancelPayoutButton requestId={row.id} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle className="text-base">{t("details.title")}</CardTitle>
            <CardDescription>
              {payouts.details ? t("details.current", { destination: payouts.details.masked }) : t("details.none")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PayoutDetailsForm current={payouts.details?.method ?? null} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
