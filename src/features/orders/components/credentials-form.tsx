"use client";

import { LockKeyholeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveOrderDetailsAction } from "@/features/orders/customer-actions";

type Props = {
  orderNumber: string;
  /** Saved login name; the saved password is never sent to the browser. */
  username: string;
  hasPassword: boolean;
  notes: string;
};

export function CredentialsForm({ orderNumber, username: savedUsername, hasPassword, notes: savedNotes }: Props) {
  const t = useTranslations("Orders.vault");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState(savedUsername);
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState(savedNotes);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveOrderDetailsAction(locale, orderNumber, { username, password, notes });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      setErrors({});
      setPassword("");
      toast.success(t("saved"));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="account-username"
          label={t("username")}
          autoComplete="off"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors.username?.[0]}
          maxLength={100}
          required
        />
        <FormField
          id="account-password"
          type="password"
          label={t("password")}
          autoComplete="new-password"
          placeholder={hasPassword ? "••••••••" : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password?.[0]}
          maxLength={128}
        />
      </div>
      {hasPassword && <p className="-mt-2 text-xs text-muted-foreground">{t("passwordKeep")}</p>}
      <div className="grid gap-1.5">
        <Label htmlFor="booster-notes">{t("notes")}</Label>
        <Textarea
          id="booster-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("notesPlaceholder")}
          maxLength={500}
          rows={3}
        />
      </div>
      <Button type="submit" disabled={isPending || !username.trim()} className="justify-self-start">
        <LockKeyholeIcon />
        {t("save")}
      </Button>
    </form>
  );
}
