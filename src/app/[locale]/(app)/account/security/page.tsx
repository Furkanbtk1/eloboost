import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TwoFactorCard } from "@/features/auth/components/two-factor-card";
import { isTwoFactorMandatory, needsTwoFactorSetup } from "@/lib/auth/policy";
import { countUnusedBackupCodes } from "@/lib/auth/backup-codes";
import { requireArea } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Security");
  return { title: t("title"), robots: { index: false } };
}

export default function SecurityPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Security />
    </Suspense>
  );
}

async function Security() {
  const user = await requireArea("/account/security");
  const [t, unusedCodes] = await Promise.all([
    getTranslations("Security"),
    user.is2FAEnabled ? countUnusedBackupCodes(user.id) : Promise.resolve(0),
  ]);

  return (
    <div className="max-w-xl">
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      {needsTwoFactorSetup(user.role, user.is2FAEnabled) && (
        <Alert className="mb-6 border-primary/50">
          <AlertDescription>{t("requiredNotice")}</AlertDescription>
        </Alert>
      )}
      <TwoFactorCard
        enabled={user.is2FAEnabled}
        hasPassword={user.hasPassword}
        mandatory={isTwoFactorMandatory(user.role)}
        unusedCodes={unusedCodes}
      />
    </div>
  );
}
