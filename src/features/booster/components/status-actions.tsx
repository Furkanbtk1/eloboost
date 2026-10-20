"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { boosterTransitionAction } from "@/features/booster/actions";
import type { BoosterTransition } from "@/features/orders/workflow";

/** Moves that can't be undone ask for confirmation first. */
const NEEDS_CONFIRMATION = ["complete", "release"] as const satisfies readonly BoosterTransition[];
type ConfirmedTransition = (typeof NEEDS_CONFIRMATION)[number];
const needsConfirmation = (transition: BoosterTransition): transition is ConfirmedTransition =>
  (NEEDS_CONFIRMATION as readonly BoosterTransition[]).includes(transition);

export function StatusActions({ orderNumber, transitions }: { orderNumber: string; transitions: BoosterTransition[] }) {
  const t = useTranslations("Booster.workspace");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (transitions.length === 0) return <p className="text-sm text-muted-foreground">{t("noActions")}</p>;

  const run = (transition: BoosterTransition) =>
    startTransition(async () => {
      const result = await boosterTransitionAction(locale, orderNumber, transition);
      if (!result.success) return void toast.error(result.message);
      toast.success(t(`transitionDone.${transition}`));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((transition) => {
        const variant = transition === "release" ? "outline" : "default";
        if (!needsConfirmation(transition)) {
          return (
            <Button key={transition} variant={variant} disabled={isPending} onClick={() => run(transition)}>
              {t(`transitions.${transition}`)}
            </Button>
          );
        }
        return (
          <AlertDialog key={transition}>
            <AlertDialogTrigger asChild>
              <Button variant={variant} disabled={isPending}>
                {t(`transitions.${transition}`)}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t(`transitions.${transition}`)}</AlertDialogTitle>
                <AlertDialogDescription>{t(`confirm.${transition}`)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(transition)}>{t(`transitions.${transition}`)}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })}
    </div>
  );
}
