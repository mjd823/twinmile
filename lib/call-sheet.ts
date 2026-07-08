import type { Db, ObjectId } from "mongodb";

import { SITE_CONFIG } from "@/lib/site-config";

/**
 * Daily call sheet for PHONE-ONLY prospects — carriers Sofia found in FMCSA
 * data who have a phone number but no email, so the email invite pipeline
 * can never reach them. A human (MJ or partner) dials from a phone.
 *
 * COMPLIANCE (baked in, non-negotiable):
 *   - HUMAN DIALS ONLY. No autodialer, no AI voice, no robocalls.
 *   - Anyone who says "take me off your list" is marked DNC immediately via
 *     the one-tap admin action; the dncList collection is checked (by phone
 *     AND DOT number) on every future selection.
 *   - Best-call-window note keeps calls inside 9am-6pm RECIPIENT local time.
 *
 * Every pay number in the scripts is the VERIFIED site copy
 * (lib/social/post-pack.ts / app/drive-with-us): 80% gross to the truck,
 * $250k-$350k+ annual gross potential, 100% fuel surcharge pass-through,
 * weekly direct deposit by Tuesday, lease onto MC-1790263 or run your own
 * authority. Do NOT add rates that are not on the site.
 */

export const CALL_SHEET_SIZE = 20;

export const COMPLIANCE_HEADER =
  "HUMAN DIALS ONLY — no autodialer, no AI voice, no robocalls. If they say " +
  '"take me off your list", tap Mark DNC immediately and end the call ' +
  "politely. Call only inside the listed window (9am-6pm THEIR local time).";

export interface CallSheetItem {
  prospectId: string;
  dotNumber: string;
  name: string;
  company: string;
  phone: string;
  phoneDial: string;
  city: string;
  state: string;
  truckInfo: string;
  sourceTag: string;
  priorityScore: number;
  aiScore: number;
  callWindow: string;
  script: string;
  status: "pending" | "called" | "dnc";
  calledAt?: string | null;
}

export interface CallSheetDoc {
  date: string; // YYYY-MM-DD UTC
  generatedAt: Date;
  complianceHeader: string;
  items: CallSheetItem[];
}

export interface CallSheetReport {
  created: boolean;
  date: string;
  selected: number;
  skippedDnc: number;
  bySource: Record<string, number>;
  reason?: string;
}

/** US state → IANA timezone (dominant zone for split states). */
const STATE_TZ: Record<string, string> = {
  TX: "America/Chicago",
  LA: "America/Chicago",
  OK: "America/Chicago",
  AR: "America/Chicago",
  TN: "America/Chicago",
  NM: "America/Denver",
  CA: "America/Los_Angeles",
  GA: "America/New_York",
};

const TZ_LABEL: Record<string, string> = {
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/New_York": "Eastern",
};

/**
 * Best-call-window note: 9am-6pm recipient local, translated to the caller's
 * (Houston / Central) clock so MJ knows when to dial.
 */
export function callWindowFor(state: string | undefined): string {
  const tz = (state && STATE_TZ[state.toUpperCase()]) || "America/Chicago";
  const label = TZ_LABEL[tz] || tz;
  if (tz === "America/Chicago") {
    return "Call 9am-6pm Central (their local time = yours)";
  }
  // Convert THEIR local window to the caller's Central clock. Central is 1h
  // ahead of Mountain and 2h ahead of Pacific (their 9am = your 10am/11am),
  // and 1h behind Eastern (their 9am = your 8am).
  const offsets: Record<string, number> = {
    "America/Denver": 1,
    "America/Los_Angeles": 2,
    "America/New_York": -1,
  };
  const offset = offsets[tz] ?? 0;
  const startCT = 9 + offset;
  const endCT = 18 + offset;
  const fmt = (h: number) => {
    const hr12 = ((h + 11) % 12) + 1;
    return `${hr12}${h >= 12 ? "pm" : "am"}`;
  };
  return `Call 9am-6pm ${label} (= ${fmt(startCT)}-${fmt(endCT)} your time, Houston)`;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** tel: friendly +1XXXXXXXXXX from whatever FMCSA gave us. */
export function dialablePhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

interface ScriptContext {
  name: string;
  company: string;
  state: string;
  sourceTag: string;
}

/**
 * Short honest call script from the verified pay copy. Angle varies by
 * source channel; every number is site copy, nothing invented.
 */
export function buildCallScript(ctx: ScriptContext): string {
  const mc = SITE_CONFIG.mcNumber.startsWith("MC")
    ? SITE_CONFIG.mcNumber
    : `MC ${SITE_CONFIG.mcNumber}`;

  const opener =
    ctx.sourceTag === "fmcsa-new-authority"
      ? `Hi, I'm looking for the owner at ${ctx.company} — this is [YOUR NAME], co-owner at Twin Mile, a power-only carrier in Houston. Saw your authority just came through — congrats. Got 2 minutes?`
      : ctx.sourceTag === "fmcsa-insurance-lapse"
        ? `Hi, I'm looking for the owner at ${ctx.company} — this is [YOUR NAME], co-owner at Twin Mile, a power-only carrier in Houston. We lease on owner-operators, and leasing onto our ${mc} authority can save real money on insurance and compliance. Got 2 minutes?`
        : `Hi, I'm looking for the owner at ${ctx.company} — this is [YOUR NAME], co-owner at Twin Mile, a power-only carrier in Houston. We're bringing on owner-operators in ${ctx.state || "your area"}. Got 2 minutes?`;

  return [
    `OPEN: ${opener}`,
    "",
    "PITCH (all verified site numbers — quote nothing else):",
    "- 80% of gross goes to the truck. Transparent settlements, no hidden fees.",
    "- 100% of the fuel surcharge is yours.",
    "- Weekly settlements — direct deposit by Tuesday.",
    "- $250k-$350k+ annual gross potential running consistently.",
    `- Run your own authority, or lease onto our ${mc}.`,
    "",
    `CLOSE: "Easiest next step — 2-minute application at ${SITE_CONFIG.appUrl}/drive-with-us, or I can text you the link. What works?"`,
    "",
    'IF NOT INTERESTED: "No problem — want me to take you off our list?" If yes, tap Mark DNC NOW and end the call politely.',
  ].join("\n");
}

/**
 * Build (or return) the call sheet for a UTC date. Idempotent per day.
 * Selection: phone present, email absent, never on a sheet before
 * (callSheetAt unset), not DNC — ordered by priorityScore, then aiScore.
 */
export async function generateCallSheet(
  db: Db,
  options?: { force?: boolean; date?: string; size?: number }
): Promise<CallSheetReport & { sheet: CallSheetDoc | null }> {
  const date = options?.date || new Date().toISOString().slice(0, 10);
  const size = options?.size ?? CALL_SHEET_SIZE;
  const sheets = db.collection<CallSheetDoc>("callSheets");

  const existing = await sheets.findOne({ date });
  if (existing && !options?.force) {
    return {
      created: false,
      date,
      selected: existing.items.length,
      skippedDnc: 0,
      bySource: {},
      reason: "Call sheet already exists for today",
      sheet: existing,
    };
  }

  // DNC list — check by phone digits AND DOT number.
  const dncRows = await db
    .collection("dncList")
    .find({})
    .project({ phone: 1, dotNumber: 1 })
    .toArray();
  const dncPhones = new Set(
    dncRows.map((r) => digitsOnly(String(r.phone || ""))).filter(Boolean)
  );
  const dncDots = new Set(
    dncRows.map((r) => String(r.dotNumber || "")).filter(Boolean)
  );

  // Phone-only prospects, never previously on a call sheet, not DNC'd.
  const candidates = await db
    .collection("outbound_prospects")
    .find({
      "contact.phone": { $nin: [null, ""] },
      $or: [
        { "contact.email": { $in: [null, ""] } },
        { "contact.email": { $exists: false } },
      ],
      callSheetAt: { $exists: false },
      status: { $nin: ["do_not_call", "onboarding_invited"] },
    })
    .sort({ priorityScore: -1, aiScore: -1 })
    .limit(size * 3) // headroom for DNC filtering
    .toArray();

  let skippedDnc = 0;
  const picked: typeof candidates = [];
  for (const p of candidates) {
    if (picked.length >= size) break;
    const phoneDigits = digitsOnly(String(p.contact?.phone || ""));
    if (
      (phoneDigits && dncPhones.has(phoneDigits)) ||
      (p.dotNumber && dncDots.has(String(p.dotNumber)))
    ) {
      skippedDnc++;
      continue;
    }
    picked.push(p);
  }

  const bySource: Record<string, number> = {};
  const items: CallSheetItem[] = picked.map((p) => {
    const sourceTag = p.sourceTag || "fmcsa-census";
    bySource[sourceTag] = (bySource[sourceTag] || 0) + 1;
    const company = p.dbaName || p.name || "";
    const state = p.state || String(p.location || "").split(",")[1]?.trim().split(" ")[0] || "";
    return {
      prospectId: String(p._id),
      dotNumber: String(p.dotNumber || ""),
      name: p.name || "",
      company,
      phone: String(p.contact?.phone || ""),
      phoneDial: dialablePhone(String(p.contact?.phone || "")),
      city: p.city || "",
      state,
      truckInfo: p.experience || `${p.powerUnits || "?"} power units`,
      sourceTag,
      priorityScore: p.priorityScore || p.aiScore || 0,
      aiScore: p.aiScore || 0,
      callWindow: callWindowFor(state),
      script: buildCallScript({ name: p.name || "", company, state, sourceTag }),
      status: "pending",
      calledAt: null,
    };
  });

  const now = new Date();
  await sheets.updateOne(
    { date },
    {
      $set: {
        items,
        complianceHeader: COMPLIANCE_HEADER,
        generatedAt: now,
      },
      $setOnInsert: { date },
    },
    { upsert: true }
  );

  // Mark selected prospects so they never appear on a second sheet.
  if (picked.length > 0) {
    await db.collection("outbound_prospects").updateMany(
      { _id: { $in: picked.map((p) => p._id as ObjectId) } },
      { $set: { callSheetAt: now.toISOString(), callSheetDate: date } }
    );
  }

  const sheet = await sheets.findOne({ date });
  return {
    created: true,
    date,
    selected: items.length,
    skippedDnc,
    bySource,
    sheet,
  };
}

/** Latest sheets, newest first (admin page). */
export async function listCallSheets(db: Db, limit: number): Promise<CallSheetDoc[]> {
  return db
    .collection<CallSheetDoc>("callSheets")
    .find({})
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
}
