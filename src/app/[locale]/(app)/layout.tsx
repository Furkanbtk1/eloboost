import { Suspense, type ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { VerifyEmailBanner } from "@/features/auth/components/verify-email-banner";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <VerifyEmailBanner />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
