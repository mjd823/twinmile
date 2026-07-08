import clientPromise from "@/lib/mongodb";
import { SITE_CONFIG } from "@/lib/site-config";
import {
  buildPostsForDate,
  todayDateString,
  type AngleId,
} from "@/lib/social/post-pack";

/**
 * Daily recruiting post pack builder — architecture ported from
 * jaelynnsfashion lib/social/generate-pack.ts.
 *
 * Storage: one doc per UTC day in the `socialPacks` collection. This project
 * has no blob storage configured (no BLOB_READ_WRITE_TOKEN), so instead of
 * uploading PNGs we store an imageUrl pointing at /api/social-image, which
 * renders the 1080x1350 PNG on demand from the stored pack fields — always
 * available, zero storage dependencies.
 */

export interface SocialPackItem {
  slot: number;
  angleId: AngleId;
  headline: string;
  sub: string;
  bullets: string[];
  caption: string;
  /** On-demand render URL (absolute, for the hub + admin UI) */
  imageUrl: string;
  /** Where the post should send people */
  ctaUrl: string;
}

export interface SocialPackDoc {
  date: string;
  items: SocialPackItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratePackResult {
  created: boolean;
  date: string;
  reason?: string;
  pack: SocialPackDoc | null;
}

export function socialImageUrl(date: string, slot: number): string {
  return `${SITE_CONFIG.appUrl}/api/social-image?date=${date}&slot=${slot}`;
}

/**
 * Builds today's recruiting pack: rotate angles deterministically for the
 * date, store captions + render fields in `socialPacks`. Idempotent per UTC
 * day — an existing pack is returned untouched unless `force` is set.
 */
export async function generateDailyPack(options?: { force?: boolean }): Promise<GeneratePackResult> {
  if (!clientPromise) {
    throw new Error("Database not configured (MONGODB_URI missing)");
  }
  const client = await clientPromise;
  const collection = client.db().collection<SocialPackDoc>("socialPacks");

  const date = todayDateString();

  const existing = await collection.findOne({ date });
  if (existing && !options?.force) {
    return {
      created: false,
      date,
      reason: "Pack already exists for today",
      pack: existing,
    };
  }

  const items: SocialPackItem[] = buildPostsForDate(date).map((post) => ({
    slot: post.slot,
    angleId: post.angleId,
    headline: post.headline,
    sub: post.sub,
    bullets: post.bullets,
    caption: post.caption,
    imageUrl: socialImageUrl(date, post.slot),
    ctaUrl: `${SITE_CONFIG.appUrl}/drive-with-us`,
  }));

  const now = new Date();
  await collection.updateOne(
    { date },
    {
      $set: { items, updatedAt: now },
      $setOnInsert: { date, createdAt: now },
    },
    { upsert: true }
  );

  const pack = await collection.findOne({ date });
  return { created: true, date, pack };
}

/** Latest packs, newest first (admin listing + hub endpoint). */
export async function listPacks(limit: number): Promise<SocialPackDoc[]> {
  if (!clientPromise) return [];
  const client = await clientPromise;
  return client
    .db()
    .collection<SocialPackDoc>("socialPacks")
    .find({})
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
}

/** Pack for a specific date (used by the on-demand image route). */
export async function getPackByDate(date: string): Promise<SocialPackDoc | null> {
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db().collection<SocialPackDoc>("socialPacks").findOne({ date });
}
