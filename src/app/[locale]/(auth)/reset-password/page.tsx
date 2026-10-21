import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/reset-password">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.reset");
  // The token is in the URL: keep it out of referrers and search results.
  return { title: t("title"), robots: { index: false }, referrer: "no-referrer" };
}

export default function ResetPasswordPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <ResetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPassword({ searchParams }: Pick<Props, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 20) {
    const t = await getTranslations("Auth");
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm text-muted-foreground">{t("errors.linkInvalid")}</p>
        <Link href="/forgot-password" className="text-sm font-medium underline-offset-4 hover:underline">
          {t("reset.requestNew")}
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
