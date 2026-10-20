"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";

const INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

/** Shown after returning from the provider while the webhook is on its way; polls by refreshing. */
export function PaymentConfirming() {
  const t = useTranslations("Payments");
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempts((count) => count + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, router]);

  return (
    <Alert>
      {attempts < MAX_ATTEMPTS && <LoaderCircleIcon className="animate-spin" />}
      <AlertDescription>{attempts < MAX_ATTEMPTS ? t("confirming") : t("confirmingSlow")}</AlertDescription>
    </Alert>
  );
}
