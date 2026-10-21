"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addStockAction, createProductAction, updateProductAction } from "@/features/accounts/admin-actions";
import type { AdminProductRow } from "@/features/accounts/admin-queries";
import type { AccountKind } from "@/generated/prisma/enums";

type GameOption = { slug: string; name: string; servers: { code: string; name: string }[] };

export function NewProductForm({ games }: { games: GameOption[] }) {
  const t = useTranslations("Admin.accounts.form");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [gameSlug, setGameSlug] = useState(games[0]?.slug ?? "");
  const [kind, setKind] = useState<AccountKind>("ACCOUNT");
  const [serverCode, setServerCode] = useState(games[0]?.servers[0]?.code ?? "");
  const [tier, setTier] = useState("");
  const [level, setLevel] = useState("");
  const [champions, setChampions] = useState("");
  const [price, setPrice] = useState("");
  const [mail, setMail] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const game = games.find((entry) => entry.slug === gameSlug);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createProductAction(locale, {
        gameSlug,
        kind,
        serverCode,
        tier,
        level: level.trim() === "" ? null : Number(level),
        championCount: Number(champions),
        hasMailAccess: mail,
        price: Number(price),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.message);
      }
      setErrors({});
      setTier("");
      toast.success(t("created"));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="np-game">{t("game")}</Label>
        <NativeSelect
          id="np-game"
          value={gameSlug}
          onChange={(event) => {
            setGameSlug(event.target.value);
            setServerCode(games.find((entry) => entry.slug === event.target.value)?.servers[0]?.code ?? "");
          }}
        >
          {games.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="np-kind">{t("kind")}</Label>
        <NativeSelect id="np-kind" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
          <option value="ACCOUNT">{t("account")}</option>
          <option value="SMURF">{t("smurf")}</option>
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="np-server">{t("server")}</Label>
        <NativeSelect id="np-server" value={serverCode} onChange={(event) => setServerCode(event.target.value)}>
          {game?.servers.map((server) => (
            <option key={server.code} value={server.code}>
              {server.name} ({server.code})
            </option>
          ))}
        </NativeSelect>
      </div>
      <FormField id="np-tier" label={t("tier")} value={tier} onChange={(event) => setTier(event.target.value)} error={errors.tier?.[0]} placeholder="Hand-Leveled Rookie" maxLength={60} />
      <FormField id="np-level" label={t("level")} type="number" min={1} value={level} onChange={(event) => setLevel(event.target.value)} error={errors.level?.[0]} />
      <FormField id="np-champs" label={t("champions")} type="number" min={0} value={champions} onChange={(event) => setChampions(event.target.value)} error={errors.championCount?.[0]} />
      <FormField id="np-price" label={t("price")} type="number" min={1} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} error={errors.price?.[0]} />
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <Checkbox checked={mail} onCheckedChange={(checked) => setMail(checked === true)} />
        {t("mail")}
      </label>
      <Button type="submit" disabled={isPending || !tier || !champions || !price} className="justify-self-start sm:col-span-2 lg:col-span-4">
        {t("create")}
      </Button>
    </form>
  );
}

export function ProductRow({ product }: { product: AdminProductRow }) {
  const t = useTranslations("Admin.accounts");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [price, setPrice] = useState(String(product.price));
  const [adding, setAdding] = useState(false);
  const [stock, setStock] = useState("");

  const run = (action: () => Promise<{ success: boolean; message?: string }>, done: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.success) return void toast.error(result.message);
      toast.success(done);
      router.refresh();
    });

  const save = (isActive: boolean) =>
    run(() => updateProductAction(locale, product.id, { price: Number(price), isActive }), t("saved"));

  return (
    <li className="grid gap-3 rounded-xl border bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="font-medium">
            {product.gameName} · {product.tier}
          </span>
          <span className="text-xs text-muted-foreground">
            {product.kind === "ACCOUNT" ? t("form.account") : t("form.smurf")} · {product.serverCode} ·{" "}
            {product.level !== null ? `${t("form.level")} ${product.level} · ` : ""}
            {product.championCount} · {product.hasMailAccess ? t("mailYes") : t("mailNo")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={product.available > 0 ? "default" : "secondary"}>{t("available", { count: product.available })}</Badge>
          <span className="text-xs text-muted-foreground">{t("sold", { count: product.sold })}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-label={t("price")}
            className="h-8 w-28 text-right tabular-nums"
          />
          <Button size="sm" variant="outline" disabled={isPending || Number(price) === product.price} onClick={() => save(product.isActive)}>
            {t("savePrice")}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={product.isActive} disabled={isPending} onCheckedChange={(checked) => save(checked)} aria-label={t("active")} />
          {t("active")}
        </label>
        <Button size="sm" variant="ghost" onClick={() => setAdding((current) => !current)}>
          {t("addStock")}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{format.number(product.price, { style: "currency", currency: "USD" })}</span>
      </div>
      {adding && (
        <div className="grid gap-2">
          <Textarea value={stock} onChange={(event) => setStock(event.target.value)} rows={5} className="font-mono text-xs" placeholder={t("stockPlaceholder")} aria-label={t("addStock")} />
          <p className="text-xs text-muted-foreground">{t("stockHint")}</p>
          <Button
            size="sm"
            className="justify-self-start"
            disabled={isPending || !stock.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await addStockAction(locale, product.id, stock);
                if (!result.success) return void toast.error(result.message);
                toast.success(t("stockAdded", { count: result.data.added }));
                setStock("");
                setAdding(false);
                router.refresh();
              })
            }
          >
            {t("importStock")}
          </Button>
        </div>
      )}
    </li>
  );
}
