import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { VerifyEmailCard } from "@/features/auth/components/verify-email-card";

type Props = PageProps<"/[locale]/verify-email">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.verify");
  return { title: t("title"), robots: { index: false }, referrer: "no-referrer" };
}

export default function VerifyEmailPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-60 w-full rounded-xl" />}>
      <Verify searchParams={searchParams} />
    </Suspense>
  );
}

async function Verify({ searchParams }: Pick<Props, "searchParams">) {
  const { token } = await searchParams;
  return <VerifyEmailCard token={typeof token === "string" && token.length >= 20 ? token : null} />;
}
