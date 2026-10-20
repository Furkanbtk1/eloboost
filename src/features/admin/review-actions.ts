"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { REVIEWS_CACHE_TAG } from "@/features/feedback/queries";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";

import { adminErrors, getStaffActor, writeAudit } from "./server";

/** Hides a review from (or returns it to) the public pages. The booster's rating still counts it. */
export async function setReviewVisibilityAction(rawLocale: string, reviewId: string, isPublic: boolean): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor("/admin/reviews");
  if (!actor) return fail(t("forbidden"), 403);
  if (!z.uuid().safeParse(reviewId).success) return fail(t("notFound"), 404);

  const updated = await db.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({ where: { id: reviewId }, data: { isPublic: isPublic === true } });
    if (count !== 1) return false;
    await writeAudit(tx, {
      adminId: actor.id,
      action: isPublic ? "review.show" : "review.hide",
      targetType: "Review",
      targetId: reviewId,
    });
    return true;
  });
  if (!updated) return fail(t("notFound"), 404);
  updateTag(REVIEWS_CACHE_TAG);
  return ok(undefined);
}
