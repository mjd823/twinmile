import OpenAI from "openai";

/**
 * LLM analysis pass for the AI Supervisor's daily report.
 *
 * The deterministic checks in /api/cron/supervisor-report stay the ground
 * truth — this module receives ONLY real, already-computed context (canonical
 * pipeline counts, cron health with per-job reasons, outreach failure samples,
 * the outreach pause state, the deployed commit) and asks the LLM to explain
 * what is actually going on: root cause, suggested fix, and whether the
 * existing hub fleet path can auto-fix it.
 *
 * Anti-fabrication rules (mirrors lib/blog-generate.ts):
 *  - The model may only reference numbers present in the input context.
 *  - It may not add findings beyond what the input data supports.
 *  - autoFixable may be true ONLY for remediations named in knownAutoFixes.
 *  - If everything is healthy it must say so and return zero findings.
 *
 * Provider: OLLAMA_API_KEY → ollama-cloud (glm-5.2), else GROQ_API_KEY → Groq
 * (same fallback chain as lib/blog-generate.ts).
 */

export interface SupervisorAnalysisFinding {
  severity: "critical" | "warning" | "info";
  title: string;
  rootCause: string;
  suggestedFix: string;
  autoFixable: boolean;
  evidence: string;
}

export interface SupervisorAnalysis {
  summary: string;
  findings: SupervisorAnalysisFinding[];
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

const SYSTEM_PROMPT = `You are the AI Supervisor for Twin Mile LLC, a Houston-based power-only trucking company. You review the company's automated recruiting operation once a day and report to the owner, Marquis. He is non-technical and reads this on his phone, so write in plain English — short, blunt, specific. No corporate filler, no hedging, no jargon.

How the operation works (so you can reason about the data):
- Sofia (an automated agent) finds real owner-operator carriers in the FMCSA government database daily and scores each 0-100 on contactability, fleet size, activity, and authority.
- Score 75+ = "qualified" -> an invite email with an onboarding link is queued.
- A prospect who clicks their link is "engaged", then submits docs, completes onboarding, and is hired.
- Below-75 prospects stay parked as "sourced" — nothing re-scores them automatically (there is a manual re-score button that pulls fresh FMCSA data).
- Separate from this outbound funnel, people also apply directly through the website (driver applications and freight-quote requests).

YOUR RULES — violating any of these makes the report worthless:
1. Ground every statement in the JSON context you are given. Only cite numbers that literally appear in it.
2. Do NOT invent findings. Each finding must trace to a deterministic signal or metric in the context.
3. Set "autoFixable": true ONLY if the fix matches an item in knownAutoFixes. Everything else is false.
4. If outreach automation is paused, that is the owner's deliberate decision. Do not treat the expected backlog as an emergency and do NOT recommend re-enabling it — note that those items resolve on their own when he turns it back on.
5. Cron jobs with status "scheduled" are WAITING for their first slot, not broken. Never flag them as failures.
6. If everything is healthy, say exactly that in the summary and return an empty findings array. A healthy report with zero findings is a good outcome, not a failure to find something.
7. Severity: "critical" = revenue or pipeline is actively blocked; "warning" = needs attention this week; "info" = worth knowing.

Respond with ONLY a JSON object shaped:
{
  "summary": "2-3 blunt sentences on the state of the operation",
  "findings": [
    {
      "severity": "critical" | "warning" | "info",
      "title": "short headline",
      "rootCause": "what is actually causing this, stated plainly",
      "suggestedFix": "the specific next action",
      "autoFixable": true | false,
      "evidence": "the exact numbers/facts from the context this rests on"
    }
  ]
}`;

const ALLOWED_SEVERITIES = new Set(["critical", "warning", "info"]);
const MAX_FINDINGS = 8;

function str(v: unknown, max = 600): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * Run the analysis. Throws on LLM/config failure — the caller catches and
 * writes the report without an analysis section (report-only route must
 * never fail because the LLM did).
 */
export async function generateSupervisorAnalysis(
  context: Record<string, unknown>
): Promise<SupervisorAnalysis> {
  const { client, model } = getLlmConfig();

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Today's real operational context (all numbers computed live from the production database):\n" +
          JSON.stringify(context, null, 2),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 2000,
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("LLM returned non-JSON analysis");
  }

  const findingsIn = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings: SupervisorAnalysisFinding[] = [];
  for (const f of findingsIn.slice(0, MAX_FINDINGS)) {
    if (!f || typeof f !== "object") continue;
    const fo = f as Record<string, unknown>;
    const severity = ALLOWED_SEVERITIES.has(String(fo.severity))
      ? (String(fo.severity) as SupervisorAnalysisFinding["severity"])
      : "info";
    const title = str(fo.title, 160);
    if (!title) continue;
    findings.push({
      severity,
      title,
      rootCause: str(fo.rootCause),
      suggestedFix: str(fo.suggestedFix),
      autoFixable: fo.autoFixable === true,
      evidence: str(fo.evidence),
    });
  }

  return {
    summary: str(parsed.summary, 800) || "Analysis produced no summary.",
    findings,
    model,
    generatedAt: new Date().toISOString(),
  };
}
