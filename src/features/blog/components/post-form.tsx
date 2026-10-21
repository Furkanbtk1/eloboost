"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { deletePostAction, savePostAction } from "@/features/blog/actions";
import { PostBody } from "@/features/blog/components/post-body";
import { routing } from "@/i18n/routing";

type Initial = {
  id: string | null;
  title: string;
  slug: string;
  locale: string;
  excerpt: string;
  content: string;
  author: string;
  isPublished: boolean;
};

/** Write or edit a post, with a live preview rendered by the same safe renderer the site uses. */
export function PostForm({ initial }: { initial: Initial }) {
  const t = useTranslations("Admin.blog.form");
  const tLocale = useTranslations("Locale");
  const uiLocale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof Initial>(key: K, value: Initial[K]) => setValues((current) => ({ ...current, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const { id, ...input } = values;
      const result = await savePostAction(uiLocale, id, input);
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.message);
      }
      setErrors({});
      toast.success(values.isPublished ? t("savedPublished") : t("savedDraft"));
      if (!id) router.replace(`/admin/blog?edit=${result.data.id}`);
      else router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      if (!values.id || !window.confirm(t("confirmDelete"))) return;
      const result = await deletePostAction(uiLocale, values.id);
      if (!result.success) return void toast.error(result.message);
      toast.success(t("deleted"));
      router.replace("/admin/blog");
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <FormField id="post-title" label={t("title")} value={values.title} onChange={(e) => set("title", e.target.value)} error={errors.title?.[0]} maxLength={120} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="post-slug"
            label={t("slug")}
            value={values.slug}
            onChange={(e) => set("slug", e.target.value)}
            error={errors.slug?.[0]}
            placeholder={t("slugAuto")}
            maxLength={80}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="post-locale">{t("language")}</Label>
            <NativeSelect id="post-locale" value={values.locale} onChange={(e) => set("locale", e.target.value)}>
              {routing.locales.map((code) => (
                <option key={code} value={code}>
                  {tLocale(code)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <FormField id="post-author" label={t("author")} value={values.author} onChange={(e) => set("author", e.target.value)} error={errors.author?.[0]} maxLength={60} />
        <div className="grid gap-1.5">
          <Label htmlFor="post-excerpt">{t("excerpt")}</Label>
          <Textarea id="post-excerpt" value={values.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} maxLength={300} />
          <p className="text-xs text-muted-foreground">{t("excerptHint")}</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="post-content">{t("content")}</Label>
          <Textarea id="post-content" value={values.content} onChange={(e) => set("content", e.target.value)} rows={16} className="font-mono text-sm" />
          {errors.content?.[0] && <p className="text-sm text-destructive">{errors.content[0]}</p>}
          <p className="text-xs text-muted-foreground">{t("contentHint")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={values.isPublished} onCheckedChange={(checked) => set("isPublished", checked === true)} />
          {t("publish")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={isPending}>
            {t("save")}
          </Button>
          {values.id && (
            <Button variant="outline" className="text-destructive" onClick={remove} disabled={isPending}>
              {t("delete")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid content-start gap-3 rounded-xl border bg-card p-5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("preview")}</span>
        <h1 className="text-3xl font-bold tracking-tight">{values.title || t("untitled")}</h1>
        <PostBody content={values.content || t("previewEmpty")} />
      </div>
    </div>
  );
}
