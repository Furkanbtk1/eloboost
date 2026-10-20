"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
    CRISP_RUNTIME_CONFIG?: { locale: string };
  }
}

const WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

/** Crisp live chat (spec 2.5), loaded after hydration and only when NEXT_PUBLIC_CRISP_WEBSITE_ID is set. */
export function LiveSupport() {
  const locale = useLocale();

  useEffect(() => {
    if (!WEBSITE_ID || !/^[0-9a-f-]{36}$/.test(WEBSITE_ID) || document.getElementById("crisp-loader")) return;
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = WEBSITE_ID;
    window.CRISP_RUNTIME_CONFIG = { locale };
    const script = document.createElement("script");
    script.id = "crisp-loader";
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);
  }, [locale]);

  return null;
}
