import { StarIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getPublicReviews } from "@/features/feedback/queries";
import { cn } from "@/lib/utils";

/** Latest public reviews; renders nothing until there are some. Cached, so it is part of the static shell. */
export async function PublicReviews() {
  const [reviews, t] = await Promise.all([getPublicReviews(6), getTranslations("Home.reviews")]);
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <div className="mb-8 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li key={review.id} className="grid content-start gap-3 rounded-xl border border-border/60 bg-card/50 p-5">
            <span className="flex" role="img" aria-label={t("stars", { count: review.rating })}>
              {[1, 2, 3, 4, 5].map((value) => (
                <StarIcon
                  key={value}
                  className={cn("size-4", value <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                />
              ))}
            </span>
            <p className="text-sm text-pretty">“{review.comment}”</p>
            <p className="text-xs text-muted-foreground">
              {t("byline", { reviewer: review.reviewer ?? t("anonymous"), game: review.game, booster: review.booster })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
