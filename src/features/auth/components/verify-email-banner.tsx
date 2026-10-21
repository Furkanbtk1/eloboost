import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/auth/session";

import { ResendVerificationButton } from "./resend-verification-button";

/** Shown to password accounts whose email isn't verified yet. Reads the session: render inside <Suspense>. */
export async function VerifyEmailBanner() {
  const user = await getCurrentUser();
  if (!user || user.emailVerified || !user.hasPassword) return null;
  const t = await getTranslations("Auth.verify");
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <span>{t("banner", { email: user.email })}</span>
        <ResendVerificationButton />
      </div>
    </div>
  );
}
