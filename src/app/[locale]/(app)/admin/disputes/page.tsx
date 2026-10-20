import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listDisputes } from "@/features/disputes/queries";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/admin/disputes">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("disputes"), robots: { index: false } };
}

export default function AdminDisputesPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminDisputes searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminDisputes({ searchParams }: Pick<Props, "searchParams">) {
  await requireArea("/admin/disputes");
  const { view: rawView } = await searchParams;
  const status = rawView === "resolved" ? "RESOLVED" : "OPEN";
  const [rows, t, tRole, format] = await Promise.all([
    listDisputes(status),
    getTranslations("Admin.disputes"),
    getTranslations("Roles"),
    getFormatter(),
  ]);
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4">
        <div className="flex gap-1">
          {(["OPEN", "RESOLVED"] as const).map((key) => (
            <Link
              key={key}
              href={{ pathname: "/admin/disputes", query: key === "OPEN" ? {} : { view: "resolved" } }}
              aria-current={status === key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                status === key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
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
            {rows.map((dispute) => (
              <li key={dispute.id}>
                <Link
                  href={`/admin/orders/${dispute.order.orderNumber}`}
                  className="flex items-start gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="grid min-w-0 flex-1 gap-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{dispute.order.orderNumber}</span>
                      <span className="text-muted-foreground">{dispute.order.game}</span>
                      {dispute.resolution && <Badge>{t(`resolutions.${dispute.resolution}`)}</Badge>}
                    </div>
                    <p className="line-clamp-2 text-muted-foreground">{dispute.reason}</p>
                    <span className="text-xs text-muted-foreground">
                      {t("openedBy", { name: dispute.openedBy.name, role: tRole(dispute.openedBy.role), date: date(dispute.createdAt) })}
                    </span>
                  </div>
                  <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
