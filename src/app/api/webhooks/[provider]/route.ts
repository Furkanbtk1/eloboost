import { applyPaymentUpdate } from "@/features/payments/process";
import { getProvider } from "@/features/payments/registry";
import { WebhookVerificationError } from "@/features/payments/types";
import { fail, ok } from "@/lib/action-result";

/**
 * Payment provider webhooks: POST /api/webhooks/stripe, /api/webhooks/coinbase.
 * 2xx tells the provider the event is handled; 5xx makes it retry later, which
 * is safe because applying an update is idempotent.
 */
export async function POST(request: Request, context: RouteContext<"/api/webhooks/[provider]">) {
  const { provider: providerId } = await context.params;
  const provider = getProvider(providerId);
  if (!provider?.parseWebhook) return Response.json(fail("Unknown webhook", 404), { status: 404 });

  // Signatures are computed over the exact bytes received.
  const rawBody = await request.text();

  let update;
  try {
    update = provider.parseWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.warn(`[webhooks] rejected ${providerId} webhook: ${error.message}`);
      return Response.json(fail("Invalid signature", 400), { status: 400 });
    }
    console.error(`[webhooks] malformed ${providerId} webhook`, error);
    return Response.json(fail("Malformed payload", 400), { status: 400 });
  }

  if (!update) return Response.json(ok({ result: "ignored" }));

  try {
    return Response.json(ok({ result: await applyPaymentUpdate(provider.gateway, update) }));
  } catch (error) {
    console.error(`[webhooks] failed to apply ${providerId} update ${update.reference}`, error);
    return Response.json(fail("Processing failed", 500), { status: 500 });
  }
}
