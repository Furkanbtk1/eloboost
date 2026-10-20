"use server";

import { randomUUID } from "node:crypto";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { broadcast, signal } from "@/lib/realtime/server";
import { putObject, storageEnabled } from "@/lib/storage";

import { findChatOrder, getChatViewer, type ChatOrderRow } from "./access";
import { ATTACHMENT_TYPES, attachmentKey, MAX_ATTACHMENT_BYTES, sniffImage } from "./attachments";
import { moderate } from "./moderation";
import { listMessages, type ChatMessage } from "./queries";
import { chatClosedReason, type ChatRole } from "./rules";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

const contentSchema = z.string().trim().max(1000);

const orderLink = (role: "customer" | "booster", orderNumber: string) =>
  role === "customer" ? `/dashboard/orders/${orderNumber}` : `/booster/orders/${orderNumber}`;

/**
 * One unread "new message" notification per order and recipient: later
 * messages bump it instead of filling the bell with one entry per message.
 */
async function notifyNewMessage(recipientId: string, order: ChatOrderRow, recipient: "customer" | "booster", from: string | null) {
  const data = { orderNumber: order.orderNumber, from };
  const existing = await db.notification.findFirst({
    where: { userId: recipientId, type: "NEW_MESSAGE", isRead: false, data: { path: ["orderNumber"], equals: order.orderNumber } },
    select: { id: true },
  });
  if (existing) {
    await db.notification.update({ where: { id: existing.id }, data: { data, createdAt: new Date() } });
  } else {
    await db.notification.create({
      data: { userId: recipientId, type: "NEW_MESSAGE", data, link: orderLink(recipient, order.orderNumber) },
    });
  }
}

/** Reads the optional screenshot; returns its bytes and type, or an error message key. */
async function readAttachment(file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: "fileTooLarge" as const };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = sniffImage(bytes);
  if (!extension) return { error: "fileType" as const };
  return { bytes, extension };
}

export async function sendChatMessageAction(
  rawLocale: string,
  orderNumber: string,
  formData: FormData,
): Promise<ActionResult<ChatMessage>> {
  const t = await getTranslations({ locale: resolveLocale(rawLocale), namespace: "Chat.errors" });

  const viewer = await getChatViewer();
  const access = viewer ? await findChatOrder(viewer, { orderNumber }) : null;
  if (!viewer || !access) return fail(t("notFound"), 404);
  const { order, role } = access;
  if (role === "staff" || chatClosedReason(role, order)) return fail(t("closed"), 409);

  const content = contentSchema.safeParse(formData.get("content") ?? "");
  if (!content.success) return fail(t("tooLong"), 400);
  const rawFile = formData.get("file");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  if (!content.data && !file) return fail(t("empty"), 400);

  const limit = await rateLimit("chatMessage", viewer.id);
  if (!limit.success) return fail(t("rateLimited"), 429);

  let key: string | null = null;
  if (file) {
    if (!storageEnabled) return fail(t("uploadsDisabled"), 503);
    const uploadLimit = await rateLimit("chatAttachment", viewer.id);
    if (!uploadLimit.success) return fail(t("rateLimited"), 429);
    const attachment = await readAttachment(file);
    if (attachment.error) return fail(t(attachment.error), 400);
    key = attachmentKey(order.id, randomUUID(), attachment.extension);
    try {
      await putObject(key, attachment.bytes, ATTACHMENT_TYPES[attachment.extension]);
    } catch (error) {
      console.error("[chat] upload failed", error);
      return fail(t("uploadFailed"), 502);
    }
  }

  const moderated = moderate(content.data);
  const message = await db.message.create({
    data: {
      orderId: order.id,
      senderId: viewer.id,
      content: moderated.text,
      attachmentKey: key,
      isFlagged: moderated.flagged,
    },
    select: { id: true, createdAt: true },
  });

  // Customers stay anonymous to boosters; boosters are shown to customers by name.
  const recipient: { id: string | null; role: Exclude<ChatRole, "staff"> } =
    role === "customer" ? { id: order.boosterId, role: "booster" } : { id: order.customerId, role: "customer" };
  if (recipient.id) {
    const from =
      role === "booster" ? ((await db.user.findUnique({ where: { id: viewer.id }, select: { name: true } }))?.name ?? null) : null;
    await notifyNewMessage(recipient.id, order, recipient.role, from);
    broadcast(signal.chatChanged(orderNumber), signal.notification(recipient.id));
  } else {
    broadcast(signal.chatChanged(orderNumber));
  }

  return ok({
    id: message.id,
    author: "me",
    content: moderated.text,
    hasAttachment: key !== null,
    isFlagged: moderated.flagged,
    isRead: false,
    createdAt: message.createdAt,
  });
}

/** Latest messages; the browser calls this when a realtime signal arrives. */
export async function getChatMessagesAction(orderNumber: string): Promise<ActionResult<ChatMessage[]>> {
  const viewer = await getChatViewer();
  const access = viewer ? await findChatOrder(viewer, { orderNumber }) : null;
  if (!viewer || !access) return fail("Not found", 404);

  const limit = await rateLimit("realtimeSync", viewer.id);
  if (!limit.success) return fail("Too many requests", 429);

  return ok(await listMessages(access.order.id, viewer.id));
}

/** Marks the other side's messages (and this order's chat notification) as read. */
export async function markChatReadAction(orderNumber: string): Promise<ActionResult> {
  const viewer = await getChatViewer();
  const access = viewer ? await findChatOrder(viewer, { orderNumber }) : null;
  if (!viewer || !access || access.role === "staff") return fail("Not found", 404);

  const limit = await rateLimit("realtimeSync", viewer.id);
  if (!limit.success) return fail("Too many requests", 429);

  const [messages, notifications] = await db.$transaction([
    db.message.updateMany({
      where: { orderId: access.order.id, senderId: { not: viewer.id }, isRead: false },
      data: { isRead: true },
    }),
    db.notification.updateMany({
      where: { userId: viewer.id, type: "NEW_MESSAGE", isRead: false, data: { path: ["orderNumber"], equals: orderNumber } },
      data: { isRead: true },
    }),
  ]);

  broadcast(
    ...(messages.count > 0 ? [signal.chatChanged(orderNumber)] : []),
    ...(notifications.count > 0 ? [signal.notification(viewer.id)] : []),
  );
  return ok(undefined);
}
