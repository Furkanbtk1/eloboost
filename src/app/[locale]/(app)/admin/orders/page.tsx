import { ChevronRightIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/features/admin/components/pagination";
import { listAdminOrders, orderFiltersSchema, ORDERS_PAGE_SIZE } from "@/features/admin/orders";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { OrderStatus } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/admin/orders">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("orders"), robots: { index: false } };
}

export default function AdminOrdersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminOrders searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminOrders({ searchParams }: Pick<Props, "searchParams">) {
  await requireArea("/admin/orders");
  const filters = orderFiltersSchema.parse(await searchParams);
  const [{ rows, total }, t, tStatus, tType, format] = await Promise.all([
    listAdminOrders(filters),
    getTranslations("Admin.orders"),
    getTranslations("OrderStatus"),
    getTranslations("OrderType"),
    getFormatter(),
  ]);

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6">
        <form className="flex flex-wrap items-center gap-2" role="search">
          <Input name="q" defaultValue={filters.q} placeholder={t("search")} aria-label={t("search")} className="max-w-xs" />
          <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label={t("status")}>
            <option value="">{t("allStatuses")}</option>
            {Object.values(OrderStatus).map((status) => (
              <option key={status} value={status}>
                {tStatus(status)}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="sm">
            <SearchIcon />
            {t("filter")}
          </Button>
        </form>

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">{t("order")}</th>
                    <th className="pb-2 font-normal">{t("customer")}</th>
                    <th className="pb-2 font-normal">{t("booster")}</th>
                    <th className="pb-2 text-right font-normal">{t("total")}</th>
                    <th className="pb-2 font-normal">{t("status")}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr key={order.orderNumber} className="border-t">
                      <td className="py-2.5">
                        <div className="grid">
                          <span className="font-mono">{order.orderNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {order.game} · {tType(order.orderType)} · {format.dateTime(order.createdAt, { dateStyle: "medium" })}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5">{order.customer}</td>
                      <td className="py-2.5 text-muted-foreground">{order.booster ?? "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {format.number(order.total, { style: "currency", currency: order.currency })}
                      </td>
                      <td className="py-2.5">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="py-2.5 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/orders/${order.orderNumber}`} aria-label={t("open", { orderNumber: order.orderNumber })}>
                            <ChevronRightIcon />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Pagination
          pathname="/admin/orders"
          query={{ q: filters.q || undefined, status: filters.status }}
          page={filters.page}
          pageSize={ORDERS_PAGE_SIZE}
          total={total}
        />
      </div>
    </>
  );
}
