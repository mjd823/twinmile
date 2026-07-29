import OpenAI from "openai";
import type { Db } from "mongodb";
import { AGENT_CHARTERS, orgBriefing, type AgentKey } from "./agent-charters";
import { readInbox, writeMemo, raiseBlocker, type MemoKind } from "./agent-coordination";
import type { OperatingPicture } from "./business-context";

/**
 * AGENT REASONING CORE.
 *
 * Before this, the "agents" were template literals over countDocuments. Every
 * day for a month Marcus Chen reported "0 outreach emails sent in the last 24h"
 * and that was the end of it: a string cannot notice that the number has been
 * zero for thirty days, cannot connect it to the paused flag two departments
 * away, and cannot ask anyone about it.
 *
 * This module gives each agent the same three inputs a competent employee would
 * have — the whole company's numbers, its own job description, and its
 * colleagues' recent messages — and asks it to produce findings, memos to
 * peers, and proposed actions.
 *
 * Guardrails, in order of importance:
 *  - Output is schema-validated and REJECTED on non-conformance, never
 *    silently coerced into shape. A malformed response is a failed run.
 *  - Agents may only propose actions from a fixed vocabulary. They cannot
 *    invent capabilities, and nothing here executes code.
 *  - Every finding must cite numbers present in the context. The context
 *    marks unmeasured values as null and lists them in `unavailable`, and the
 *    prompt forbids treating null as zero — the exact error that let "0
 *    completions" mean two entirely different things for a month.
 *  - A hop counter on memos prevents the A->B->C->A handoff loops that are the
 *    most-reported multi-agent failure.
 */

export interface AgentFinding {
  severity: "critical" | "warning" | "info";
  title: string;
  reasoning: string;
  evidence: string;
  /** How addressing this moves the company goal. Forces relevance. */
  goalImpact: string;
}

export interface ProposedMemo {
  to: AgentKey | "all";
  kind: MemoKind;
  subject: string;
  body: string;
  evidence: string;
}

export interface ProposedBlocker {
  key: string;
  title: string;
  owner: "human" | "agent" | "vendor";
  blocking: string;
  routeAround: string;
  humanAction: string;
  clearsWhen: string;
  severity: "critical" | "warning" | "info";
}

export interface AgentReasoning {
  agent: AgentKey;
  headline: string;
  findings: AgentFinding[];
  memos: ProposedMemo[];
  blockers: ProposedBlocker[];
  /** What this agent will do before its next run, in its own lane. */
  nextActions: string[];
  model: string;
  generatedAt: string;
}

function getLlmConfig(): { client: OpenAI; model: string } {
  if (process.env.OLLAMA_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OLLAMA_API_KEY,
        baseURL: process.env.OLLAMA_BASE_URL || "https://ollama.com/v1",
        timeout: 45000,
      }),
      model: process.env.OLLAMA_MODEL || "glm-5.2",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
        timeout: 45000,
      }),
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    };
  }
  throw new Error("LLM API key not available. Set OLLAMA_API_KEY or GROQ_API_KEY.");
}

const VALID_AGENTS = new Set([...Object.keys(AGENT_CHARTERS), "all"]);
const VALID_KINDS = new Set<MemoKind>(["observation", "request", "handoff", "resolution"]);
const VALID_SEVERITY = new Set(["critical", "warning", "info"]);
const MAX_FINDINGS = 5;
const MAX_MEMOS = 3;
const MAX_BLOCKERS = 2;

function buildSystemPrompt(agent: AgentKey): string {
  const c = AGENT_CHARTERS[agent];
  return `You are ${c.name}, the ${c.role} at Twin Mile LLC, a Houston-based power-only trucking company. You are one of several automated agents that run this company's recruiting and operations without daily human supervision. You report to Marquis, the owner, who is non-technical and reads this on his phone.

${orgBriefing()}

YOUR CHARTER
Mandate: ${c.mandate}
You own: ${c.owns.join(", ")}
You may decide on your own: ${c.mayDecide.join("; ")}
You must hand off (never do yourself): ${c.mustHandOff.join("; ")}
Your contribution to the goal: ${c.contribution}

HOW YOU THINK
1. Ground EVERY statement in the operating picture JSON you are given. Only cite numbers that literally appear in it.
2. A value of null means NOT MEASURED. It does not mean zero. Never reason as if null were zero, and never report a null as a result. If something you need is in "unavailable", say that it is unmeasured and treat measuring it as the finding.
3. Do not invent findings. If your area is genuinely fine, say so and return an empty findings array. A clean report is a good outcome.
4. Prefer the goal over your own department. If your numbers look good but the company goal has not moved, that IS your finding. This company had every agent reporting healthy while the primary metric sat at zero for a month — do not repeat that.
5. Read your inbox. If a colleague asked you something, answer it with a memo (kind "resolution" or "handoff", inReplyTo not required). If you need something only another agent owns, send them a "request" — do not do their job.
6. When something is blocked by a person (a toggle only they can click, a vendor account, a legal signature), that is NOT a failure and NOT an emergency. Raise a blocker AND state the route-around: what you will do instead so work continues. Never propose stopping and waiting.
7. Severity: "critical" = the company goal is actively blocked; "warning" = needs attention this week; "info" = worth knowing.
8. Write like a blunt, competent colleague. Short sentences. No corporate filler.

QUIET HOURS
Outside Mon-Fri 8am-6pm America/Chicago no cold messages may be sent to prospects. That restricts SENDING only. You are expected to keep working during those hours on everything that is not a send: data quality, research, drafting, prioritizing, diagnosing, repairing.

Respond with ONLY a JSON object:
{
  "headline": "one blunt sentence on the state of your area",
  "findings": [{"severity":"critical|warning|info","title":"short","reasoning":"what is going on and why","evidence":"the exact numbers from the context","goalImpact":"how fixing this moves activeDrivers toward the target"}],
  "memos": [{"to":"<agent key or all>","kind":"observation|request|handoff|resolution","subject":"short","body":"what you need or what you are handing over","evidence":"numbers"}],
  "blockers": [{"key":"stable_slug","title":"short","owner":"human|agent|vendor","blocking":"what is not happening","routeAround":"what you will do instead so work continues","humanAction":"exact instruction for Marquis","clearsWhen":"machine-checkable condition","severity":"critical|warning|info"}],
  "nextActions": ["concrete thing you will do in your own lane before your next run"]
}`;
}

function str(v: unknown, max = 800): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * Validate and narrow the model's output. Non-conforming entries are DROPPED,
 * not repaired — a reshaped hallucination is worse than a missing field
 * because it looks authoritative.
 */
function parseReasoning(agent: AgentKey, raw: string, model: string): AgentReasoning {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${agent}: model returned non-JSON`);
  }

  const findings: AgentFinding[] = [];
  for (const f of (Array.isArray(parsed.findings) ? parsed.findings : []).slice(0, MAX_FINDINGS)) {
    if (!f || typeof f !== "object") continue;
    const fo = f as Record<string, unknown>;
    const title = str(fo.title, 160);
    const evidence = str(fo.evidence, 400);
    // A finding with no evidence is exactly the fabrication we are guarding
    // against — drop it rather than surface an unsourced claim.
    if (!title || !evidence) continue;
    findings.push({
      severity: VALID_SEVERITY.has(String(fo.severity)) ? (String(fo.severity) as AgentFinding["severity"]) : "info",
      title,
      reasoning: str(fo.reasoning),
      evidence,
      goalImpact: str(fo.goalImpact, 300),
    });
  }

  const memos: ProposedMemo[] = [];
  for (const m of (Array.isArray(parsed.memos) ? parsed.memos : []).slice(0, MAX_MEMOS)) {
    if (!m || typeof m !== "object") continue;
    const mo = m as Record<string, unknown>;
    const to = String(mo.to);
    const kind = String(mo.kind) as MemoKind;
    const subject = str(mo.subject, 200);
    if (!VALID_AGENTS.has(to) || !VALID_KINDS.has(kind) || !subject) continue;
    if (to === agent) continue; // an agent memoing itself is a no-op loop
    memos.push({
      to: to as AgentKey | "all",
      kind,
      subject,
      body: str(mo.body, 2000),
      evidence: str(mo.evidence, 400),
    });
  }

  const blockers: ProposedBlocker[] = [];
  for (const b of (Array.isArray(parsed.blockers) ? parsed.blockers : []).slice(0, MAX_BLOCKERS)) {
    if (!b || typeof b !== "object") continue;
    const bo = b as Record<string, unknown>;
    const key = str(bo.key, 80).replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    const routeAround = str(bo.routeAround, 600);
    // A blocker without a route-around is just "we stopped". Rejected by
    // policy — the whole point is that the system keeps moving.
    if (!key || !routeAround) continue;
    blockers.push({
      key,
      title: str(bo.title, 160) || key,
      owner: ["human", "agent", "vendor"].includes(String(bo.owner)) ? (String(bo.owner) as ProposedBlocker["owner"]) : "human",
      blocking: str(bo.blocking, 400),
      routeAround,
      humanAction: str(bo.humanAction, 400),
      clearsWhen: str(bo.clearsWhen, 300),
      severity: VALID_SEVERITY.has(String(bo.severity)) ? (String(bo.severity) as ProposedBlocker["severity"]) : "warning",
    });
  }

  return {
    agent,
    headline: str(parsed.headline, 400) || "No headline produced.",
    findings,
    memos,
    blockers,
    nextActions: (Array.isArray(parsed.nextActions) ? parsed.nextActions : [])
      .slice(0, 5)
      .map((a) => str(a, 300))
      .filter(Boolean),
    model,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Run one agent's reasoning pass and persist its memos and blockers.
 * Throws on LLM/config failure — callers decide whether that degrades the run
 * or fails it.
 */
export async function runAgentReasoning(
  db: Db,
  agent: AgentKey,
  picture: OperatingPicture
): Promise<AgentReasoning> {
  const { client, model } = getLlmConfig();
  const inbox = await readInbox(db, agent);

  const userContent = [
    "OPERATING PICTURE (computed live from the production database, shared by every agent this run):",
    JSON.stringify(picture, null, 2),
    "",
    inbox.length
      ? "YOUR INBOX (messages from colleagues you have not resolved):\n" +
        JSON.stringify(
          inbox.map((m) => ({ from: m.from, kind: m.kind, subject: m.subject, body: m.body, evidence: m.evidence })),
          null,
          2
        )
      : "YOUR INBOX: empty.",
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: buildSystemPrompt(agent) },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 2500,
  });

  const reasoning = parseReasoning(agent, completion.choices[0]?.message?.content || "{}", model);

  for (const m of reasoning.memos) {
    await writeMemo(db, {
      from: agent,
      to: m.to,
      kind: m.kind,
      subject: m.subject,
      body: m.body,
      evidence: m.evidence,
    });
  }
  for (const b of reasoning.blockers) {
    await raiseBlocker(db, { ...b, raisedBy: agent });
  }

  return reasoning;
}
