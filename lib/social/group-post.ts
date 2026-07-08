import { SITE_CONFIG } from "@/lib/site-config";
import { seedForDate } from "@/lib/social/post-pack";

/**
 * Sofia's daily GROUP POST draft — the Facebook human-in-loop kit.
 *
 * Plain-text, honest, named-human voice for owner-operator Facebook groups
 * and subreddits (r/Truckers etc.). A HUMAN copies and posts it — there is NO
 * automation against Facebook (the API integration was removed; group
 * automation violates ToS) and none against Reddit.
 *
 * Every number is computed from the VERIFIED site pay copy
 * (lib/social/post-pack.ts / app/drive-with-us): 80% gross to the truck,
 * $250k-$350k+ annual gross potential, 100% fuel surcharge pass-through,
 * weekly direct deposit by Tuesday, lease onto MC-1790263 or run your own
 * authority. The settlement-breakdown math below is straight arithmetic on
 * those figures — do NOT invent per-mile rates or load prices beyond labeled
 * examples.
 */

export const GROUP_POST_PLATFORMS = [
  "Facebook groups (owner-operator / power-only)",
  "Reddit (r/Truckers, r/OwnerOperators)",
];

export const GROUP_POST_RULES =
  "Human posts this manually — no automation, no scheduling tools against FB/Reddit. " +
  "Post from MJ's real profile, answer comments honestly, respect each group's promo rules.";

export type GroupPostAngleId =
  | "settlement-math"
  | "straight-intro"
  | "new-authority-welcome"
  | "home-time-honest";

export interface GroupPostDraft {
  angleId: GroupPostAngleId;
  /** Short internal label shown in the admin UI */
  label: string;
  /** Ready-to-copy plain text */
  text: string;
  platforms: string[];
  rules: string;
}

// ── Verified pay copy as numbers (single source for the math) ─────────────
const PAY_SHARE = 0.8; // 80% gross to the truck (site copy)
const ANNUAL_GROSS_LOW = 250_000; // $250k (site copy)
const ANNUAL_GROSS_HIGH = 350_000; // $350k+ (site copy)

const usd = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

function mcDisplay(): string {
  return SITE_CONFIG.mcNumber.startsWith("MC")
    ? SITE_CONFIG.mcNumber
    : `MC ${SITE_CONFIG.mcNumber}`;
}

const DRIVE_URL = `${SITE_CONFIG.appUrl}/drive-with-us`;
const SIGNATURE = `— MJ, co-owner, Twin Mile (${mcDisplay()}, Houston TX)`;

/**
 * The "80% gross, here's the actual math" settlement breakdown. Example load
 * value is labeled as an example; the weekly/annual lines are computed from
 * the verified $250k-$350k gross range and the verified 80% share.
 */
function settlementMathPost(): string {
  const exampleLoad = 2_000; // labeled example gross, math shown transparently
  const weeklyLow = ANNUAL_GROSS_LOW / 52;
  const weeklyHigh = ANNUAL_GROSS_HIGH / 52;
  return [
    `I'm MJ, co-owner at Twin Mile in Houston (${mcDisplay()}). I see a lot of "we pay top %" posts with no math, so here's ours, actually worked out:`,
    "",
    `We pay 80% of gross to the truck. Example load paying ${usd(exampleLoad)} gross:`,
    `• Truck gets 80% = ${usd(exampleLoad * PAY_SHARE)}`,
    `• Fuel surcharge on top — 100% passes through to you, we keep none of it`,
    `• Settlement pays weekly, direct deposit by Tuesday`,
    "",
    `Our guys running consistently gross ${usd(ANNUAL_GROSS_LOW)}-${usd(ANNUAL_GROSS_HIGH)}+ a year. That's roughly ${usd(weeklyLow)}-${usd(weeklyHigh)} gross a week, so at 80% the truck's share works out to about ${usd(weeklyLow * PAY_SHARE)}-${usd(weeklyHigh * PAY_SHARE)} a week before your fuel and expenses. Your loads will vary — that's the honest range, not a promise.`,
    "",
    `Power-only freight. Run your own authority or lease onto our ${mcDisplay()}. Happy to answer anything in the comments, including the uncomfortable questions.`,
    "",
    `Application takes 2 minutes: ${DRIVE_URL}`,
    "",
    SIGNATURE,
  ].join("\n");
}

function straightIntroPost(): string {
  return [
    `I'm MJ, co-owner at Twin Mile in Houston (${mcDisplay()}). Small power-only carrier, and I'd rather be upfront in a group post than hide behind a recruiter script:`,
    "",
    `• 80% of gross goes to the truck — transparent settlements, no hidden fees`,
    `• 100% of the fuel surcharge is yours`,
    `• Weekly settlements, direct deposit by Tuesday`,
    `• ${usd(ANNUAL_GROSS_LOW)}-${usd(ANNUAL_GROSS_HIGH)}+ annual gross potential running consistently — your loads will vary`,
    `• Keep your own authority, or lease onto our ${mcDisplay()}`,
    "",
    `We're small on purpose. You get a person, not a queue. If that sounds like your kind of setup, the application takes 2 minutes: ${DRIVE_URL}`,
    "",
    `Questions welcome below — I answer them myself.`,
    "",
    SIGNATURE,
  ].join("\n");
}

function newAuthorityWelcomePost(): string {
  return [
    `I'm MJ, co-owner at Twin Mile in Houston (${mcDisplay()}). To everyone who just got their authority this month — congrats, and a straight answer to the question I see daily: "run my own MC or lease on?"`,
    "",
    `Honestly, both work here:`,
    `• Run your own authority and we move you on power-only freight`,
    `• Or lease onto our ${mcDisplay()} and save on insurance and compliance costs while you build`,
    "",
    `Either way the deal is the same: 80% of gross to the truck, 100% fuel surcharge pass-through, weekly settlements with direct deposit by Tuesday. ${usd(ANNUAL_GROSS_LOW)}-${usd(ANNUAL_GROSS_HIGH)}+ annual gross potential running consistently.`,
    "",
    `2+ years OTR preferred, but newer CDL holders are welcome — we review every application individually and most people hear back within 1 business day.`,
    "",
    `Apply in 2 minutes: ${DRIVE_URL}`,
    "",
    SIGNATURE,
  ].join("\n");
}

function homeTimeHonestPost(): string {
  return [
    `I'm MJ, co-owner at Twin Mile in Houston (${mcDisplay()}). Unpopular opinion from a carrier owner: dispatch shouldn't decide when you see your family.`,
    "",
    `At our size we match loads to YOUR home base and availability — you pick your lanes. Nationwide power-only with strong coverage in TX, LA, CA, GA, and TN. OTR and regional.`,
    "",
    `The money side, since nobody should have to DM for it: 80% of gross to the truck, 100% fuel surcharge yours, weekly settlements by Tuesday, ${usd(ANNUAL_GROSS_LOW)}-${usd(ANNUAL_GROSS_HIGH)}+ annual gross potential running consistently.`,
    "",
    `If you've been burned by "forced dispatch" before, ask me anything below.`,
    "",
    `Application: ${DRIVE_URL}`,
    "",
    SIGNATURE,
  ].join("\n");
}

interface AngleDef {
  id: GroupPostAngleId;
  label: string;
  build: () => string;
}

const GROUP_ANGLES: AngleDef[] = [
  {
    id: "settlement-math",
    label: "80% gross — the actual math",
    build: settlementMathPost,
  },
  { id: "straight-intro", label: "Straight intro, no recruiter script", build: straightIntroPost },
  {
    id: "new-authority-welcome",
    label: "New authority? Own MC vs lease-on",
    build: newAuthorityWelcomePost,
  },
  { id: "home-time-honest", label: "Home time, honestly", build: homeTimeHonestPost },
];

/** Deterministic daily rotation — same seed scheme as the image pack. */
export function buildGroupPostForDate(date: string): GroupPostDraft {
  const seed = seedForDate(date);
  const angle = GROUP_ANGLES[((seed % GROUP_ANGLES.length) + GROUP_ANGLES.length) % GROUP_ANGLES.length];
  return {
    angleId: angle.id,
    label: angle.label,
    text: angle.build(),
    platforms: GROUP_POST_PLATFORMS,
    rules: GROUP_POST_RULES,
  };
}
