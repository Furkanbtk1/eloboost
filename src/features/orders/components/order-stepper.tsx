import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OrderStatus } from "@/generated/prisma/enums";
import { STEPS, stepIndex } from "@/features/orders/workflow";
import { cn } from "@/lib/utils";

/** Waiting for booster → Booster assigned → In progress → Completed. */
export function OrderStepper({ status }: { status: OrderStatus }) {
  const t = useTranslations("Orders.detail");
  const current = stepIndex(status);

  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {STEPS.map((step, index) => {
        const done = index < current || status === "COMPLETED";
        const active = index === current && status !== "COMPLETED";
        return (
          <li key={step} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            <div className="flex w-full items-center gap-2">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary ring-4 ring-primary/20",
                  !done && !active && "text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <CheckIcon className="size-4" /> : index + 1}
              </span>
              {index < STEPS.length - 1 && (
                <span className={cn("hidden h-0.5 flex-1 rounded sm:block", done ? "bg-primary" : "bg-border")} />
              )}
            </div>
            <span className={cn("text-sm", active ? "font-medium" : "text-muted-foreground")}>{t(`steps.${step}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
