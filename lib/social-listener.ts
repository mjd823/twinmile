/**
 * Sofia the Listener — read-only social listening for owner-operators who are
 * ALREADY asking for help ("looking for a carrier to lease onto", "new
 * authority, insurance too expensive", ...).
 *
 * HARD BOUNDARIES (the trust strategy, and platform rules):
 *   - READ-ONLY public data. Reddit's public JSON endpoints only, no auth,
 *     no login, no scraping behind a wall.
 *   - NO automated posting, commenting, or DMs — ever. This module only
 *     surfaces conversations and drafts a reply; a NAMED HUMAN (MJ) reads
 *     the thread and posts the reply personally, or doesn't.
 *   - Every drafted reply answers the poster's actual question first and
 *     plainly discloses the Twin Mile affiliation. No link spam.
 *
 * Politeness: sequential requests with a 2s delay, descriptive User-Agent,
 * and a 429 skips the rest of the run instead of retrying.
 *
 * Storage: `listener_leads` collection, deduped on (source, postId).
 */

import type { Db, Document } from "mongodb";

import { paginatedList, type Paginated } from "@/lib/paginate";

export const LISTENER_AGENT = {
  name: "Sofia Rodriguez",
  role: "Lead Generation Specialist",
  department: "Sales",
};

const USER_AGENT = "twinmile-listener/1.0 (read-only social listening; contact: dispatch@twinmiletransport.com)";
const REQUEST_DELAY_MS = 2000;

export const SUBREDDITS = ["OwnerOperators", "Truckers", "TruckDrivers"] as const;

/** Search queries run per subreddit (restrict_sr, newest, past week). */
const SEARCH_QUERIES = ['"lease on" OR "lease onto" OR "new authority"'];

/**
 * Signal keyword groups. `seeking` phrases are strong intent (someone asking
 * for exactly the kind of help Twin Mile can honestly give); `booster`
 * phrases add context relevance (Texas/Houston, freight types we run).
 */
const SEEKING_SIGNALS: Array<{ phrase: string; weight: number }> = [
  { phrase: "looking for a carrier", weight: 5 },
  { phrase: "lease on", weight: 4 },
  { phrase: "lease onto", weight: 4 },
  { phrase: "which company", weight: 3 },
  { phrase: "new authority", weight: 4 },
  { phrase: "insurance quote", weight: 3 },
  { phrase: "insurance too high", weight: 4 },
  { phrase: "insurance is too high", weight: 4 },
  { phrase: "should i get my own authority", weight: 4 },
  { phrase: "percentage pay", weight: 3 },
  { phrase: "who should i drive for", weight: 4 },
];

const BOOSTER_SIGNALS: Array<{ phrase: string; weight: number }> = [
  { phrase: "houston", weight: 2 },
  { phrase: "texas", weight: 1 },
  { phrase: " tx ", weight: 1 },
  { phrase: "power only", weight: 2 },
  { phrase: "power-only", weight: 2 },
  { phrase: "general freight", weight: 2 },
  { phrase: "dry van", weight: 1 },
  { phrase: "owner operator", weight: 1 },
  { phrase: "owner-operator", weight: 1 },
];

/** Minimum score before an item is surfaced (must include a seeking signal). */
export const SCORE_THRESHOLD = 4;

export interface ListenerLead {
  source: "reddit";
  subreddit: string;
  /** Reddit fullname (e.g. t3_abc123) — the dedupe key together with source. */
  postId: string;
  url: string;
  author: string;
  title: string;
  /** First 400 chars of the post body (or title for link posts). */
  snippet: string;
  matchedSignals: string[];
  score: number;
  draftReply: string;
  foundAt: Date;
  status: "new" | "replied" | "dismissed";
  postedAt: Date | null;
}

interface RedditChild {
  kind: string;
  data: {
    name?: string;
    id?: string;
    subreddit?: string;
    author?: string;
    title?: string;
    selftext?: string;
    body?: string;
    permalink?: string;
    created_utc?: number;
    stickied?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Fetching (gentle, sequential)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Thrown to abort the whole run when Reddit rate-limits us. */
class RateLimitedError extends Error {}

async function fetchRedditListing(url: string): Promise<RedditChild[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Never cache: we want the live listing, and Next would otherwise cache fetch().
    cache: "no-store",
  });
  if (res.status === 429) throw new RateLimitedError(`429 from ${url}`);
  if (!res.ok) {
    console.warn(`[social-listener] ${res.status} from ${url} — skipping listing`);
    return [];
  }
  const json = (await res.json().catch(() => null)) as {
    data?: { children?: RedditChild[] };
  } | null;
  return json?.data?.children ?? [];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoredItem {
  matchedSignals: string[];
  score: number;
  hasSeeking: boolean;
}

/** Case-insensitive keyword scoring over title + body text. */
export function scoreText(title: string, body: string): ScoredItem {
  const haystack = ` ${title} ${body} `.toLowerCase();
  const matchedSignals: string[] = [];
  let score = 0;
  let hasSeeking = false;

  for (const { phrase, weight } of SEEKING_SIGNALS) {
    if (haystack.includes(phrase)) {
      matchedSignals.push(phrase.trim());
      score += weight;
      hasSeeking = true;
    }
  }
  for (const { phrase, weight } of BOOSTER_SIGNALS) {
    if (haystack.includes(phrase)) {
      matchedSignals.push(phrase.trim());
      score += weight;
    }
  }
  return { matchedSignals, score, hasSeeking };
}

// ---------------------------------------------------------------------------
// Reply drafting — template + slot fill, no LLM. Honest Twin Mile facts only:
// 80% of gross, 100% fuel surcharge passthrough, weekly settlements,
// MC 1790263, based in Houston TX. MJ posts these under his own name.
// ---------------------------------------------------------------------------

function has(signals: string[], ...phrases: string[]): boolean {
  return signals.some((s) => phrases.some((p) => s.includes(p)));
}

export function draftReply(item: { matchedSignals: string[] }): string {
  const s = item.matchedSignals;
  const parts: string[] = [];

  // 1) Answer their actual question first.
  if (has(s, "insurance")) {
    parts.push(
      "Insurance on a new authority is brutal — first-year premiums are usually the thing that kills the math, and they don't drop meaningfully until you've got 1–2 years of clean history. A lot of guys run leased onto a carrier for that first stretch so the carrier's insurance covers the truck while the record builds, then revisit their own authority later."
    );
  } else if (has(s, "own authority", "new authority")) {
    parts.push(
      "Honest take: your own authority only wins if you already have direct freight or a lane you know pays. Off the load boards alone, after insurance, factoring, and deadhead, most first-year authorities net less than a fair percentage lease. Run the numbers both ways with YOUR lanes before deciding — don't take anyone's word for it, including mine."
    );
  } else if (has(s, "percentage pay")) {
    parts.push(
      "On percentage pay, the two questions that matter more than the percent itself: is it percentage of GROSS (not net after hidden fees), and do you get 100% of the fuel surcharge? A 75% deal with FSC passthrough often beats an '85%' deal where the carrier keeps the surcharge."
    );
  } else if (has(s, "looking for a carrier", "lease on", "lease onto", "which company", "who should i drive for")) {
    parts.push(
      "When you're vetting carriers to lease onto, ask each one for these in writing: exact percentage of gross, who keeps the fuel surcharge, settlement frequency, every deduction line item, and whether you have forced dispatch. If they hesitate on any of those, that's your answer."
    );
  } else {
    parts.push(
      "Happy to share what I've seen from the carrier side if it helps — feel free to ask anything specific about pay structures or what a fair deal looks like on paper."
    );
  }

  // 2) Plain disclosure + honest facts, softer if they're not in our region.
  const nearUs = has(s, "houston", "texas", "tx");
  parts.push(
    "Full disclosure — I'm co-owner at a small carrier in Houston (Twin Mile, MC 1790263), so I obviously have a horse in this race. For reference, our deal is 80% of gross, 100% of the fuel surcharge to the driver, weekly settlements, no forced dispatch." +
      (nearUs
        ? " Since you mentioned Texas: if you're anywhere near Houston and want to talk through it, my DMs are open — but genuinely, get quotes from a few carriers and compare line by line."
        : " Whoever you sign with, get the full deduction sheet before you commit — the good carriers will hand it over without a fight.")
  );

  return parts.join("\n\n") + "\n\n— MJ";
}

// ---------------------------------------------------------------------------
// Scan + store
// ---------------------------------------------------------------------------

export interface ScanResult {
  scanned: number;
  surfaced: number;
  rateLimited: boolean;
  /** Items above threshold (whether or not they were new in the DB). */
  items: Array<Omit<ListenerLead, "foundAt" | "status">>;
}

/**
 * Fetch and score recent posts across the target subreddits.
 * Pure network + scoring — no DB writes (used directly for smoke tests).
 */
export async function scanReddit(): Promise<ScanResult> {
  const seen = new Set<string>();
  const items: ScanResult["items"] = [];
  let scanned = 0;
  let rateLimited = false;

  const urls: string[] = [];
  for (const sub of SUBREDDITS) {
    urls.push(`https://www.reddit.com/r/${sub}/new.json?limit=50`);
    for (const q of SEARCH_QUERIES) {
      urls.push(
        `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&t=week&limit=25`
      );
    }
  }

  try {
    for (const url of urls) {
      const children = await fetchRedditListing(url);
      for (const child of children) {
        const d = child.data;
        const postId = d.name || (d.id ? `${child.kind}_${d.id}` : "");
        if (!postId || seen.has(postId) || d.stickied) continue;
        seen.add(postId);
        scanned += 1;

        const title = d.title || "";
        const body = d.selftext || d.body || "";
        const { matchedSignals, score, hasSeeking } = scoreText(title, body);
        // Only surface items with real seeking intent above the threshold —
        // boosters alone ("texas", "owner operator") are not a lead.
        if (!hasSeeking || score < SCORE_THRESHOLD) continue;

        items.push({
          source: "reddit",
          subreddit: d.subreddit || "",
          postId,
          url: d.permalink ? `https://www.reddit.com${d.permalink}` : "",
          author: d.author || "[unknown]",
          title: title || (body ? body.slice(0, 80) : "(comment)"),
          snippet: (body || title).slice(0, 400),
          matchedSignals,
          score,
          draftReply: draftReply({ matchedSignals }),
          postedAt: d.created_utc ? new Date(d.created_utc * 1000) : null,
        });
      }
      // Be gentle: sequential with a fixed delay between requests.
      await sleep(REQUEST_DELAY_MS);
    }
  } catch (err) {
    if (err instanceof RateLimitedError) {
      // Reddit asked us to back off — skip the rest of this run entirely.
      console.warn("[social-listener] 429 rate limited — skipping rest of run");
      rateLimited = true;
    } else {
      throw err;
    }
  }

  return { scanned, surfaced: items.length, rateLimited, items };
}

/**
 * Full listener run: scan Reddit and upsert surfaced items into
 * `listener_leads` (dedupe on source+postId; never overwrites a lead MJ has
 * already marked replied/dismissed).
 */
export async function runSocialListener(db: Db): Promise<{
  scanned: number;
  surfaced: number;
  inserted: number;
  rateLimited: boolean;
}> {
  const scan = await scanReddit();
  let inserted = 0;

  const col = db.collection("listener_leads");
  for (const item of scan.items) {
    const result = await col.updateOne(
      { source: item.source, postId: item.postId },
      {
        $setOnInsert: {
          ...item,
          foundAt: new Date(),
          status: "new",
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) inserted += 1;
  }

  return {
    scanned: scan.scanned,
    surfaced: scan.surfaced,
    inserted,
    rateLimited: scan.rateLimited,
  };
}

/**
 * Newest-first page for the admin page — shared paginator, real
 * countDocuments total, no silent cap.
 */
export async function listListenerLeads(
  db: Db,
  opts: { page?: number; status?: string } = {}
): Promise<Paginated<ListenerLead>> {
  const query: Document = {};
  if (opts.status && opts.status !== "all") query.status = opts.status;
  return (await paginatedList(db.collection("listener_leads"), query, {
    page: opts.page,
    sort: { foundAt: -1, _id: -1 },
  })) as unknown as Paginated<ListenerLead>;
}

/** One-tap status flip from the admin page (replied / dismissed). */
export async function setListenerLeadStatus(
  db: Db,
  postId: string,
  status: "new" | "replied" | "dismissed"
): Promise<boolean> {
  const result = await db
    .collection("listener_leads")
    .updateOne({ source: "reddit", postId }, { $set: { status, statusChangedAt: new Date() } });
  return result.matchedCount > 0;
}
