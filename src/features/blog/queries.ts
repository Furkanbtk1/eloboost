import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";

import { plainText } from "./markdown";

/** Invalidated whenever a post is created, edited, published or deleted. */
export const BLOG_CACHE_TAG = "blog";

export type BlogPostSummary = {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: Date;
};

export type BlogPostFull = BlogPostSummary & { content: string; updatedAt: Date };

const excerptOf = (post: { excerpt: string | null; content: string }) =>
  post.excerpt?.trim() || `${plainText(post.content).slice(0, 157).trimEnd()}…`;

/** Newest published posts in one language. */
export async function listPublishedPosts(locale: string, take = 30): Promise<BlogPostSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(BLOG_CACHE_TAG);

  const posts = await db.blogPost.findMany({
    where: { isPublished: true, locale, publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take,
    select: { slug: true, locale: true, title: true, excerpt: true, content: true, author: true, publishedAt: true },
  });
  return posts.flatMap((post) =>
    post.publishedAt ? [{ slug: post.slug, locale: post.locale, title: post.title, excerpt: excerptOf(post), author: post.author, publishedAt: post.publishedAt }] : [],
  );
}

export async function getPublishedPost(slug: string): Promise<BlogPostFull | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(BLOG_CACHE_TAG);

  const post = await db.blogPost.findFirst({ where: { slug, isPublished: true, publishedAt: { not: null } } });
  if (!post?.publishedAt) return null;
  return {
    slug: post.slug,
    locale: post.locale,
    title: post.title,
    excerpt: excerptOf(post),
    author: post.author,
    publishedAt: post.publishedAt,
    content: post.content,
    updatedAt: post.updatedAt,
  };
}

/** Every published post, for the sitemap. */
export async function listPublishedSlugs(): Promise<{ slug: string; locale: string; updatedAt: Date }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(BLOG_CACHE_TAG);
  return db.blogPost.findMany({
    where: { isPublished: true },
    select: { slug: true, locale: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
  });
}

export type AdminPostRow = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  isPublished: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

export function listAllPosts(): Promise<AdminPostRow[]> {
  return db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, slug: true, locale: true, title: true, isPublished: true, publishedAt: true, updatedAt: true },
  });
}

export function getPostForEdit(id: string) {
  return db.blogPost.findUnique({ where: { id } });
}
