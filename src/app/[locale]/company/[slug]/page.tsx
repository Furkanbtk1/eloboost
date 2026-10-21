import { infoMetadata, renderInfoPage } from "@/features/legal/info-page";
import { COMPANY_SLUGS } from "@/features/legal/content";

export function generateStaticParams() {
  return COMPANY_SLUGS.map((slug) => ({ slug }));
}

export const generateMetadata = infoMetadata("company");

export const instant = false;

export default async function CompanyPage({ params }: PageProps<"/[locale]/company/[slug]">) {
  return renderInfoPage(params);
}
