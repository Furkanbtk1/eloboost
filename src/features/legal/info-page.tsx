import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { publicPageMetadata } from "@/lib/seo";

import { getInfoPage, isInfoSlug, type InfoSlug } from "./content";


export function infoMetadata(group: "legal" | "company") {
  return async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
    const { locale: raw, slug } = await params;
    if (!isInfoSlug(slug)) return {};
    const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
    const [page, tMeta] = await Promise.all([Promise.resolve(getInfoPage(slug, locale)), getTranslations({ locale, namespace: "Metadata" })]);
    return publicPageMetadata({ href: `/${group}/${slug}`, locale, title: page.title, description: page.description, siteName: tMeta("siteName") });
  };
}

/** Resolves the route params (404 for unknown slugs, with a real status) and renders the page. */
export async function renderInfoPage(params: Promise<{ locale: string; slug: string }>) {
  const { locale: raw, slug } = await params;
  if (!isInfoSlug(slug)) notFound();
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  return <InfoPageView slug={slug} locale={locale} />;
}

async function InfoPageView({ slug, locale }: { slug: InfoSlug; locale: string }) {
  const page = getInfoPage(slug, locale);
  const t = await getTranslations("Footer");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14">
        <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-2 text-muted-foreground">{page.description}</p>
        {env.NODE_ENV !== "production" && (
          <p className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{t("draftNotice")}</p>
        )}
        <div className="mt-10 grid gap-8">
          {page.sections.map((section) => (
            <section key={section.heading} className="grid gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="leading-7 text-foreground/90">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          {slug === "contact" && env.SUPPORT_EMAIL && (
            <p className="font-medium">
              <a href={`mailto:${env.SUPPORT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
                {env.SUPPORT_EMAIL}
              </a>
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
