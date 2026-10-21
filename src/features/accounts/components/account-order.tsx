import { ArrowLeftIcon, MailCheckIcon, MailXIcon, SwordsIcon } from "lucide-react";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import type { CustomerOrderDetail } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";

import { getDeliveredAccount } from "../queries";
import { CopyField } from "./copy-field";

/** Order page for a shop purchase: no booster, chat or vault; the delivered login is the product. */
export async function AccountOrder({ order, customerId }: { order: CustomerOrderDetail; customerId: string }) {
  const [t, tOrders, format, account] = await Promise.all([
    getTranslations("Shop"),
    getTranslations("Orders"),
    getFormatter(),
    order.status === "COMPLETED" ? getDeliveredAccount(order.orderNumber, customerId) : Promise.resolve(null),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {order.game.logoUrl && <Image src={order.game.logoUrl} alt="" width={52} height={52} className="rounded-xl" />}
          <div>
            <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
              <Link href="/dashboard">
                <ArrowLeftIcon />
                {tOrders("detail.back")}
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {order.game.name} <span className="font-mono text-base text-muted-foreground">{order.orderNumber}</span>
            </h1>
            <p className="text-muted-foreground">{format.number(order.total, { style: "currency", currency: order.currency })}</p>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === "AWAITING_PAYMENT" && (
        <Button asChild className="justify-self-start">
          <Link href={`/checkout/${order.orderNumber}`}>{tOrders("pay")}</Link>
        </Button>
      )}

      {order.status === "CANCELLED" && (
        <Alert variant="destructive">
          <AlertDescription>{t("delivered.cancelled")}</AlertDescription>
        </Alert>
      )}

      {account && (
        <Card>
          <CardHeader>
            <CardTitle>{t("delivered.title")}</CardTitle>
            <CardDescription>{t("delivered.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <li>
                {t("delivered.tier")}: <span className="font-medium text-foreground">{account.tier}</span>
              </li>
              <li>
                {t("delivered.server")}: <span className="font-medium text-foreground">{account.serverCode}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <SwordsIcon className="size-4" />
                {t("champions", { count: account.championCount })}
              </li>
              <li className="flex items-center gap-1.5">
                {account.hasMailAccess ? <MailCheckIcon className="size-4 text-emerald-400" /> : <MailXIcon className="size-4" />}
                {account.hasMailAccess ? t("mailYes") : t("mailNo")}
              </li>
            </ul>
            <CopyField label={t("delivered.username")} value={account.username} />
            <CopyField label={t("delivered.password")} value={account.password} secret />
            {account.email && <CopyField label={t("delivered.email")} value={account.email} />}
            {account.emailPassword && <CopyField label={t("delivered.emailPassword")} value={account.emailPassword} secret />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
