import OpenAI from "openai";

import { BLOG_TOPICS, type BlogTopic, type TopicSource } from "@/lib/blog-topics";
import {
  hasPendingDraft,
  hasRecentPost,
  insertBlogDraft,
  slugExists,
  usedTopicIds,
  type BlogCitation,
  type BlogSection,
  type StoredBlogPost,
} from "@/lib/blog-store";

/**
 * Weekly blog draft generator (AI drafts → human review gate → publish).
 *
 * Anti-fabrication rules, matching the GVFreedom/GVAI portfolio standard:
 *  - Citations are HTTP-verified BEFORE the model sees them; only live .gov /
 *    official sources are offered, and only offered sources may be cited.
 *  - The model may not invent statistics. Company pay claims are restricted
 *    to the verified copy already published on /drive-with-us (80% gross,
 *    $250k–$350k+ annual gross potential, 100% fuel surcharge, weekly direct
 *    deposit). Any other dollar figure or percentage in the output trips the
 *    needsWork flag for the human reviewer.
 *  - Thin drafts (< MIN_WORDS) and drafts with < 2 verified citations are
 *    flagged needsWork.
 *
 * Nothing generated here is public: drafts land in Mongo with status
 * "draft" and only become visible after a human publishes them in
 * /admin/blog.
 */

const MIN_WORDS = 600;
const MIN_VERIFIED_CITATIONS = 2;
const CADENCE_GUARD_DAYS = 6;

/**
 * The ONLY quantitative company claims the model may make — verified copy
 * from app/drive-with-us/page.tsx. Everything else quantitative must come
 * from (and point to) a verified citation, phrased qualitatively.
 */
const VERIFIED_COMPANY_FACTS = [
  "Twin Mile LLC is a Houston-based power-only trucking company.",
  "Owner-operators at Twin Mile earn 80% gross to the truck.",
  "Annual gross potential of $250k-$350k+ for owner-operators.",
  "100% fuel surcharge pass-through.",
  "Weekly direct deposit.",
  "No trailer fees (power-only: customers' pre-loaded trailers).",
  "Drivers can apply in about 2 minutes at twinmile.com/drive-with-us.",
];

/** Figures allowed to appear in generated copy (company facts + trivial numbers). */
const ALLOWED_FIGURES = new Set([
  "80%",
  "100%",
  "$250k",
  "$350k",
  "$250,000",
  "$350,000",
]);

// ---------------------------------------------------------------------------
// Citation verification
// ---------------------------------------------------------------------------

async function verifySource(
  source: TopicSource
): Promise<BlogCitation> {
  const checkedAt = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(source.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        // Browser-like headers: FMCSA/BLS sit behind WAFs that 403 obvious
        // bot user-agents even for perfectly valid pages. We're verifying
        // link liveness for citations, not scraping content.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      url: source.url,
      title: source.title,
      source: source.source,
      verified: res.status < 400,
      httpStatus: res.status,
      checkedAt,
    };
  } catch {
    return {
      url: source.url,
      title: source.title,
      source: source.source,
      verified: false,
      checkedAt,
    };
  }
}

export async function verifyCitations(sources: TopicSource[]): Promise<BlogCitation[]> {
  return Promise.all(sources.map(verifySource));
}

// ---------------------------------------------------------------------------
// LLM client — reuses the repo's env conventions (lib/ai-agents.ts):
// OLLAMA_API_KEY → ollama-cloud (glm-5.2), else GROQ_API_KEY → Groq.
// ---------------------------------------------------------------------------

function getLlmConfig(): { client: OpenAI; model: string } {
  if (process.env.OLLAMA_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OLLAMA_API_KEY,
        baseURL: process.env.OLLAMA_BASE_URL || "https://ollama.com/v1",
        timeout: 120000,
      }),
      model: process.env.OLLAMA_MODEL || "glm-5.2",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
        timeout: 120000,
      }),
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    };
  }
  throw new Error("LLM API key not available. Set OLLAMA_API_KEY or GROQ_API_KEY.");
}

// ---------------------------------------------------------------------------
// Draft generation
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractJson(raw: string): unknown {
  // Strip code fences / any preamble around the JSON object.
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response contained no JSON object");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Find dollar figures / percentages that are not in the approved whitelist. */
export function findUnapprovedFigures(text: string): string[] {
  const matches = text.match(/\$\s?[\d,]+(?:\.\d+)?\s?(?:k|K)?|\b\d{1,3}(?:\.\d+)?\s?%/g) ?? [];
  const bad: string[] = [];
  for (const m of matches) {
    const normalized = m.replace(/\s+/g, "").replace(/K/g, "k");
    if (!ALLOWED_FIGURES.has(normalized)) bad.push(m.trim());
  }
  return [...new Set(bad)];
}

function buildPrompt(topic: BlogTopic, citations: BlogCitation[]): {
  system: string;
  user: string;
} {
  const sourceList = citations
    .map((c, i) => `${i + 1}. [${c.source}] ${c.title} — ${c.url}`)
    .join("\n");

  const system = `You are the content writer for Twin Mile LLC, a Houston-based power-only trucking company (twinmile.com). You write practical, honest, plain-English articles for CDL drivers and owner-operators.

STRICT ACCURACY RULES — violating any of these makes the draft unusable:
1. NEVER invent statistics, dollar figures, percentages, dates, or study results. If you don't have a number from the approved facts below, describe the idea qualitatively and point the reader to one of the provided sources for current figures.
2. The ONLY quantitative claims you may make about Twin Mile are these verified facts:
${VERIFIED_COMPANY_FACTS.map((f) => `   - ${f}`).join("\n")}
3. You may reference ONLY the sources provided in the user message. Do not cite or link anything else. Do not fabricate URLs.
4. Regulations change — describe rules at a practical level and tell readers to confirm current requirements at the cited official source.
5. Do not disparage other carriers. Keep any Twin Mile mention brief and honest (one short closing section at most).

STYLE: clear, direct, useful. Short paragraphs. No hype, no filler, no "in today's fast-paced world". Write for a driver reading on a phone.

OUTPUT: respond with ONLY a JSON object (no markdown fences, no commentary):
{
  "title": "SEO-friendly headline, under 70 characters",
  "description": "meta description, 140-160 characters",
  "sections": [
    { "heading": "section heading", "paragraphs": ["paragraph 1", "paragraph 2"] }
  ],
  "citedSourceNumbers": [1, 2]
}
Rules for the JSON: 5-7 sections; 2-4 paragraphs each; total length 800-1200 words; "citedSourceNumbers" lists the provided source numbers you actually drew on (cite at least 2). When a section leans on a source, name it in prose (e.g. "FMCSA's Hours of Service rules explain...").`;

  const user = `Write the article now.

TOPIC: ${topic.title}
ANGLE: ${topic.angle}
TARGET KEYWORDS (work in naturally, never stuff): ${topic.keywords.join(", ")}

VERIFIED SOURCES YOU MAY CITE (already checked live today):
${sourceList}`;

  return { system, user };
}

export interface GenerateDraftResult {
  created: boolean;
  reason?: string;
  post?: StoredBlogPost;
}

export async function generateBlogDraft(options?: {
  force?: boolean;
  topicId?: string;
}): Promise<GenerateDraftResult> {
  // Conservative cadence: one unreviewed draft at a time, max one per week.
  if (!options?.force) {
    if (await hasPendingDraft()) {
      return { created: false, reason: "A draft is already awaiting review — skipping." };
    }
    if (await hasRecentPost(CADENCE_GUARD_DAYS)) {
      return {
        created: false,
        reason: `A post was already generated in the last ${CADENCE_GUARD_DAYS} days — skipping.`,
      };
    }
  }

  // Pick the next unused topic (deterministic rotation through the bank).
  const used = await usedTopicIds();
  const topic = options?.topicId
    ? BLOG_TOPICS.find((t) => t.id === options.topicId)
    : BLOG_TOPICS.find((t) => !used.has(t.id));
  if (!topic) {
    return {
      created: false,
      reason: options?.topicId
        ? `Unknown topic id: ${options.topicId}`
        : "Topic bank exhausted — add topics to lib/blog-topics.ts.",
    };
  }

  // Verify citations BEFORE generation; the model only ever sees live links.
  const allCitations = await verifyCitations(topic.candidateSources);
  const verified = allCitations.filter((c) => c.verified);
  const reviewNotes: string[] = [];
  let needsWork = false;

  if (verified.length === 0) {
    return {
      created: false,
      reason: `No candidate sources for topic "${topic.id}" could be verified — refusing to generate an uncited draft.`,
    };
  }
  if (verified.length < MIN_VERIFIED_CITATIONS) {
    needsWork = true;
    reviewNotes.push(
      `Only ${verified.length} citation(s) could be HTTP-verified (minimum ${MIN_VERIFIED_CITATIONS}).`
    );
  }

  // Generate — one automatic retry if the first draft comes back thin.
  const { client, model } = getLlmConfig();
  const { system, user } = buildPrompt(topic, verified);

  type ModelDraft = {
    title?: string;
    description?: string;
    sections?: Array<{ heading?: string; paragraphs?: string[] }>;
    citedSourceNumbers?: number[];
  };

  async function requestDraft(extraInstruction?: string): Promise<ModelDraft> {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: extraInstruction ? `${user}\n\n${extraInstruction}` : user },
      ],
      temperature: 0.4,
      max_tokens: 6000,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    return extractJson(raw) as ModelDraft;
  }

  function draftWordCount(d: ModelDraft): number {
    return [d.title ?? "", d.description ?? "", ...(d.sections ?? []).flatMap((s) => [s.heading ?? "", ...(s.paragraphs ?? [])])]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
  }

  let parsed = await requestDraft();
  if (draftWordCount(parsed) < MIN_WORDS) {
    parsed = await requestDraft(
      `IMPORTANT: your draft must total 900-1300 words. A previous attempt was only ${draftWordCount(parsed)} words — far too short. Expand every section with concrete, practical detail (steps, what to expect, common mistakes) while following all accuracy rules.`
    );
  }

  const title = String(parsed.title ?? "").trim();
  const description = String(parsed.description ?? "").trim();
  const sections: BlogSection[] = (parsed.sections ?? [])
    .map((s) => ({
      heading: String(s.heading ?? "").trim(),
      paragraphs: (Array.isArray(s.paragraphs) ? s.paragraphs : [])
        .map((p) => String(p).trim())
        .filter(Boolean),
    }))
    .filter((s) => s.heading && s.paragraphs.length > 0);

  if (!title || sections.length < 3) {
    throw new Error("Model returned an unusable draft (missing title or too few sections).");
  }

  // Quality gates.
  const fullText = [title, description, ...sections.flatMap((s) => [s.heading, ...s.paragraphs])].join("\n");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS) {
    needsWork = true;
    reviewNotes.push(`Thin content: ${wordCount} words (minimum ${MIN_WORDS}).`);
  }
  const unapproved = findUnapprovedFigures(fullText);
  if (unapproved.length > 0) {
    needsWork = true;
    reviewNotes.push(
      `Contains figures outside the verified whitelist — verify or remove before publishing: ${unapproved.join(", ")}`
    );
  }

  // Keep only citations the model says it used (fall back to all verified).
  const citedNumbers = Array.isArray(parsed.citedSourceNumbers)
    ? parsed.citedSourceNumbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= verified.length)
    : [];
  const citations =
    citedNumbers.length >= MIN_VERIFIED_CITATIONS
      ? citedNumbers.map((n) => verified[n - 1])
      : verified;

  // Unique slug.
  let slug = slugify(title) || slugify(topic.title);
  if (await slugExists(slug)) {
    slug = `${slug}-${new Date().toISOString().slice(0, 10)}`;
    if (await slugExists(slug)) {
      throw new Error(`Slug collision could not be resolved: ${slug}`);
    }
  }

  const post = await insertBlogDraft({
    slug,
    title,
    description,
    sections,
    citations,
    needsWork,
    reviewNotes,
    topicId: topic.id,
    model,
    wordCount,
    readingTime: `${Math.max(1, Math.round(wordCount / 200))} min`,
  });

  return { created: true, post };
}
