import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { enabledOAuthProviders } from "@/auth";
import { RegisterForm } from "@/features/auth/components/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.register");
  return { title: t("submit"), robots: { index: false } };
}

export default function RegisterPage() {
  return <RegisterForm oauthProviders={enabledOAuthProviders} />;
}
