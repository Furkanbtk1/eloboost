import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-80 max-w-2xl rounded-full bg-linear-to-r from-primary/20 to-highlight/10 blur-3xl"
        />
        <div className="relative w-full max-w-sm">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
