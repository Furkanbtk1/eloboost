import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Previous / next links that keep the current filters. */
export async function Pagination({
  pathname,
  query,
  page,
  pageSize,
  total,
}: {
  pathname: string;
  query: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = await getTranslations("Admin.pagination");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (target: number) => ({
    pathname,
    query: Object.fromEntries(
      Object.entries({ ...query, page: String(target) }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  });

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>{t("page", { page, pages, total })}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)}>
              <ChevronLeftIcon />
              {t("previous")}
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)}>
              {t("next")}
              <ChevronRightIcon />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
