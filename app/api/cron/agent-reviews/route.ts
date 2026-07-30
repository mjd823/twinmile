import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { chicagoWeekday } from "@/lib/cron-jobs";
import { getOperatingPicture, type OperatingPicture } from "@/lib/business-context";
import { runAgentReasoning } from "@/lib/agent-reasoner";
import { AGENT_CHARTERS, type AgentKey } from "@/lib/agent-charters";

/**
 * GET /api/cron/agent-reviews
 *
 * The daily reasoning pass for the department agents:
 *
 *   Marcus Chen        — Sales              (action: daily_sales_review)
 *   David Kumar        — Ops                (action: daily_ops_check)
 *   Jennifer Foster    — HR / Onboarding    (action: hr_onboarding_review)
 *   Robert Chang       — Finance            (action: daily_finance_review)
 *   Emily Watson       — Customer Success   (action: customer_success_check)
 *   Isabella Martinez  — Marketing, MONDAYS (action: marketing_analysis)
 *   Alexandra Sterling — CEO, MONDAYS       (action: ceo_strategic_review)
 *
 * WHAT CHANGED AND WHY
 * These reviews used to be template literals over countDocuments — each agent
 * printed its own numbers and stopped. That is why the company ran for a month
 * with every agent reporting "healthy" while the only metric that matters sat
 * at zero: a string cannot notice a trend, cannot see another department, and
 * cannot ask anyone a question.
 *
 * Now each agent receives the SAME operating picture (one shared computation,
 * so two departments can no longer disagree about arithmetic), plus its own
 * charter and its inbox of memos from colleagues, and reasons about it. Output
 * is schema-validated; memos and blockers are persisted so the next agent
 * actually reads them.
 *
 * The agent_activity contract (action / agent / activity / result / success) is
 * unchanged, so cron monitoring and the ops center keep working.
 *
 * DEGRADED MODE: if the LLM is unavailable, each agent still writes a factual
 * heartbeat built from the operating picture. Losing reasoning must never look
 * like a dead cron — a missing heartbeat is how a stall hides.
 *
 * Schedule (vercel.json): "0 16 * * *" UTC = 11AM CDT / 10AM CST.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAILY_AGENTS: AgentKey[] = ["marcus", "jennifer", "david", "robert", "emily"];
const WEEKLY_AGENTS: AgentKey[] = ["isabella", "alexandra"];

/**
 * Factual one-liner used when reasoning is unavailable. Built from the shared
 * picture so it can never contradict the reasoning path.
 */
function fallbackSummary(agent: AgentKey, p: OperatingPicture): string {
  const goal = `Goal: ${p.goal.current}/${p.goal.target} active drivers.`;
  switch (agent) {
    case "marcus":
      return `${goal} Outreach: ${p.outreach.sentLast24h} sent in 24h, ${p.outreach.pending} pending, ${p.outreach.failed} failed. Mode: ${p.outreach.automationMode}.`;
    case "jennifer":
      return `${goal} Onboarding: ${p.onboarding.everClicked} ever engaged, ${p.onboarding.completed} completed, ${p.onboarding.expiredUnfinished} expired unfinished. Follow-ups: ${p.onboarding.needingFollowUp} applicant(s), ${p.onboarding.awaitingSignature} awaiting lease signature.`;
    case "david":
      return `${goal} Fleet: ${p.fleet.trucks} truck(s), ${p.fleet.loads} load(s), ${p.fleet.delivered} delivered.`;
    case "robert":
      return `${goal} ${p.fleet.delivered} delivered load(s) to invoice, ${p.fleet.customers} active customer(s).`;
    case "emily":
      return `${goal} Outreach health: ${p.outreach.failed} failed task(s), ${p.outreach.orphanedTasks} orphaned, ${p.outreach.repliesReceived} reply/replies.`;
    case "isabella":
      return `${goal} Pipeline: ${p.pipeline.totals.prospects} prospects, ${p.pipeline.totals.driverLeads} driver leads.`;
    case "alexandra":
      return `${goal} Funnel: ${p.pipeline.stages.map((s) => `${s.shortLabel} ${s.reached}`).join(" -> ")}.`;
    default:
      return goal;
  }
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  const now = new Date();
  const isMonday = chicagoWeekday(now) === "Monday";
  const roster = [...DAILY_AGENTS, ...(isMonday ? WEEKLY_AGENTS : [])];

  try {
    const client = await clientPromise;
    const db = client.db();

    // ONE shared computation, handed to every agent this run.
    const picture = await getOperatingPicture(db);

    const rows: Record<string, unknown>[] = [];
    const logged: { agent: string; action: string; reasoned: boolean; headline: string }[] = [];

    // Sequential on purpose: agents write memos that later agents read in the
    // same run, so ordering is what makes the handoffs work.
    for (const key of roster) {
      const c = AGENT_CHARTERS[key];
      let activity: string;
      let result: Record<string, unknown>;
      let reasoned = false;

      try {
        const r = await runAgentReasoning(db, key, picture);
        reasoned = true;
        activity = r.headline;
        result = {
          summary: r.headline,
          findings: r.findings,
          memosSent: r.memos.length,
          blockersRaised: r.blockers.length,
          nextActions: r.nextActions,
          model: r.model,
          source: "vercel-cron",
        };
      } catch (e) {
        activity = fallbackSummary(key, picture);
        result = {
          summary: activity,
          degraded: true,
          degradedReason: e instanceof Error ? e.message : String(e),
          source: "vercel-cron",
        };
      }

      rows.push({
        action: c.action,
        agent: { name: c.name, role: c.role, department: c.department },
        activity,
        result,
        success: true,
        createdAt: now,
        timestamp: now,
      });
      logged.push({ agent: c.name, action: c.action, reasoned, headline: activity });
    }

    if (rows.length) await db.collection("agent_activity").insertMany(rows);

    return NextResponse.json({
      ok: true,
      report: {
        goal: picture.goal,
        reviewsLogged: logged,
        skippedWeekly: isMonday ? [] : WEEKLY_AGENTS.map((k) => AGENT_CHARTERS[k].action),
        openBlockers: picture.blockers.length,
        unavailableMetrics: picture.unavailable,
        chicagoWeekday: chicagoWeekday(now),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/agent-reviews] Fatal error:", error);

    // Best-effort failure log so the stall is visible in the cron monitor.
    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "daily_ops_check",
        agent: { name: "David Kumar", role: "Operations Director", department: "Operations" },
        result: { error: `agent-reviews cron failed: ${message}`, source: "vercel-cron" },
        success: false,
        createdAt: new Date(),
        timestamp: new Date(),
      });
    } catch {
      // DB unreachable -- nothing more we can do.
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
