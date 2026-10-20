import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatePromoForm, PromoActiveSwitch } from "@/features/admin/components/promo-forms";
import { listPromos } from "@/features/admin/promos";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("promos"), robots: { index: false } };
}

export default function AdminPromosPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminPromos />
    </Suspense>
  );
}

async function AdminPromos() {
  await requireArea("/admin/promos");
  const [promos, t, format] = await Promise.all([
    listPromos(),
    getTranslations("Admin.promos"),
    getFormatter(),
  ]);
  const usd = (value: number) => format.number(value, { style: "currency", currency: "USD" });

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("new")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePromoForm />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {promos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">{t("code")}</th>
                    <th className="pb-2 font-normal">{t("discount")}</th>
                    <th className="pb-2 font-normal">{t("uses")}</th>
                    <th className="pb-2 font-normal">{t("expires")}</th>
                    <th className="pb-2 font-normal">{t("minOrder")}</th>
                    <th className="pb-2 font-normal">{t("active")}</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => {
                    const { expired, usedUp } = promo;
                    return (
                      <tr key={promo.id} className="border-t">
                        <td className="py-2.5 font-mono font-medium">{promo.code}</td>
                        <td className="py-2.5">
                          {promo.discountType === "PERCENTAGE"
                            ? `%${format.number(promo.discountValue)}`
                            : usd(promo.discountValue)}
                        </td>
                        <td className="py-2.5 tabular-nums">
                          {promo.currentUses} / {promo.maxUses ?? "∞"}
                          {usedUp && <Badge variant="outline" className="ml-2">{t("usedUp")}</Badge>}
                        </td>
                        <td className="py-2.5">
                          {promo.expiresAt ? format.dateTime(promo.expiresAt, { dateStyle: "medium" }) : "—"}
                          {expired && <Badge variant="outline" className="ml-2">{t("expired")}</Badge>}
                        </td>
                        <td className="py-2.5">{promo.minOrderAmount ? usd(promo.minOrderAmount) : "—"}</td>
                        <td className="py-2.5">
                          <PromoActiveSwitch promoId={promo.id} isActive={promo.isActive} label={t("toggle", { code: promo.code })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
