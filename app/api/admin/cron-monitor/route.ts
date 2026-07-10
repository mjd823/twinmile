import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";
import { CRON_JOBS, classifyCronJob, lastActivityFor } from "@/lib/cron-jobs";

/**
 * GET /api/admin/cron-monitor
 *
 * CONSOLIDATED onto lib/cron-jobs.ts — this route used to carry its own
 * hardcoded list of 14 jobs from the dead Hermes laptop system, with obsolete
 * schedules (e.g. "0 8-20/2" vs the real "0 14-23/2") and jobs that no longer
 * exist (Monthly BI, Driver Engagement). It now reports the SAME registry and
 * the SAME health classification as the supervisor report and the agent
 * timesheet, so /admin/automation can never disagree with /admin/supervisor.
 */

/** Per-job one-line descriptions for the automation dashboard cards. */
const JOB_DESCRIPTIONS: Record<string, string> = {
  "process-outreach": "Processes pending outreach email tasks every 15 minutes",
  "onboarding-invites": "Sends onboarding invitations to qualified prospects (score 75+)",
  prospecting: "Sofia searches the FMCSA Census API for real owner-operators daily",
  "prospect-priorities": "Flags new-authority and insurance-lapse priority prospects",
  "call-sheet": "Builds the daily call sheet for phone-only prospects",
  "social-listener": "Reads trucking subreddits for owner-operators worth contacting",
  "supervisor-report": "Writes the daily supervisor report with LLM root-cause analysis",
  "agent-reviews:sales": "Daily sales review of qualified leads and outreach strategy",
  "agent-reviews:ops": "Daily ops check: fleet capacity, market rates, freight trends",
  "agent-reviews:hr": "Daily HR review of onboarding progress and compliance",
  "agent-reviews:finance": "Daily finance review: revenue, factoring, cost optimization",
  "agent-reviews:customer-success": "Daily customer research and reputation check",
  "agent-reviews:marketing": "Weekly (Mon) marketing analysis: lead sources, SEO",
  "agent-reviews:ceo": "Weekly (Mon) CEO review: whole-org performance",
};

const AGENT_META: Record<string, { role: string; avatar: string }> = {
  "Outreach Processor": { role: "Automation", avatar: "⚙️" },
  "Auto Onboarding Processor": { role: "Onboarding", avatar: "📋" },
  "Sofia Rodriguez": { role: "Lead Gen", avatar: "🔍" },
  "AI Supervisor": { role: "Monitor", avatar: "🛡️" },
  "Marcus Chen": { role: "Sales Director", avatar: "💼" },
  "David Kumar": { role: "Operations", avatar: "🚛" },
  "Jennifer Foster": { role: "HR Director", avatar: "👤" },
  "Robert Chang": { role: "Finance", avatar: "💰" },
  "Emily Watson": { role: "Customer Success", avatar: "🤝" },
  "Isabella Martinez": { role: "Marketing", avatar: "📢" },
  "Alexandra Sterling": { role: "CEO", avatar: "👑" },
};

/** Dashboard status buckets: ok | scheduled | late | error | null (never ran). */
const HEALTH_TO_LAST_STATUS: Record<string, string | null> = {
  healthy: "ok",
  scheduled: "scheduled",
  stale: "late",
  error: "error",
  never_ran: null,
};
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!clientPromise) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();

    // One row per REGISTERED Vercel cron job — same registry + health
    // classification as the supervisor report and agent timesheet.
    const now = new Date();
    const cronJobs = await Promise.all(
      CRON_JOBS.map(async (job) => {
        const last = await lastActivityFor(db, job.actions);
        const cls = classifyCronJob(job, { at: last.at, success: last.success }, now);

        // Count activities in the last 24 hours (createdAt OR legacy timestamp)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const todayCount = await db.collection("agent_activity").countDocuments({
          action: { $in: job.actions },
          $or: [
            { createdAt: { $gte: twentyFourHoursAgo } },
            { timestamp: { $gte: twentyFourHoursAgo } },
          ],
        });

        const meta = AGENT_META[job.agentName] || { role: "Automation", avatar: "⚙️" };
        const nextRun =
          cls.nextExpectedRun?.toISOString() ??
          calculateNextRun(job.schedule.split(" (")[0]);

        return {
          id: job.id,
          name: job.name,
          schedule: job.schedule,
          description: JOB_DESCRIPTIONS[job.id] || "",
          statusReason: cls.reason,
          skill: "vercel-cron",
          agent: { name: job.agentName, ...meta },
          lastRun: last.at,
          lastStatus: HEALTH_TO_LAST_STATUS[cls.status] ?? null,
          lastResult: last.result,
          nextRun,
          todayCount,
          enabled: true,
          model: null,
          provider: "vercel",
        };
      })
    );

    // Recent activity — exclude the every-15-minutes outreach heartbeat noise
    // and sort by whichever timestamp field the row actually has (legacy rows
    // use `timestamp`, newer rows use `createdAt`).
    const activityLogs = await db.collection("agent_activity")
      .aggregate([
        { $match: { action: { $nin: ["outreach_processing", "outreach_cron"] } } },
        { $addFields: { _sortTime: { $ifNull: ["$createdAt", "$timestamp"] } } },
        { $sort: { _sortTime: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    // REAL email numbers from outreach_tasks (what actually got sent via
    // Resend) — previously this tab showed onboarding_sessions.length capped
    // at a query limit of 50, which is where the bogus "50 emails sent" came
    // from.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [emailSent24h, emailSentTotal, emailPending, emailFailed] = await Promise.all([
      db.collection("outreach_tasks").countDocuments({ status: "sent", sentAt: { $gte: dayAgo } }),
      db.collection("outreach_tasks").countDocuments({ status: "sent" }),
      db.collection("outreach_tasks").countDocuments({ status: { $in: ["pending", "retrying"] } }),
      db.collection("outreach_tasks").countDocuments({ status: "failed" }),
    ]);

    // Email log = the actual sent emails (exact subject/body as delivered)
    const rawSentTasks = await db.collection("outreach_tasks")
      .find({ status: "sent" })
      .sort({ sentAt: -1 })
      .limit(50)
      .project({
        leadName: 1, leadType: 1, template: 1, status: 1, sentAt: 1, sentTo: 1,
        leadEmail: 1, renderedSubject: 1, renderedHtml: 1, renderedBody: 1,
      })
      .toArray();

    const emailLogs = rawSentTasks.map((t: any) => ({
      id: t._id?.toString(),
      type: t.template || "outreach",
      recipient: t.sentTo || t.leadEmail || "",
      leadName: t.leadName || "Unknown",
      leadType: t.leadType || "",
      status: t.status,
      sentAt: t.sentAt || null,
      subject: t.renderedSubject || "",
      bodyHtml: t.renderedHtml || "",
      bodyText: t.renderedBody || "",
    }));

    return NextResponse.json({
      success: true,
      data: {
        cronJobs,
        emailStats: {
          sentLast24h: emailSent24h,
          sentTotal: emailSentTotal,
          pending: emailPending,
          failed: emailFailed,
        },
        activityLogs: activityLogs.map((a: any) => ({
          id: a._id?.toString(),
          action: a.action || a.type || "activity",
          agent: a.agent?.name || (typeof a.agent === "string" ? a.agent : "System"),
          agentRole: a.agent?.role || "Automated",
          agentDepartment: a.agent?.department || "System",
          result: a.result || a.details || (a.activity ? { summary: a.activity } : undefined),
          success: a.success !== false,
          timestamp: a.createdAt || a.timestamp,
        })),
        emailLogs,
      },
    });
  } catch (error) {
    console.error("[cron-monitor] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron data" },
      { status: 500 }
    );
  }
}

// Calculate next run time from cron schedule (simplified approximation)
function calculateNextRun(schedule: string): string | null {
  try {
    const parts = schedule.split(" ");
    if (parts.length !== 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Handle */15 (every 15 min)
    if (minute.startsWith("*/")) {
      const interval = parseInt(minute.slice(2));
      next.setMinutes(Math.ceil(now.getMinutes() / interval) * interval, 0, 0);
      if (next <= now) next.setMinutes(next.getMinutes() + interval);
      return next.toISOString();
    }

    // Handle specific hour and minute (e.g., "0 8 * * *")
    if (!minute.includes("*") && !hour.includes("*")) {
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    // Handle hour ranges (e.g., "0 8-20/2 * * *")
    if (hour.includes("-") && hour.includes("/")) {
      const [range, intervalStr] = hour.split("/");
      const [start, end] = range.split("-").map(Number);
      const interval = parseInt(intervalStr);
      for (let h = start; h <= end; h += interval) {
        next.setHours(h, parseInt(minute), 0, 0);
        if (next > now) return next.toISOString();
      }
      // Next day
      next.setDate(next.getDate() + 1);
      next.setHours(start, parseInt(minute), 0, 0);
      return next.toISOString();
    }

    return null;
  } catch {
    return null;
  }
}