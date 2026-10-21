import "server-only";

import { env } from "@/lib/env";

type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends through Resend's HTTP API. Never throws: callers must not leak whether
 * an address exists, and a mail outage shouldn't break sign-up. Returns false on failure.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") {
      console.warn(`[email] RESEND_API_KEY not set: "${email.subject}" to ${email.to} was not sent`);
      return false;
    }
    console.log(`\n[email:dev] To: ${email.to}\n[email:dev] Subject: ${email.subject}\n${email.text}\n`);
    return true;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.error(`[email] Resend answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response.ok;
  } catch (error) {
    console.error("[email] send failed", error);
    return false;
  }
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/** One call-to-action email; every string is escaped. */
export function actionEmail(input: { greeting: string; body: string; button: string; url: string; footer: string }) {
  const { greeting, body, button, url, footer } = input;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#18181b">
<p style="font-size:16px">${escapeHtml(greeting)}</p>
<p style="font-size:15px;line-height:1.5">${escapeHtml(body)}</p>
<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#6d49f4;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(button)}</a></p>
<p style="font-size:12px;color:#71717a;word-break:break-all">${escapeHtml(url)}</p>
<p style="font-size:12px;color:#71717a">${escapeHtml(footer)}</p></div>`;
  const text = `${greeting}\n\n${body}\n\n${button}: ${url}\n\n${footer}`;
  return { html, text };
}
