"use client";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** A delivered credential: hidden by default when `secret`, with copy. */
export function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const t = useTranslations("Shop.delivered");
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copy"));
    }
  };

  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm select-all">
          {shown ? value : "•".repeat(Math.min(value.length, 14))}
        </code>
        {secret && (
          <Button type="button" variant="outline" size="icon" onClick={() => setShown((current) => !current)} aria-label={shown ? "Hide" : "Show"}>
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        )}
        <Button type="button" variant="outline" size="icon" onClick={() => void copy()} aria-label={t("copy")}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  );
}
