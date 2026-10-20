/** Tip options offered after a completed order (spec 3.2), as a share of the order total. */
export const TIP_PERCENTS = [5, 10, 20] as const;
export type TipPercent = (typeof TIP_PERCENTS)[number];

export const isTipPercent = (value: unknown): value is TipPercent => TIP_PERCENTS.includes(value as TipPercent);

/** Tip in cents of the order currency, rounded to the cent. */
export function tipCents(orderTotalCents: number, percent: TipPercent): number {
  return Math.round((orderTotalCents * percent) / 100);
}

/** "Alex Carter" -> "Alex C."; public reviews never show a full name or an email. */
export function publicReviewerName(name: string | null): string | null {
  const [first, ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!first || first.includes("@")) return null;
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
