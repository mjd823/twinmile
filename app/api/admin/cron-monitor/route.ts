import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

// Static cron job definitions (same as the component)
const CRON_JOB_DEFS = [
  { id: "00796b3c6135", name: "Process Outreach Tasks", schedule: "*/15 * * * *", description: "Processes pending outreach tasks every 15 minutes", skill: "claude-code" },
  { id: "93aaa6272b8c", name: "Auto Onboarding Invitations", schedule: "0 8-20/2 * * *", description: "Sends onboarding invitations to qualified leads every 2 hours during business hours", skill: "claude-code" },
  { id: "10177a8ab2cf", name: "Sofia — Outbound Prospecting (FMCSA + Web)", schedule: "0 8 * * *", description: "Sofia queries FMCSA Census API + web search + browser for real owner-operators daily at 8am", skill: "web" },
  { id: "8c53c6ce9d90", name: "Daily AI Operations", schedule: "0 7 * * *", description: "Reviews overnight activity, processes pending onboarding tasks", skill: "web" },
  { id: "17a94fde883f", name: "Weekly Strategic Review", schedule: "0 6 * * 1", description: "Analyzes past week metrics, conversion rates, pipeline health", skill: "web" },
  { id: "9ee75230bf31", name: "Monthly Business Intelligence", schedule: "0 5 1 * *", description: "Aggregates monthly metrics for business intelligence report", skill: "web" },
  { id: "e8dd1c631f6a", name: "Driver Engagement", schedule: "0 9 * * *", description: "Checks for drivers needing engagement, sends follow-up messages", skill: "web" },
  { id: "2395ac48f817", name: "Auto Onboarding Invite (Weekdays)", schedule: "0 8,10,12,14,16,18,20 * * 1-5", description: "Invites qualified prospects to onboarding portal on weekdays", skill: "claude-code" },
  { id: "4be574df5689", name: "Marcus Chen — Daily Sales Review", schedule: "0 9 * * *", description: "Reviews qualified leads, drafts personalized outreach strategies, monitors competitors", skill: "web" },
  { id: "05ded9849d2f", name: "David Kumar — Daily Ops Check", schedule: "0 10 * * *", description: "Checks fleet/driver capacity, researches market rates and freight trends", skill: "web" },
  { id: "146d13ca8622", name: "Jennifer Foster — HR Onboarding Review", schedule: "0 11 * * *", description: "Reviews onboarding progress, researches compliance requirements, retention strategies", skill: "web" },
  { id: "e92124812273", name: "Robert Chang — Daily Finance Review", schedule: "0 12 * * *", description: "Analyzes revenue, researches factoring rates and cost optimization", skill: "web" },
  { id: "c977f5067376", name: "Emily Watson — Customer Success Check", schedule: "0 14 * * *", description: "Researches customer businesses, monitors online reputation, retention recommendations", skill: "web" },
  { id: "2171a406ef62", name: "Isabella Martinez — Marketing Analysis", schedule: "0 8 * * 1", description: "Analyzes lead sources, competitor marketing, SEO performance (weekly)", skill: "web" },
  { id: "5dff3683b416", name: "Alexandra Sterling — CEO Strategic Review", schedule: "0 6 * * 1", description: "Full organization performance review, industry research, executive decisions (weekly)", skill: "web" },
  { id: "cfa808bb49c6", name: "AI Supervisor — Proactive Monitor", schedule: "0 6,12,18 * * *", description: "Monitors all 8 agents 3x daily — assigns proactive work to idle agents, investigates errors, ensures 40hr/week productivity", skill: "web" },
];

// Map cron jobs to their activity types in agent_activity collection
const JOB_ACTIVITY_MAP: Record<string, string[]> = {
  "00796b3c6135": ["outreach_processing", "process_outreach", "outreach_cron", "outreach_cron_summary"],
  "93aaa6272b8c": ["auto_onboarding_invite", "onboarding_invite"],
  "10177a8ab2cf": ["fmcsa_prospecting", "outbound_prospecting", "web_prospecting", "browser_prospecting"],
  "9ee75230bf31": ["monthly_bi", "monthly_report"],
  "e8dd1c631f6a": ["driver_engagement", "engagement"],
  "4be574df5689": ["daily_sales_review", "sales_review"],
  "05ded9849d2f": ["daily_ops_check", "ops_check"],
  "146d13ca8622": ["hr_onboarding_review", "onboarding_link_clicked"],
  "e92124812273": ["daily_finance_review", "finance_review"],
  "c977f5067376": ["customer_success_check", "customer_support"],
  "2171a406ef62": ["marketing_analysis"],
  "5dff3683b416": ["ceo_strategic_review"],
  "cfa808bb49c6": ["supervisor_monitoring"],
};
/**
 * GET /api/admin/cron-monitor
 * Returns all Hermes cron jobs with their status derived from agent_activity collection.
 * This approach works on Vercel (no hermes CLI needed) because cron jobs log to MongoDB.
 */
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

    // Get recent activity for each job
    const cronJobs = await Promise.all(
      CRON_JOB_DEFS.map(async (def) => {
        const activityTypes = JOB_ACTIVITY_MAP[def.id] || [];
        // Find the most recent activity for this job
        const lastActivity = await db.collection("agent_activity")
          .find({ action: { $in: activityTypes } })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        // Count activities in the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const todayCount = await db.collection("agent_activity")
          .countDocuments({
            action: { $in: activityTypes },
            createdAt: { $gte: twentyFourHoursAgo },
          });

        const last = lastActivity[0];
        const lastRun = last?.createdAt || null;
        const lastStatus = last ? (last.success ? "ok" : "error") : null;
        const lastResult = last?.result || null;

        // Calculate next run based on schedule (simplified)
        const nextRun = calculateNextRun(def.schedule);

        return {
          id: def.id,
          name: def.name,
          schedule: def.schedule,
          description: def.description,
          skill: def.skill,
          lastRun,
          lastStatus,
          lastResult,
          nextRun,
          todayCount,
          enabled: true,
          model: "glm-5.2",
          provider: "ollama-cloud",
        };
      })
    );

    // Get recent activity logs
    const activityLogs = await db.collection("agent_activity")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Get email logs from onboarding_sessions
    const rawSessions = await db.collection("onboarding_sessions")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const emailLogs = rawSessions.map((s: any) => ({
      id: s._id?.toString(),
      type: "onboarding_invitation",
      recipient: s.email || s.name,
      leadName: s.name,
      leadType: s.leadType,
      status: s.status,
      sentAt: s.createdAt,
      expiresAt: s.expiresAt,
      completedAt: s.completedAt,
      aiScore: s.metadata?.aiScore,
      sessionToken: s.rawToken?.substring(0, 8) + "...",
    }));

    return NextResponse.json({
      success: true,
      data: {
        cronJobs,
        activityLogs: activityLogs.map((a: any) => ({
          id: a._id?.toString(),
          action: a.action || a.type || "activity",
          agent: a.agent?.name || (typeof a.agent === "string" ? a.agent : "System"),
          agentRole: a.agent?.role || "Automated",
          agentDepartment: a.agent?.department || "System",
          result: a.result || a.details || (a.activity ? { summary: a.activity } : undefined),
          success: a.success,
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