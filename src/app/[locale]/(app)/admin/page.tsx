import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/features/admin/components/revenue-chart";
import { StatTile } from "@/features/admin/components/stat-tile";
import { getAdminMetrics, getAuditLog } from "@/features/admin/metrics";
import { OrderStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { isStaffRole, type StaffRole } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title"), robots: { index: false } };
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

async function AdminOverview() {
  const user = await requireArea("/admin");
  const [metrics, t, tPanel, tRole, tStatus, format] = await Promise.all([
    getAdminMetrics(),
    getTranslations("Admin.overview"),
    getTranslations("Panel"),
    getTranslations("Roles"),
    getTranslations("OrderStatus"),
    getFormatter(),
  ]);
  const { role } = user;
  if (!isStaffRole(role)) notFound(); // unreachable: requireArea admits staff only
  const audit = role === "ADMIN" ? await getAuditLog(8) : [];

  const usd = (value: number) => format.number(value, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const count = (value: number) => format.number(value);
  const pending = metrics.payouts.PENDING ?? { count: 0, amount: 0 };
  const approved = metrics.payouts.APPROVED ?? { count: 0, amount: 0 };
  const active = (metrics.ordersByStatus.ASSIGNED ?? 0) + (metrics.ordersByStatus.IN_PROGRESS ?? 0) + (metrics.ordersByStatus.PAUSED ?? 0);

  const tiles = {
    revenue: { label: t("revenue"), value: usd(metrics.revenue30d), hint: t("last30") },
    platform: { label: t("platform"), value: usd(metrics.platform30d), hint: t("last30") },
    paidOrders: { label: t("paidOrders"), value: count(metrics.paidOrders30d), hint: t("last30") },
    customers: { label: t("newCustomers"), value: count(metrics.newCustomers30d), hint: t("last30") },
    disputes: { label: t("openDisputes"), value: count(metrics.openDisputes), href: "/admin/disputes" },
    activeOrders: { label: t("activeOrders"), value: count(active), hint: t("activeOrdersHint"), href: "/admin/orders" },
    pool: { label: t("pool"), value: count(metrics.ordersByStatus.PENDING ?? 0), href: "/admin/orders?status=PENDING" },
    flagged: { label: t("flagged"), value: count(metrics.flaggedMessages7d), hint: t("last7") },
    boosters: {
      label: t("boosters"),
      value: count(metrics.activeBoosters),
      hint: t("pendingBoosters", { count: metrics.pendingBoosters }),
      href: "/admin/users?role=BOOSTER",
    },
    pendingPayouts: {
      label: t("pendingPayouts"),
      value: usd(pending.amount),
      hint: t("requests", { count: pending.count }),
      href: "/admin/payouts",
    },
    approvedPayouts: {
      label: t("approvedPayouts"),
      value: usd(approved.amount),
      hint: t("requests", { count: approved.count }),
      href: "/admin/payouts",
    },
    paidOut: { label: t("paidOut"), value: usd(metrics.paidOut30d), hint: t("last30") },
    balances: { label: t("balances"), value: usd(metrics.boosterBalances), hint: t("balancesHint") },
  };
  type TileKey = keyof typeof tiles;
  const layout: Record<StaffRole, TileKey[]> = {
    ADMIN: ["revenue", "platform", "paidOrders", "customers", "disputes", "pendingPayouts", "boosters", "balances"],
    SUPPORT: ["disputes", "activeOrders", "pool", "flagged"],
    FINANCE: ["pendingPayouts", "approvedPayouts", "paidOut", "balances"],
  };

  return (
    <>
      <PanelHeader title={tPanel("welcome", { name: user.name ?? user.email })} subtitle={t(`subtitle.${role}`)}>
        <Badge>{tRole(role)}</Badge>
      </PanelHeader>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {layout[role].map((key) => (
            <StatTile key={key} {...tiles[key]} />
          ))}
        </div>

        {role === "ADMIN" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("chart.title")}</CardTitle>
              <CardDescription>{t("chart.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart data={metrics.dailyRevenue} />
            </CardContent>
          </Card>
        )}

        {role !== "FINANCE" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("byStatus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.values(OrderStatus).map((status) => (
                  <li key={status}>
                    <Link
                      href={`/admin/orders?status=${status}`}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/50"
                    >
                      <span className="text-muted-foreground">{tStatus(status)}</span>
                      <span className="font-medium tabular-nums">{count(metrics.ordersByStatus[status] ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {role === "ADMIN" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">{t("recentAudit")}</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/audit">{t("allAudit")}</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noAudit")}</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {audit.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                      <span>
                        <span className="font-mono text-xs">{entry.action}</span>
                        <span className="text-muted-foreground"> · {entry.admin}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format.dateTime(entry.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
