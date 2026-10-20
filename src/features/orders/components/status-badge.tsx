import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const VARIANT: Record<OrderStatus, ComponentProps<typeof Badge>["variant"]> = {
  AWAITING_PAYMENT: "outline",
  PENDING: "secondary",
  ASSIGNED: "secondary",
  IN_PROGRESS: "default",
  PAUSED: "outline",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  DISPUTED: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("OrderStatus");
  return (
    <Badge
      variant={VARIANT[status]}
      className={cn(status === "COMPLETED" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400")}
    >
      {t(status)}
    </Badge>
  );
}
