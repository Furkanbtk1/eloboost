import "server-only";

import { headers } from "next/headers";

/** Best-effort client IP from proxy headers (set by Vercel / reverse proxies / Next itself). */
export function clientIpFrom(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip") || "unknown";
}

export async function getClientIp(): Promise<string> {
  return clientIpFrom(await headers());
}
