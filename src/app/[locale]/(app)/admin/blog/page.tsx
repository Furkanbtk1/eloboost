import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPostForEdit, listAllPosts } from "@/features/blog/queries";
import { PostForm } from "@/features/blog/components/post-form";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/admin/blog">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("blog"), robots: { index: false } };
}

export default function AdminBlogPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminBlog searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminBlog({ searchParams }: Pick<Props, "searchParams">) {
  const admin = await requireArea("/admin/blog");
  const { edit, new: isNew } = await searchParams;
  const [t, format] = await Promise.all([getTranslations("Admin.blog"), getFormatter()]);

  if (typeof edit === "string" || isNew !== undefined) {
    const existing = typeof edit === "string" && /^[0-9a-f-]{36}$/.test(edit) ? await getPostForEdit(edit) : null;
    return (
      <>
        <PanelHeader title={existing ? t("editTitle") : t("newTitle")}>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/blog">{t("back")}</Link>
          </Button>
        </PanelHeader>
        <PostForm
          key={existing?.id ?? "new"}
          initial={{
            id: existing?.id ?? null,
            title: existing?.title ?? "",
            slug: existing?.slug ?? "",
            locale: existing?.locale ?? "en",
            excerpt: existing?.excerpt ?? "",
            content: existing?.content ?? "",
            author: existing?.author ?? admin.name ?? "EloBoost",
            isPublished: existing?.isPublished ?? false,
          }}
        />
      </>
    );
  }

  const posts = await listAllPosts();
  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")}>
        <Button asChild size="sm">
          <Link href={{ pathname: "/admin/blog", query: { new: "1" } }}>
            <PlusIcon />
            {t("new")}
          </Link>
        </Button>
      </PanelHeader>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <table className="w-full min-w-[34rem] text-left text-sm">
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-t first:border-0">
                    <td className="py-2.5">
                      <div className="grid">
                        <span className="font-medium">{post.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">/{post.slug}</span>
                      </div>
                    </td>
                    <td className="py-2.5 uppercase">{post.locale}</td>
                    <td className="py-2.5">
                      <Badge variant={post.isPublished ? "default" : "secondary"}>{post.isPublished ? t("published") : t("draft")}</Badge>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{format.dateTime(post.updatedAt, { dateStyle: "medium" })}</td>
                    <td className="py-2.5 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={{ pathname: "/admin/blog", query: { edit: post.id } }} aria-label={t("edit")}>
                          <PencilIcon />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
