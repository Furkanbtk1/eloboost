"use client";

import {
  BellIcon,
  CheckCheckIcon,
  InfoIcon,
  MessageSquareIcon,
  PackageIcon,
  ShieldAlertIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getNotificationFeedAction, markNotificationsReadAction } from "@/features/notifications/actions";
import type { NotificationItem } from "@/features/notifications/queries";
import type { NotificationType } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { channels, events } from "@/lib/realtime/channels";
import { useRealtimeEvent } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, LucideIcon> = {
  ORDER_UPDATE: PackageIcon,
  NEW_MESSAGE: MessageSquareIcon,
  PAYOUT_UPDATE: WalletIcon,
  DISPUTE_UPDATE: ShieldAlertIcon,
  SYSTEM: InfoIcon,
};

/** Header bell: red dot while anything is unread, live through the user's private channel. */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const t = useTranslations("Notifications");
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    const result = await getNotificationFeedAction();
    setFailed(!result.success);
    if (!result.success) return;
    setUnread(result.data.unread);
    setItems(result.data.items);
  };

  useRealtimeEvent(channels.user(userId), events.notification, () => void load());

  const markRead = async (ids?: string[]) => {
    const result = await markNotificationsReadAction(ids);
    if (!result.success) return;
    setUnread(result.data.unread);
    setItems((current) => current?.map((item) => (!ids || ids.includes(item.id) ? { ...item, isRead: true } : item)) ?? null);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${t("open")}. ${t("unread", { count: unread })}`}>
          <BellIcon />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">{t("title")}</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={unread === 0}
            onClick={() => void markRead()}
          >
            <CheckCheckIcon />
            {t("markAllRead")}
          </Button>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto p-1">
          {failed ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("loadFailed")}</p>
          ) : items === null ? (
            <div className="grid gap-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <NotificationList items={items} onRead={(id) => void markRead([id])} />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Rendered only while the menu is open, so the clock is read in the browser. */
function NotificationList({ items, onRead }: { items: NotificationItem[]; onRead: (id: string) => void }) {
  const t = useTranslations("Notifications");
  const tStatus = useTranslations("OrderStatus");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  const describe = (item: NotificationItem): string => {
    const orderNumber = item.orderNumber ?? "";
    switch (item.type) {
      case "ORDER_UPDATE":
        if (item.event === "details_updated") return t("orderDetailsUpdated", { orderNumber });
        return item.orderStatus
          ? t("orderStatus", { orderNumber, status: tStatus(item.orderStatus) })
          : t("orderUpdated", { orderNumber });
      case "NEW_MESSAGE":
        return item.from ? t("newMessageFrom", { orderNumber, from: item.from }) : t("newMessage", { orderNumber });
      case "DISPUTE_UPDATE":
        return t("dispute", { orderNumber, status: item.status ?? "other" });
      case "PAYOUT_UPDATE":
        return t("payout", {
          amount: format.number(item.amount ?? 0, { style: "currency", currency: "USD" }),
          status: item.status ?? "other",
        });
      case "SYSTEM":
        return t("system");
    }
  };

  return items.map((item) => {
    const Icon = ICONS[item.type];
    const body = (
      <>
        <Icon className={cn("mt-0.5 shrink-0", item.isRead ? "text-muted-foreground" : "text-primary")} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={cn("text-sm leading-snug", !item.isRead && "font-medium")}>{describe(item)}</span>
          <span className="text-xs text-muted-foreground">{format.relativeTime(item.createdAt, now)}</span>
        </span>
        {!item.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
      </>
    );
    return item.link ? (
      <DropdownMenuItem key={item.id} asChild className="items-start gap-3 px-3 py-2.5">
        <Link href={item.link} onClick={() => !item.isRead && onRead(item.id)}>
          {body}
        </Link>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem
        key={item.id}
        className="items-start gap-3 px-3 py-2.5"
        onSelect={() => !item.isRead && onRead(item.id)}
      >
        {body}
      </DropdownMenuItem>
    );
  });
}
