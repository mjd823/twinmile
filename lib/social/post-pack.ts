import { SITE_CONFIG } from "@/lib/site-config";

/**
 * Daily recruiting post pack — owner-operator recruitment content.
 *
 * Architecture ported from jaelynnsfashion lib/social/post-pack.ts, adapted
 * for recruiting: instead of picking products, content rotates
 * deterministically through honest recruiting angles. Every number in these
 * templates is verified against the live site copy (app/drive-with-us):
 * 80% gross to the truck, $250k-$350k+ annual gross potential, 100% fuel
 * surcharge pass-through, weekly direct deposit by Tuesday, lease onto
 * MC-1790263 or run your own authority. Do NOT add pay figures that are not
 * on the site.
 */

export const POSTS_PER_PACK = 2;

export type AngleId = "pay-transparency" | "home-time" | "new-authority" | "paperwork";

export interface RecruitingAngle {
  id: AngleId;
  /** Big display headline on the rendered image */
  headline: string;
  /** Supporting line under the headline */
  sub: string;
  /** Three short proof points rendered as bullets */
  bullets: [string, string, string];
  /** Caption body (hashtags appended separately) */
  caption: string;
}

const DRIVE_URL = `${SITE_CONFIG.appUrl}/drive-with-us`;

/** MC/DOT trust line shown on every image (from lib/site-config). */
export const TRUST_LINE = [
  SITE_CONFIG.dotNumber ? `USDOT ${SITE_CONFIG.dotNumber}` : null,
  SITE_CONFIG.mcNumber
    ? SITE_CONFIG.mcNumber.startsWith("MC")
      ? SITE_CONFIG.mcNumber
      : `MC ${SITE_CONFIG.mcNumber}`
    : null,
  `${SITE_CONFIG.city}, ${SITE_CONFIG.state}`,
]
  .filter(Boolean)
  .join(" • ");

export const ANGLES: RecruitingAngle[] = [
  {
    id: "pay-transparency",
    headline: "80% GROSS.\nTO THE TRUCK.",
    sub: "Transparent settlements. No hidden fees.",
    bullets: [
      "$250k–$350k+ annual gross potential",
      "100% fuel surcharge — you keep it",
      "Weekly direct deposit by Tuesday",
    ],
    caption:
      `No games with your money. Owner-operators at Twin Mile earn 80% gross to the truck with $250k–$350k+ annual gross potential, 100% fuel surcharge pass-through, and weekly direct deposit by Tuesday. You see exactly what you earn on every load.\n\nPower-only freight, nationwide lanes. Apply in 2 minutes → ${DRIVE_URL}`,
  },
  {
    id: "home-time",
    headline: "YOUR LANES.\nYOUR HOME TIME.",
    sub: "We match loads to your home base — not the other way around.",
    bullets: [
      "You pick your preferred lanes",
      "Nationwide coverage — strong TX, LA, CA, GA, TN",
      "Flexible schedule — OTR and regional routes",
    ],
    caption:
      `Tired of dispatch deciding when you see your family? At Twin Mile you pick your lanes and we match loads to your availability and home base. Nationwide power-only freight with strong coverage across TX, LA, CA, GA, and TN — OTR and regional.\n\nDrive with us → ${DRIVE_URL}`,
  },
  {
    id: "new-authority",
    headline: "NEW AUTHORITY?\nWELCOME.",
    sub: "Run your own MC — or lease onto ours.",
    bullets: [
      `Lease onto ${SITE_CONFIG.mcNumber} or run your own authority`,
      "Newer CDL holders welcome — every application reviewed",
      "Most applicants hear back within 1 business day",
    ],
    caption:
      `Just got your authority — or still deciding? Both work here. Run under your own MC, or lease onto our ${SITE_CONFIG.mcNumber} authority and save on insurance and compliance costs. 2+ years OTR preferred, but newer CDL holders are welcome — we review every application individually.\n\nApply in 2 minutes → ${DRIVE_URL}`,
  },
  {
    id: "paperwork",
    headline: "WE HANDLE\nTHE PAPERWORK.",
    sub: "You drive. We keep the back office moving.",
    bullets: [
      "7-step self-serve onboarding portal",
      "Guided docs: CDL, COI, W-9, MVR, ELD cert",
      "Fuel advances, ELD & fuel discounts included",
    ],
    caption:
      `Onboarding shouldn't take weeks of phone tag. Our 7-step self-serve portal walks you through identity verification, the FMCSA check, e-signing your lease agreement, and uploading your documents (CDL, COI, W-9, MVR, ELD cert) — then we get you dispatched. Business support included: fuel advances, ELD, and fuel discounts.\n\nDrive with us → ${DRIVE_URL}`,
  },
];

const CORE_HASHTAGS = ["#OwnerOperator", "#Trucking", "#CDL"];
const ROTATING_HASHTAGS = [
  "#PowerOnly",
  "#TruckDriver",
  "#TruckingLife",
  "#CDLDriver",
  "#HotshotTrucking",
  "#Logistics",
  "#HoustonTX",
];

/** Days since epoch (UTC) — deterministic per-day seed for rotation. */
export function daySeed(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

export function todayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Seed for an arbitrary YYYY-MM-DD date string. */
export function seedForDate(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export interface RecruitingPost {
  slot: number;
  angleId: AngleId;
  headline: string;
  sub: string;
  bullets: [string, string, string];
  caption: string;
}

function hashtagsFor(seed: number, slot: number): string {
  const base = Math.abs(seed * POSTS_PER_PACK + slot);
  return [
    ...CORE_HASHTAGS,
    ROTATING_HASHTAGS[base % ROTATING_HASHTAGS.length],
    ROTATING_HASHTAGS[(base + 3) % ROTATING_HASHTAGS.length],
  ].join(" ");
}

/**
 * Deterministic pick of POSTS_PER_PACK angles for a given date. Consecutive
 * days walk pairs through the angle list ((0,1), (2,3), (0,1), ...) so all
 * four angles appear every two days and a day's two posts never repeat an
 * angle.
 */
export function buildPostsForDate(date: string): RecruitingPost[] {
  const seed = seedForDate(date);
  const posts: RecruitingPost[] = [];
  for (let slot = 0; slot < POSTS_PER_PACK; slot++) {
    const angle = ANGLES[(seed * POSTS_PER_PACK + slot) % ANGLES.length];
    posts.push({
      slot,
      angleId: angle.id,
      headline: angle.headline,
      sub: angle.sub,
      bullets: angle.bullets,
      caption: `${angle.caption}\n\n${hashtagsFor(seed, slot)}`,
    });
  }
  return posts;
}
