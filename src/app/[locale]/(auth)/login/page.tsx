import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { enabledOAuthProviders } from "@/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  return { title: t("submit"), robots: { index: false } };
}

export default function LoginPage() {
  return (
    // The form reads ?callbackUrl and ?error, which are only known per request.
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <LoginForm oauthProviders={enabledOAuthProviders} />
    </Suspense>
  );
}
