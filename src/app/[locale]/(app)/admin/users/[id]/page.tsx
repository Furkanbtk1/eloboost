import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BoosterProfileForm, type GameLadder } from "@/features/admin/components/booster-profile-form";
import { UserAdminActions } from "@/features/admin/components/user-admin-actions";
import { getAdminUser } from "@/features/admin/users";
import { getActiveGames } from "@/features/games/queries";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getPricingCatalog } from "@/features/pricing/catalog";
import { maxRating, stepLabel } from "@/features/pricing/engine";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/admin/users/[id]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("users"), robots: { index: false } };
}

export default function AdminUserPage({ params }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminUser params={params} />
    </Suspense>
  );
}

async function ladders(): Promise<GameLadder[]> {
  const games = await getActiveGames();
  const catalogs = await Promise.all(games.map((game) => getPricingCatalog(game.slug)));
  return catalogs
    .filter((catalog) => catalog !== null)
    .map((catalog) => ({
      slug: catalog.slug,
      name: catalog.name,
      rankSystem: catalog.rankSystem,
      steps: catalog.steps.map((step) => ({ position: step.position, label: stepLabel(step) })),
      maxRating: catalog.rankSystem === "RATING" ? maxRating(catalog) : 0,
    }));
}

async function AdminUser({ params }: Pick<Props, "params">) {
  const admin = await requireArea("/admin/users");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getAdminUser(id);
  if (!user) notFound();

  const [t, tRole, tBooster, tType, format, gameLadders] = await Promise.all([
    getTranslations("Admin.users"),
    getTranslations("Roles"),
    getTranslations("Booster.status"),
    getTranslations("Admin.transactionType"),
    getFormatter(),
    user.booster ? ladders() : Promise.resolve([]),
  ]);
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const usd = (value: number) => format.number(value, { style: "currency", currency: "USD" });

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
          <Link href="/admin/users">
            <ArrowLeftIcon />
            {t("back")}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{user.name ?? user.email}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {user.email}
          <Badge variant="secondary">{tRole(user.role)}</Badge>
          {user.isBanned && <Badge variant="destructive">{t("banned")}</Badge>}
          {user.boosterStatus && <Badge variant="outline">{tBooster(user.boosterStatus)}</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          {user.booster && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("booster.title")}</CardTitle>
                <CardDescription>
                  {t("booster.stats", {
                    completed: user.booster.completedOrders,
                    rating: format.number(user.booster.rating, { maximumFractionDigits: 1 }),
                    reviews: user.booster.ratingCount,
                    earnings: usd(user.booster.totalEarnings),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BoosterProfileForm
                  userId={user.id}
                  status={user.booster.status}
                  games={user.booster.gameSlugs}
                  ranks={user.booster.ranks}
                  ladders={gameLadders}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders")}</CardTitle>
            </CardHeader>
            <CardContent>
              {user.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noOrders")}</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {user.orders.map((order) => (
                    <li key={`${order.role}-${order.orderNumber}`}>
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:border-primary/50"
                      >
                        <span className="font-mono">{order.orderNumber}</span>
                        <span className="text-xs text-muted-foreground">{t(`orderRole.${order.role}`)}</span>
                        <OrderStatusBadge status={order.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("transactions")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {user.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
              ) : (
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <tbody>
                    {user.transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-t first:border-0">
                        <td className="py-2">{tType(transaction.type)}</td>
                        <td className="py-2 text-right tabular-nums">
                          {format.number(transaction.amount, { style: "currency", currency: transaction.currency })}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{transaction.status}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">{date(transaction.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("account")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Row label={t("joined")} value={date(user.createdAt)} />
                <Row label={t("lastLogin")} value={user.lastLoginAt ? date(user.lastLoginAt) : "—"} />
                <Row label={t("balance")} value={usd(user.balance)} />
                <Row label={t("twoFactor")} value={user.is2FAEnabled ? t("on") : t("off")} />
                <Row label={t("signIn")} value={user.hasPassword ? t("password") : t("oauth")} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("manageTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <UserAdminActions
                userId={user.id}
                role={user.role}
                isBanned={user.isBanned}
                is2FAEnabled={user.is2FAEnabled}
                isSelf={user.id === admin.id}
              />
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
