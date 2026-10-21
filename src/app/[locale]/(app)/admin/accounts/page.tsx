import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProductForm, ProductRow } from "@/features/accounts/components/admin-accounts";
import { listAdminProducts, listGamesWithServers } from "@/features/accounts/admin-queries";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("accounts"), robots: { index: false } };
}

export default function AdminAccountsPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminAccounts />
    </Suspense>
  );
}

async function AdminAccounts() {
  await requireArea("/admin/accounts");
  const [products, games, t] = await Promise.all([listAdminProducts(), listGamesWithServers(), getTranslations("Admin.accounts")]);

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("new")}</CardTitle>
          </CardHeader>
          <CardContent>
            <NewProductForm games={games} />
          </CardContent>
        </Card>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
