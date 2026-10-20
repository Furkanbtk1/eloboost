import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Providers } from "@/components/providers";
import { routing } from "@/i18n/routing";
import { realtimeClientConfig } from "@/lib/realtime/server";

import "../globals.css";

const fontSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-geist-mono" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: { default: t("title"), template: `%s | ${t("siteName")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontMono.variable} dark h-full antialiased`}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Providers realtime={realtimeClientConfig()}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
