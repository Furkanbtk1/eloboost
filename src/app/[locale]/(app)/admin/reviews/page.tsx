import { StarIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewVisibility } from "@/features/admin/components/review-visibility";
import { getAdminReviews } from "@/features/feedback/queries";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("reviews"), robots: { index: false } };
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminReviews />
    </Suspense>
  );
}

async function AdminReviews() {
  await requireArea("/admin/reviews");
  const [reviews, t, format] = await Promise.all([getAdminReviews(), getTranslations("Admin.reviews"), getFormatter()]);

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card className={cn(!review.isPublic && "opacity-70")}>
                <CardContent className="grid gap-3 pt-6 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="grid gap-1.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex" aria-label={t("stars", { count: review.rating })}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <StarIcon
                            key={value}
                            className={cn("size-4", value <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")}
                          />
                        ))}
                      </span>
                      <Badge variant={review.isPublic ? "secondary" : "outline"}>{review.isPublic ? t("public") : t("private")}</Badge>
                      <Link href={`/admin/orders/${review.orderNumber}`} className="font-mono text-xs hover:underline">
                        {review.orderNumber}
                      </Link>
                    </div>
                    {review.comment ? <p>{review.comment}</p> : <p className="text-muted-foreground italic">{t("noComment")}</p>}
                    <span className="text-xs text-muted-foreground">
                      {t("meta", {
                        customer: review.customerEmail,
                        booster: review.booster,
                        game: review.game,
                        date: format.dateTime(review.createdAt, { dateStyle: "medium" }),
                      })}
                    </span>
                  </div>
                  <ReviewVisibility reviewId={review.id} isPublic={review.isPublic} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
