import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isStaffRole } from "@/lib/auth/access";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Header");
  return { title: t("myPanel"), robots: { index: false } };
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const user = await requireArea("/admin");
  const [t, tPanel, tRole] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Panel"),
    getTranslations("Roles"),
  ]);
  const { role } = user;
  if (!isStaffRole(role)) notFound(); // unreachable: requireArea allows staff only

  return (
    <>
      <PanelHeader title={tPanel("welcome", { name: user.name ?? user.email })} subtitle={t("subtitle")}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("roleLabel")}
          <Badge>{tRole(role)}</Badge>
        </div>
      </PanelHeader>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("permissionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">{t(`permissions.${role}`)}</CardContent>
      </Card>
    </>
  );
}
