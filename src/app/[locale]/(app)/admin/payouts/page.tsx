import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PayoutReview } from "@/features/admin/components/payout-review";
import { getAdminPayouts } from "@/features/payouts/queries";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/admin/payouts">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("payouts"), robots: { index: false } };
}

export default function AdminPayoutsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminPayouts searchParams={searchParams} />
    </Suspense>
  );
}

const VIEWS = { open: ["PENDING", "APPROVED"], done: ["PAID", "REJECTED"] } as const;

async function AdminPayouts({ searchParams }: Pick<Props, "searchParams">) {
  const user = await requireArea("/admin/payouts");
  const { view: rawView } = await searchParams;
  const view = rawView === "done" ? "done" : "open";
  const [rows, t, tStatus, tMethod, format] = await Promise.all([
    getAdminPayouts(VIEWS[view]),
    getTranslations("Admin.payouts"),
    getTranslations("Payouts.statuses"),
    getTranslations("Payouts.details.methods"),
    getFormatter(),
  ]);
  const usd = (value: number) => format.number(value, { style: "currency", currency: "USD" });
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4">
        <div className="flex gap-1">
          {(["open", "done"] as const).map((key) => (
            <Link
              key={key}
              href={{ pathname: "/admin/payouts", query: key === "open" ? {} : { view: key } }}
              aria-current={view === key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                view === key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`views.${key}`)}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Card>
                  <CardContent className="grid gap-3 pt-6 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="grid gap-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">{usd(row.amount)}</span>
                        <Badge variant={row.status === "REJECTED" ? "destructive" : "secondary"}>{tStatus(row.status)}</Badge>
                        <Badge variant="outline">{tMethod(row.method)}</Badge>
                      </div>
                      {user.role === "ADMIN" ? (
                        <Link href={`/admin/users/${row.booster.id}`} className="font-medium hover:underline">
                          {row.booster.name} <span className="font-normal text-muted-foreground">({row.booster.email})</span>
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {row.booster.name} <span className="font-normal text-muted-foreground">({row.booster.email})</span>
                        </span>
                      )}
                      <span className="font-mono text-xs break-all">{row.destination}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("requested", { date: date(row.createdAt) })}
                        {row.reviewedAt && ` · ${t("reviewed", { date: date(row.reviewedAt) })}`}
                      </span>
                      {row.adminNote && <span className="text-xs text-muted-foreground">{row.adminNote}</span>}
                      {row.reference && <span className="font-mono text-xs text-muted-foreground">{row.reference}</span>}
                    </div>
                    <PayoutReview requestId={row.id} status={row.status} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
