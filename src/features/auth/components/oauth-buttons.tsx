"use client";

import { useLocale, useTranslations } from "next-intl";

import type { OAuthProviderId } from "@/auth";
import { Button } from "@/components/ui/button";
import { oauthSignInAction } from "@/features/auth/actions";

const PROVIDER_LABEL: Record<OAuthProviderId, string> = {
  discord: "Discord",
  google: "Google",
  twitch: "Twitch",
};

export function OAuthButtons({
  providers,
  callbackUrl,
}: {
  providers: OAuthProviderId[];
  callbackUrl: string | null;
}) {
  const t = useTranslations("Auth.oauth");
  const locale = useLocale();
  if (providers.length === 0) return null;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        {t("divider")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
        {providers.map((provider) => (
          <form key={provider} action={oauthSignInAction.bind(null, provider, locale, callbackUrl)}>
            <Button type="submit" variant="outline" className="w-full">
              {PROVIDER_LABEL[provider]}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
