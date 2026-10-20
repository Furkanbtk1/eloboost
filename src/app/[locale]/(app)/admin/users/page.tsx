import { ChevronRightIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/features/admin/components/pagination";
import { listBoosterApplications, listUsers, userFiltersSchema, USERS_PAGE_SIZE } from "@/features/admin/users";
import { UserRole } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/admin/users">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("users"), robots: { index: false } };
}

export default function AdminUsersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminUsers searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminUsers({ searchParams }: Pick<Props, "searchParams">) {
  await requireArea("/admin/users");
  const filters = userFiltersSchema.parse(await searchParams);
  const [{ rows, total }, applications, t, tRole, tBooster, format] = await Promise.all([
    listUsers(filters),
    listBoosterApplications(),
    getTranslations("Admin.users"),
    getTranslations("Roles"),
    getTranslations("Booster.status"),
    getFormatter(),
  ]);
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6">
        {applications.length > 0 && (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="text-base">{t("applications", { count: applications.length })}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {applications.map((user) => (
                  <li key={user.id}>
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary/50"
                    >
                      <span className="grid">
                        <span className="font-medium">{user.name ?? user.email}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {date(user.createdAt)}
                        <ChevronRightIcon className="size-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <form className="flex flex-wrap items-center gap-2" role="search">
          <Input name="q" defaultValue={filters.q} placeholder={t("search")} aria-label={t("search")} className="max-w-xs" />
          <NativeSelect name="role" defaultValue={filters.role ?? ""} aria-label={t("role")}>
            <option value="">{t("allRoles")}</option>
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {tRole(role)}
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
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">{t("user")}</th>
                    <th className="pb-2 font-normal">{t("role")}</th>
                    <th className="pb-2 font-normal">{t("state")}</th>
                    <th className="pb-2 font-normal">{t("joined")}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="py-2.5">
                        <div className="grid">
                          <span className="font-medium">{user.name ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge variant="secondary">{tRole(user.role)}</Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {user.isBanned && <Badge variant="destructive">{t("banned")}</Badge>}
                          {user.boosterStatus && <Badge variant="outline">{tBooster(user.boosterStatus)}</Badge>}
                          {user.is2FAEnabled && <Badge variant="outline">2FA</Badge>}
                        </div>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{date(user.createdAt)}</td>
                      <td className="py-2.5 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/users/${user.id}`}>
                            {t("manage")}
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
          pathname="/admin/users"
          query={{ q: filters.q || undefined, role: filters.role }}
          page={filters.page}
          pageSize={USERS_PAGE_SIZE}
          total={total}
        />
      </div>
    </>
  );
}
