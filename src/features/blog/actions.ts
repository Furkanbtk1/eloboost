"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { adminErrors, getStaffActor, writeAudit } from "@/features/admin/server";
import { Prisma } from "@/generated/prisma/client";
import { routing } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";

import { slugify } from "./markdown";
import { BLOG_CACHE_TAG } from "./queries";

const PATH = "/admin/blog";

const postSchema = z.object({
  title: z.string().trim().min(3).max(120),
  /** Blank = derived from the title. */
  slug: z.string().trim().max(80),
  locale: z.enum(routing.locales),
  excerpt: z.string().trim().max(300),
  content: z.string().trim().min(20).max(60_000),
  author: z.string().trim().min(2).max(60),
  isPublished: z.boolean(),
});

export type BlogPostInput = z.input<typeof postSchema>;

const idSchema = z.uuid();

/** Create (no id) or update (with id). Publishing sets the date the first time. */
export async function savePostAction(rawLocale: string, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(t("invalid"), 400, typeof field === "string" ? { [field]: [t("invalid")] } : undefined);
  }
  const post = parsed.data;
  const slug = slugify(post.slug || post.title);
  if (slug.length < 3) return fail(t("invalid"), 400, { slug: [t("invalid")] });
  if (id !== null && !idSchema.safeParse(id).success) return fail(t("notFound"), 404);

  try {
    const saved = await db.$transaction(async (tx) => {
      const previous = id ? await tx.blogPost.findUnique({ where: { id }, select: { publishedAt: true } }) : null;
      if (id && !previous) return null;
      const data = {
        slug,
        locale: post.locale,
        title: post.title,
        excerpt: post.excerpt || null,
        content: post.content,
        author: post.author,
        isPublished: post.isPublished,
        publishedAt: post.isPublished ? (previous?.publishedAt ?? new Date()) : (previous?.publishedAt ?? null),
      };
      const row = id ? await tx.blogPost.update({ where: { id }, data }) : await tx.blogPost.create({ data });
      await writeAudit(tx, {
        adminId: actor.id,
        action: id ? (post.isPublished ? "blog.update" : "blog.unpublish") : "blog.create",
        targetType: "BlogPost",
        targetId: row.slug,
        details: { title: post.title, locale: post.locale, published: post.isPublished },
      });
      return row;
    });
    if (!saved) return fail(t("notFound"), 404);
    updateTag(BLOG_CACHE_TAG);
    return ok({ id: saved.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(t("slugExists"), 409, { slug: [t("slugExists")] });
    }
    throw error;
  }
}

export async function deletePostAction(rawLocale: string, id: string): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  if (!idSchema.safeParse(id).success) return fail(t("notFound"), 404);

  const deleted = await db.$transaction(async (tx) => {
    const post = await tx.blogPost.findUnique({ where: { id }, select: { slug: true, title: true } });
    if (!post) return false;
    await tx.blogPost.delete({ where: { id } });
    await writeAudit(tx, { adminId: actor.id, action: "blog.delete", targetType: "BlogPost", targetId: post.slug, details: { title: post.title } });
    return true;
  });
  if (!deleted) return fail(t("notFound"), 404);
  updateTag(BLOG_CACHE_TAG);
  return ok(undefined);
}
