"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { resetTwoFactorAction, setUserBanAction, setUserRoleAction } from "@/features/admin/user-actions";
import type { ActionResult } from "@/lib/action-result";
import { UserRole } from "@/generated/prisma/enums";

type Props = { userId: string; role: UserRole; isBanned: boolean; is2FAEnabled: boolean; isSelf: boolean };

export function UserAdminActions({ userId, role, isBanned, is2FAEnabled, isSelf }: Props) {
  const t = useTranslations("Admin.users.actions");
  const tRole = useTranslations("Roles");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextRole, setNextRole] = useState<UserRole>(role);

  const run = (action: () => Promise<ActionResult>, done: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.success) return void toast.error(result.message);
      toast.success(done);
      router.refresh();
    });

  if (isSelf) return <p className="text-sm text-muted-foreground">{t("self")}</p>;

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="user-role">{t("role")}</Label>
        <div className="flex flex-wrap gap-2">
          <NativeSelect id="user-role" value={nextRole} onChange={(event) => setNextRole(event.target.value as UserRole)}>
            {Object.values(UserRole).map((value) => (
              <option key={value} value={value}>
                {tRole(value)}
              </option>
            ))}
          </NativeSelect>
          <Confirm
            label={t("saveRole")}
            title={t("roleTitle")}
            body={t("roleBody", { role: tRole(nextRole) })}
            disabled={isPending || nextRole === role}
            onConfirm={() => run(() => setUserRoleAction(locale, userId, nextRole), t("roleSaved"))}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("roleHint")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Confirm
          label={isBanned ? t("unban") : t("ban")}
          title={isBanned ? t("unban") : t("ban")}
          body={isBanned ? t("unbanBody") : t("banBody")}
          variant={isBanned ? "outline" : "destructive"}
          disabled={isPending}
          onConfirm={() => run(() => setUserBanAction(locale, userId, !isBanned), isBanned ? t("unbanned") : t("bannedDone"))}
        />
        <Confirm
          label={t("reset2fa")}
          title={t("reset2fa")}
          body={t("reset2faBody")}
          variant="outline"
          disabled={isPending || !is2FAEnabled}
          onConfirm={() => run(() => resetTwoFactorAction(locale, userId), t("reset2faDone"))}
        />
      </div>
    </div>
  );
}

function Confirm({
  label,
  title,
  body,
  onConfirm,
  disabled,
  variant = "default",
}: {
  label: string;
  title: string;
  body: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "destructive";
}) {
  const t = useTranslations("Admin.users.actions");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
