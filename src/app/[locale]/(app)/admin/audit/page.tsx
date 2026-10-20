import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAuditLog } from "@/features/admin/metrics";
import { requireArea } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/admin/audit">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("audit"), robots: { index: false } };
}

export default function AdminAuditPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminAudit searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAudit({ searchParams }: Pick<Props, "searchParams">) {
  await requireArea("/admin/audit");
  const { action: rawAction } = await searchParams;
  const action = typeof rawAction === "string" && /^[a-z_.]{1,40}$/.test(rawAction) ? rawAction : undefined;
  const [entries, t, format] = await Promise.all([getAuditLog(200, action), getTranslations("Admin.audit"), getFormatter()]);

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4">
        <form className="flex flex-wrap items-center gap-2" role="search">
          <Input name="action" defaultValue={action ?? ""} placeholder={t("filter")} aria-label={t("filter")} className="max-w-xs" />
          <Button type="submit" variant="outline" size="sm">
            <SearchIcon />
            {t("apply")}
          </Button>
        </form>
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">{t("when")}</th>
                    <th className="pb-2 font-normal">{t("who")}</th>
                    <th className="pb-2 font-normal">{t("action")}</th>
                    <th className="pb-2 font-normal">{t("target")}</th>
                    <th className="pb-2 font-normal">{t("details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t align-top">
                      <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {format.dateTime(entry.createdAt, { dateStyle: "short", timeStyle: "medium" })}
                        {entry.ipAddress && <div>{entry.ipAddress}</div>}
                      </td>
                      <td className="py-2">{entry.admin}</td>
                      <td className="py-2 font-mono text-xs">{entry.action}</td>
                      <td className="py-2 text-xs">
                        {entry.targetType}
                        {entry.targetId && <div className="font-mono break-all text-muted-foreground">{entry.targetId}</div>}
                      </td>
                      <td className="py-2">
                        {entry.details ? (
                          <pre className="max-w-md overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify(entry.details, null, 1)}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
