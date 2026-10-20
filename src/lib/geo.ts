import "server-only";

import { headers } from "next/headers";

/**
 * Visitor country (ISO 3166 alpha-2) from the hosting/CDN geo header, or null
 * when unknown (e.g. local development). Used to offer local payment methods.
 */
export async function getRequestCountry(): Promise<string | null> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  return country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null;
}
