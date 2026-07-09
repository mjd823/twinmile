import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { BLOG_POSTS } from "@/lib/blog";

/**
 * Mongo-backed blog post store for the auto-blog pipeline.
 *
 * The 8 original posts stay hardcoded in lib/blog.ts (they keep rendering
 * unchanged); everything the pipeline generates lives in the `blogPosts`
 * collection with a draft → published/rejected review gate. Drafts are never
 * reachable publicly — only getPublishedBlogPosts()/getPublishedBySlug() are
 * used by public pages, and both filter status === "published".
 */

export type BlogPostStatus = "draft" | "published" | "rejected";

export interface BlogCitation {
  url: string;
  title: string;
  /** Publisher label (FMCSA, BLS, DOL, EIA, BTS, ...) */
  source: string;
  /** HTTP-verified at generation time (status < 400) */
  verified: boolean;
  httpStatus?: number;
  checkedAt: string;
}

export interface BlogSection {
  heading: string;
  paragraphs: string[];
}

export interface StoredBlogPost {
  _id?: ObjectId;
  slug: string;
  title: string;
  description: string;
  sections: BlogSection[];
  citations: BlogCitation[];
  status: BlogPostStatus;
  /** Reviewer attention flag: thin content, unverifiable citations, or unapproved figures */
  needsWork: boolean;
  /** Machine-generated notes explaining why needsWork was set */
  reviewNotes: string[];
  topicId: string;
  model: string;
  wordCount: number;
  readingTime: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  rejectedAt?: Date;
}

const COLLECTION = "blogPosts";

async function collection() {
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db().collection<StoredBlogPost>(COLLECTION);
}

export async function insertBlogDraft(
  draft: Omit<StoredBlogPost, "_id" | "createdAt" | "updatedAt" | "status">
): Promise<StoredBlogPost> {
  const col = await collection();
  if (!col) throw new Error("Database not configured (MONGODB_URI missing)");
  const now = new Date();
  const doc: StoredBlogPost = {
    ...draft,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

/** All pipeline posts, newest first (admin listing — includes drafts/rejected). */
export async function listBlogPosts(limit = 50): Promise<StoredBlogPost[]> {
  const col = await collection();
  if (!col) return [];
  return col.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getBlogPostById(id: string): Promise<StoredBlogPost | null> {
  const col = await collection();
  if (!col || !ObjectId.isValid(id)) return null;
  return col.findOne({ _id: new ObjectId(id) });
}

/** Published pipeline posts only — safe for public pages/sitemap. */
export async function getPublishedBlogPosts(): Promise<StoredBlogPost[]> {
  const col = await collection();
  if (!col) return [];
  return col.find({ status: "published" }).sort({ publishedAt: -1 }).toArray();
}

export async function getPublishedBySlug(slug: string): Promise<StoredBlogPost | null> {
  const col = await collection();
  if (!col) return null;
  return col.findOne({ slug, status: "published" });
}

/** True if the slug is taken by a legacy static post or any db post. */
export async function slugExists(slug: string): Promise<boolean> {
  if (BLOG_POSTS.some((p) => p.slug === slug)) return true;
  const col = await collection();
  if (!col) return false;
  return (await col.countDocuments({ slug }, { limit: 1 })) > 0;
}

/** True if any unreviewed draft is waiting — the weekly cron backs off. */
export async function hasPendingDraft(): Promise<boolean> {
  const col = await collection();
  if (!col) return false;
  return (await col.countDocuments({ status: "draft" }, { limit: 1 })) > 0;
}

/** True if any post was generated in the last `days` days (cadence guard). */
export async function hasRecentPost(days: number): Promise<boolean> {
  const col = await collection();
  if (!col) return false;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return (await col.countDocuments({ createdAt: { $gte: cutoff } }, { limit: 1 })) > 0;
}

/** Topic ids already used by any db post (so topics rotate without repeats). */
export async function usedTopicIds(): Promise<Set<string>> {
  const col = await collection();
  if (!col) return new Set();
  const ids = await col.distinct("topicId");
  return new Set(ids.filter((t): t is string => typeof t === "string"));
}

export interface BlogPostEdits {
  title?: string;
  description?: string;
  sections?: BlogSection[];
  needsWork?: boolean;
}

export async function updateBlogPost(
  id: string,
  edits: BlogPostEdits
): Promise<StoredBlogPost | null> {
  const col = await collection();
  if (!col || !ObjectId.isValid(id)) return null;
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof edits.title === "string" && edits.title.trim()) $set.title = edits.title.trim();
  if (typeof edits.description === "string") $set.description = edits.description.trim();
  if (Array.isArray(edits.sections)) {
    const sections = edits.sections
      .map((s) => ({
        heading: String(s.heading ?? "").trim(),
        paragraphs: (Array.isArray(s.paragraphs) ? s.paragraphs : [])
          .map((p) => String(p).trim())
          .filter(Boolean),
      }))
      .filter((s) => s.heading || s.paragraphs.length > 0);
    $set.sections = sections;
    const words = sections
      .flatMap((s) => [s.heading, ...s.paragraphs])
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    $set.wordCount = words;
    $set.readingTime = `${Math.max(1, Math.round(words / 200))} min`;
  }
  if (typeof edits.needsWork === "boolean") $set.needsWork = edits.needsWork;
  await col.updateOne({ _id: new ObjectId(id) }, { $set });
  return col.findOne({ _id: new ObjectId(id) });
}

export async function publishBlogPost(id: string): Promise<StoredBlogPost | null> {
  const col = await collection();
  if (!col || !ObjectId.isValid(id)) return null;
  const now = new Date();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "published", publishedAt: now, updatedAt: now } }
  );
  return col.findOne({ _id: new ObjectId(id) });
}

export async function rejectBlogPost(id: string): Promise<StoredBlogPost | null> {
  const col = await collection();
  if (!col || !ObjectId.isValid(id)) return null;
  const now = new Date();
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "rejected", rejectedAt: now, updatedAt: now } }
  );
  return col.findOne({ _id: new ObjectId(id) });
}

// ---------------------------------------------------------------------------
// Unified public view: legacy static posts + published pipeline posts
// ---------------------------------------------------------------------------

export interface PublicBlogPost {
  slug: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  publishedAt: string;
  readingTime: string;
  /** Legacy static posts: flat paragraphs */
  content?: string[];
  /** Pipeline posts: structured sections + verified sources */
  sections?: BlogSection[];
  citations?: BlogCitation[];
  lastModified: Date;
}

function toPublic(post: StoredBlogPost): PublicBlogPost {
  const published = post.publishedAt ?? post.createdAt;
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    publishedAt: published.toISOString().slice(0, 10),
    readingTime: post.readingTime,
    sections: post.sections,
    citations: post.citations.filter((c) => c.verified),
    lastModified: post.updatedAt ?? published,
  };
}

/** All publicly visible posts (legacy + published), newest first. */
export async function getAllPublicPosts(): Promise<PublicBlogPost[]> {
  const legacy: PublicBlogPost[] = BLOG_POSTS.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    publishedAt: p.publishedAt,
    readingTime: p.readingTime,
    content: p.content,
    lastModified: new Date(p.publishedAt),
  }));
  let db: PublicBlogPost[] = [];
  try {
    db = (await getPublishedBlogPosts()).map(toPublic);
  } catch (error) {
    // Public pages must never 500 because Mongo hiccuped — fall back to legacy.
    console.error("[blog-store] Failed to load published posts:", error);
  }
  return [...db, ...legacy].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/** Single publicly visible post by slug (legacy first, then published db). */
export async function getPublicPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const legacy = BLOG_POSTS.find((p) => p.slug === slug);
  if (legacy) {
    return {
      slug: legacy.slug,
      title: legacy.title,
      description: legacy.description,
      publishedAt: legacy.publishedAt,
      readingTime: legacy.readingTime,
      content: legacy.content,
      lastModified: new Date(legacy.publishedAt),
    };
  }
  try {
    const post = await getPublishedBySlug(slug);
    return post ? toPublic(post) : null;
  } catch (error) {
    console.error("[blog-store] Failed to load post by slug:", error);
    return null;
  }
}
