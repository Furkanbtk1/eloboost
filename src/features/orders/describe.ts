import "server-only";

import { getFormatter, getMessages, getTranslations } from "next-intl/server";

import type { OrderType } from "@/generated/prisma/enums";

import type { RankSnapshot } from "./workflow";

type Describable = {
  orderType: OrderType;
  startRank: RankSnapshot;
  desiredRank: RankSnapshot;
  quantity: number | null;
};

/**
 * Localized text helpers for order views: "Gold IV → Platinum IV",
 * "3 wins at Platinum IV", option labels...
 */
export async function getOrderText() {
  const [t, tOrderType, format, messages] = await Promise.all([
    getTranslations("Calculator"),
    getTranslations("OrderType"),
    getFormatter(),
    getMessages(),
  ]);
  const optionLabels: Record<string, string> = messages.Calculator.modifierLabels;

  const rank = (snapshot: RankSnapshot) =>
    snapshot.label ?? (snapshot.rating !== undefined ? format.number(snapshot.rating) : "–");

  const service = (order: Describable) => {
    const count = order.quantity ?? 0;
    switch (order.orderType) {
      case "DIVISION":
        return t("lines.climb", { from: rank(order.startRank), to: rank(order.desiredRank) });
      case "WIN":
        return t("lines.wins", { count, rank: rank(order.startRank) });
      case "PLACEMENT":
        return t("lines.games", { count, rank: rank(order.startRank) });
      case "COACHING":
        return t("lines.hours", { count });
      case "ACCOUNT":
        return tOrderType("ACCOUNT");
    }
  };

  const options = (keys: (string | null)[]) =>
    keys.filter((key) => key !== null).map((key) => optionLabels[key] ?? key);

  return { rank, service, options, format };
}
