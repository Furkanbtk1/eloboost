"use client";

import { ImageIcon, LoaderCircleIcon, MessagesSquareIcon, SendIcon, XIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getChatMessagesAction, markChatReadAction, sendChatMessageAction } from "@/features/chat/actions";
import { ATTACHMENT_ACCEPT, ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/features/chat/attachments";
import type { ChatMessage } from "@/features/chat/queries";
import type { ChatClosedReason, ChatRole } from "@/features/chat/rules";
import { channels, events } from "@/lib/realtime/channels";
import { useRealtimeEvent } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

type Props = {
  orderNumber: string;
  role: ChatRole;
  closedReason: ChatClosedReason | null;
  uploadsEnabled: boolean;
  initialMessages: ChatMessage[];
};

const ALLOWED_TYPES: readonly string[] = Object.values(ATTACHMENT_TYPES);

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

const noopSubscribe = () => () => {};
/** False during SSR and hydration: times are shown in the browser's time zone only. */
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

export function OrderChat({ orderNumber, role, closedReason, uploadsEnabled, initialMessages }: Props) {
  const t = useTranslations("Chat");
  const locale = useLocale();
  const format = useFormatter();
  const isClient = useIsClient();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSending, startSending] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  /** Follow new messages unless the user scrolled up to read history. */
  const stickToBottom = useRef(true);
  const marking = useRef(false);

  useRealtimeEvent(channels.order(orderNumber), events.chatChanged, async () => {
    const result = await getChatMessagesAction(orderNumber);
    if (result.success) setMessages((current) => mergeMessages(current, result.data));
  });

  useEffect(() => {
    const element = list.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  const hasUnread = role !== "staff" && messages.some((message) => message.author !== "me" && !message.isRead);
  useEffect(() => {
    if (!hasUnread) return;
    const markWhenVisible = () => {
      if (document.visibilityState !== "visible" || marking.current) return;
      marking.current = true;
      void markChatReadAction(orderNumber).then((result) => {
        marking.current = false;
        if (!result.success) return;
        setMessages((current) => current.map((message) => (message.author === "me" ? message : { ...message, isRead: true })));
      });
    };
    markWhenVisible();
    document.addEventListener("visibilitychange", markWhenVisible);
    return () => document.removeEventListener("visibilitychange", markWhenVisible);
  }, [hasUnread, orderNumber]);

  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!ALLOWED_TYPES.includes(picked.type)) {
      clearFile();
      return void toast.error(t("errors.fileType"));
    }
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      clearFile();
      return void toast.error(t("errors.fileTooLarge"));
    }
    setFile(picked);
  };

  const canSend = (text.trim().length > 0 || file !== null) && !isSending;
  const send = () => {
    if (!canSend) return;
    startSending(async () => {
      const form = new FormData();
      form.set("content", text);
      if (file) form.set("file", file);
      const result = await sendChatMessageAction(locale, orderNumber, form);
      if (!result.success) return void toast.error(result.message);
      setText("");
      clearFile();
      stickToBottom.current = true;
      setMessages((current) => mergeMessages(current, [result.data]));
    });
  };

  const lastOwnId = messages.findLast((message) => message.author === "me")?.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquareIcon className="size-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t(`description.${role}`)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div
          ref={list}
          onScroll={(event) => {
            const element = event.currentTarget;
            stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          }}
          className="grid max-h-[28rem] min-h-32 content-start gap-3 overflow-y-auto rounded-lg border bg-background/40 p-3"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <p className="m-auto py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            messages.map((message) => {
              const mine = message.author === "me";
              return (
                <div key={message.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                  <span className="text-xs text-muted-foreground">
                    {t(`author.${message.author}`)}
                    {isClient && (
                      <>
                        {" · "}
                        <time dateTime={message.createdAt.toISOString()}>
                          {format.dateTime(message.createdAt, { dateStyle: "short", timeStyle: "short" })}
                        </time>
                      </>
                    )}
                  </span>
                  <div
                    className={cn(
                      "grid max-w-[85%] gap-2 rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
                      mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                      message.author === "staff" && "border border-amber-500/40",
                    )}
                  >
                    {message.content && <p>{message.content}</p>}
                    {message.hasAttachment && <Attachment messageId={message.id} />}
                  </div>
                  {(mine || role === "staff") && message.isFlagged && <span className="text-xs text-amber-500">{t("filtered")}</span>}
                  {mine && message.id === lastOwnId && message.isRead && (
                    <span className="text-xs text-muted-foreground">{t("seen")}</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {closedReason ? (
          <p className="text-sm text-muted-foreground">{t(`closed.${closedReason}`)}</p>
        ) : (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            {file && (
              <div className="flex w-fit max-w-full items-center gap-2 rounded-md border px-2 py-1 text-xs">
                <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {format.number(file.size / 1024 / 1024, { maximumFractionDigits: 1 })} MB
                </span>
                <button type="button" onClick={clearFile} aria-label={t("removeFile")} className="shrink-0">
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              {uploadsEnabled && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    className="hidden"
                    onChange={(event) => pickFile(event.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("attach")}
                    title={t("attach")}
                    disabled={isSending}
                    onClick={() => fileInput.current?.click()}
                  >
                    <ImageIcon />
                  </Button>
                </>
              )}
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                rows={1}
                maxLength={1000}
                className="max-h-40 min-h-10 resize-none"
              />
              <Button type="submit" size="icon" aria-label={t("send")} title={t("send")} disabled={!canSend}>
                {isSending ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t(uploadsEnabled ? "hint" : "hintNoUploads")}</p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Attachment({ messageId }: { messageId: string }) {
  const t = useTranslations("Chat");
  const [failed, setFailed] = useState(false);
  const src = `/api/attachments/${messageId}`;

  if (failed) return <span className="text-xs italic opacity-80">{t("attachmentMissing")}</span>;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block">
      {/* Served by an authenticated route; next/image would fetch it without the user's cookies. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={t("attachmentAlt")}
        loading="lazy"
        className="max-h-64 rounded-lg"
        onError={() => setFailed(true)}
      />
    </a>
  );
}
