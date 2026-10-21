import { infoMetadata, renderInfoPage } from "@/features/legal/info-page";
import { LEGAL_SLUGS } from "@/features/legal/content";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export const generateMetadata = infoMetadata("legal");

export const instant = false;

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[slug]">) {
  return renderInfoPage(params);
}
