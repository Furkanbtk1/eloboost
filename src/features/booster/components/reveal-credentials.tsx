"use client";

import { CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { revealCredentialsAction } from "@/features/booster/actions";

const VISIBLE_MS = 60_000;

/** "Show login": requires the VPN location, logs the reveal, hides itself after a minute. */
export function RevealCredentials({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("Booster.workspace");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [vpnLocation, setVpnLocation] = useState("");
  const [vpnError, setVpnError] = useState<string>();
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    if (!credentials) return;
    const timer = setTimeout(() => setCredentials(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [credentials]);

  const reveal = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await revealCredentialsAction(locale, orderNumber, vpnLocation);
      if (!result.success) {
        setVpnError(result.fieldErrors?.vpnLocation?.[0]);
        return void toast.error(result.message);
      }
      setVpnError(undefined);
      setCredentials(result.data);
      router.refresh(); // shows the new entry in the access log
    });
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t("copied"));
  };

  if (credentials) {
    return (
      <div className="grid gap-3">
        {(["username", "password"] as const).map((field) => (
          <div key={field} className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <div className="grid min-w-0">
              <span className="text-xs text-muted-foreground">{t(field)}</span>
              <span className="truncate font-mono text-sm select-all">{credentials[field]}</span>
            </div>
            <Button variant="ghost" size="icon" aria-label={t("copy")} onClick={() => copy(credentials[field])}>
              <CopyIcon />
            </Button>
          </div>
        ))}
        <Button variant="outline" className="justify-self-start" onClick={() => setCredentials(null)}>
          <EyeOffIcon />
          {t("hide")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={reveal} className="grid gap-3" noValidate>
      <FormField
        id="vpn-location"
        label={t("vpn")}
        placeholder={t("vpnPlaceholder")}
        value={vpnLocation}
        onChange={(event) => setVpnLocation(event.target.value)}
        error={vpnError}
        maxLength={100}
        required
      />
      <Button type="submit" disabled={isPending || vpnLocation.trim().length < 2} className="justify-self-start">
        <EyeIcon />
        {t("reveal")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("revealNote")}</p>
    </form>
  );
}
