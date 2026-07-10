import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { chicagoWeekday } from "@/lib/cron-jobs";

/**
 * GET /api/cron/agent-reviews
 *
 * Consolidated Vercel cron port of the laptop per-agent daily review jobs:
 *
 *   Marcus Chen      — Sales Review        (action: daily_sales_review)
 *   David Kumar      — Ops Check           (action: daily_ops_check)
 *   Jennifer Foster  — HR Review           (action: hr_onboarding_review)
 *   Robert Chang     — Finance Review      (action: daily_finance_review)
 *   Emily Watson     — Customer Success    (action: customer_success_check)
 *   Isabella Martinez — Marketing, MONDAYS (action: marketing_analysis)
 *   Alexandra Sterling — CEO, MONDAYS      (action: ceo_strategic_review)
 *
 * Unlike the old jobs these are NOT LLM calls -- each review is a cheap,
 * deterministic Mongo aggregation logged to agent_activity under the same
 * action names the admin cron monitor and timesheet already watch, so the
 * dashboards keep working with real numbers instead of persona chatter.
 *
 * Weekly agents (Isabella, Alexandra) match their old Monday-only shifts
 * (see SHIFTS in app/api/admin/timesheet/route.ts), evaluated in
 * America/Chicago.
 *
 * Schedule (vercel.json): "0 16 * * *" UTC = 11AM CDT / 10AM CST.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReviewEntry {
  agent: { name: string; role: string; department: string };
  action: string;
  summary: string;
  metrics: Record<string, unknown>;
}

/** Match createdAt stored as either Date or ISO string (both exist in this DB). */
function sinceFilter(field: string, since: Date) {
  return { $or: [{ [field]: { $gte: since } }, { [field]: { $gte: since.toISOString() } }] };
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const isMonday = chicagoWeekday(now) === "Monday";

  try {
    const client = await clientPromise;
    const db = client.db();

    // ── Shared metrics, gathered once ──────────────────────────────────────
    const [
      prospectsTotal,
      prospectsQualified,
      prospectsReviewed,
      prospectsInvited,
      prospectsNewToday,
      outreachSentToday,
      outreachPending,
      outreachFailed,
      quoteLeadsPending,
      quotesConverted,
      trucksInFleet,
      loadsTotal,
      loadsDelivered,
      loadsUninvoiced,
      driverLeadsNew,
      driverLeadsOnboarding,
      driverLeadsReady,
      sessionsPending,
      sessionsCompleted,
      activeCustomers,
      activeContracts,
      driverUsers,
    ] = await Promise.all([
      db.collection("outbound_prospects").countDocuments(),
      db.collection("outbound_prospects").countDocuments({ aiScore: { $gte: 75 } }),
      // "Awaiting invite": status "qualified" is what the invite cron consumes
      // (legacy "reviewed" was migrated to "qualified" in 2026-07).
      db.collection("outbound_prospects").countDocuments({ status: "qualified", aiScore: { $gte: 75 } }),
      db.collection("outbound_prospects").countDocuments({ status: "onboarding_invited" }),
      db.collection("outbound_prospects").countDocuments(sinceFilter("createdAt", dayAgo)),
      db.collection("outreach_tasks").countDocuments({ status: "sent", sentAt: { $gte: dayAgo } }),
      db.collection("outreach_tasks").countDocuments({ status: { $in: ["pending", "retrying"] } }),
      db.collection("outreach_tasks").countDocuments({ status: "failed" }),
      db.collection("leads_quotes").countDocuments({ status: { $in: ["new", "qualified", "quoted", "negotiating"] } }),
      db.collection("leads_quotes").countDocuments({ status: "converted" }),
      db.collection("trucks").countDocuments(),
      db.collection("loads").countDocuments(),
      db.collection("loads").countDocuments({ status: "delivered" }),
      db.collection("loads").countDocuments({ status: "delivered", invoiced: { $ne: true } }),
      db.collection("leads_drivers").countDocuments({ status: "new" }),
      db.collection("leads_drivers").countDocuments({ status: { $in: ["onboarding", "compliance_check"] } }),
      db.collection("leads_drivers").countDocuments({ status: "ready_to_dispatch" }),
      db.collection("onboarding_sessions").countDocuments({ status: "pending" }),
      db.collection("onboarding_sessions").countDocuments({ status: "completed" }),
      db.collection("customers").countDocuments({ status: "active" }),
      db.collection("contracts").countDocuments({ status: { $nin: ["cancelled", "expired"] } }),
      db.collection("users").countDocuments({ role: "driver" }),
    ]);

    const reviews: ReviewEntry[] = [];

    // ── Marcus Chen — Sales Review (daily) ─────────────────────────────────
    reviews.push({
      agent: { name: "Marcus Chen", role: "Sales Director", department: "Sales" },
      action: "daily_sales_review",
      summary: `Pipeline: ${prospectsTotal} prospects, ${prospectsQualified} qualified, ${prospectsInvited} invited. ${outreachSentToday} outreach emails sent in the last 24h. ${quoteLeadsPending} quote leads open.`,
      metrics: {
        prospectsTotal,
        prospectsQualified,
        prospectsReviewed,
        prospectsInvited,
        prospectsNewToday,
        outreachSentLast24h: outreachSentToday,
        outreachPending,
        quoteLeadsPending,
        quotesConverted,
      },
    });

    // ── David Kumar — Ops Check (daily, includes fleet count) ─────────────
    const opsFlags: string[] = [];
    if (trucksInFleet === 0) opsFlags.push("0 trucks in fleet — cannot dispatch");
    if (trucksInFleet < driverLeadsReady + sessionsCompleted) {
      opsFlags.push(
        `Fleet (${trucksInFleet}) smaller than driver pipeline (${driverLeadsReady} ready + ${sessionsCompleted} onboarded)`
      );
    }
    reviews.push({
      agent: { name: "David Kumar", role: "Operations Director", department: "Operations" },
      action: "daily_ops_check",
      summary: `Fleet: ${trucksInFleet} trucks. Loads: ${loadsTotal} total, ${loadsDelivered} delivered. Drivers ready to dispatch: ${driverLeadsReady}.${opsFlags.length ? " FLAGS: " + opsFlags.join("; ") : ""}`,
      metrics: {
        trucksInFleet,
        loadsTotal,
        loadsDelivered,
        driversReadyToDispatch: driverLeadsReady,
        driverUsers,
        flags: opsFlags,
      },
    });

    // ── Jennifer Foster — HR Review (daily) ────────────────────────────────
    reviews.push({
      agent: { name: "Jennifer Foster", role: "HR Director", department: "Human Resources" },
      action: "hr_onboarding_review",
      summary: `Onboarding: ${sessionsPending} sessions pending, ${sessionsCompleted} completed. Driver leads: ${driverLeadsNew} new, ${driverLeadsOnboarding} in onboarding/compliance.`,
      metrics: {
        onboardingSessionsPending: sessionsPending,
        onboardingSessionsCompleted: sessionsCompleted,
        driverLeadsNew,
        driverLeadsInOnboarding: driverLeadsOnboarding,
        driverUsers,
      },
    });

    // ── Robert Chang — Finance Review (daily) ──────────────────────────────
    reviews.push({
      agent: { name: "Robert Chang", role: "Finance Director", department: "Finance" },
      action: "daily_finance_review",
      summary: `${loadsUninvoiced} delivered load(s) awaiting invoicing. ${activeContracts} active contracts, ${activeCustomers} active customers.`,
      metrics: {
        deliveredNotInvoiced: loadsUninvoiced,
        loadsDelivered,
        activeContracts,
        activeCustomers,
      },
    });

    // ── Emily Watson — Customer Success Check (daily) ──────────────────────
    reviews.push({
      agent: { name: "Emily Watson", role: "Customer Success Manager", department: "Customer Success" },
      action: "customer_success_check",
      summary: `${activeCustomers} active customer account(s), ${driverUsers} driver account(s). Outreach health: ${outreachFailed} failed task(s).`,
      metrics: {
        activeCustomers,
        driverUsers,
        outreachFailed,
        outreachPending,
      },
    });

    // ── Weekly (Mondays, America/Chicago) ──────────────────────────────────
    const skippedWeekly: string[] = [];
    if (isMonday) {
      // Isabella Martinez — Marketing
      const bySource = await db
        .collection("outbound_prospects")
        .aggregate([
          { $group: { _id: "$source", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ])
        .toArray();
      const prospectsThisWeek = await db
        .collection("outbound_prospects")
        .countDocuments(sinceFilter("createdAt", weekAgo));
      reviews.push({
        agent: { name: "Isabella Martinez", role: "Marketing Director", department: "Marketing" },
        action: "marketing_analysis",
        summary: `Weekly lead-source review: ${prospectsThisWeek} prospects added this week across ${bySource.length} source(s). Top source: ${bySource[0]?._id ?? "n/a"} (${bySource[0]?.count ?? 0}).`,
        metrics: {
          prospectsThisWeek,
          prospectsBySource: bySource.map((s) => ({ source: s._id ?? "unknown", count: s.count })),
        },
      });

      // Alexandra Sterling — CEO strategic review
      reviews.push({
        agent: { name: "Alexandra Sterling", role: "Chief Executive Officer", department: "Executive" },
        action: "ceo_strategic_review",
        summary: `Weekly funnel: ${prospectsTotal} prospects → ${prospectsQualified} qualified → ${prospectsInvited} invited → ${sessionsCompleted} onboarded. Fleet: ${trucksInFleet} trucks, ${loadsTotal} loads. ${activeCustomers} active customers.`,
        metrics: {
          funnel: {
            prospects: prospectsTotal,
            qualified: prospectsQualified,
            invited: prospectsInvited,
            onboardingCompleted: sessionsCompleted,
          },
          trucksInFleet,
          loadsTotal,
          activeCustomers,
          quotesConverted,
        },
      });
    } else {
      skippedWeekly.push("Isabella Martinez (Mondays only)", "Alexandra Sterling (Mondays only)");
    }

    // ── Write one agent_activity entry per review ──────────────────────────
    await db.collection("agent_activity").insertMany(
      reviews.map((r) => ({
        action: r.action,
        agent: r.agent,
        activity: r.summary,
        result: { summary: r.summary, ...r.metrics, source: "vercel-cron" },
        success: true,
        createdAt: now,
        timestamp: now,
      }))
    );

    return NextResponse.json({
      ok: true,
      report: {
        reviewsLogged: reviews.map((r) => ({ agent: r.agent.name, action: r.action, summary: r.summary })),
        skippedWeekly,
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
