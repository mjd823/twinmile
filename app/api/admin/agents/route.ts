import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";
import { computeJobStatuses, type JobStatusRow } from "@/lib/agent-status";
import { chicagoWeekday } from "@/lib/cron-jobs";
import {
  AGENT_WORKFLOWS,
  AGENT_ACTIONS,
  AGENT_DEPARTMENTS,
  TOOL_DESCRIPTIONS,
  type WorkflowStep,
} from "@/lib/agent-dashboard-data";

// ── Static agent definitions (the 8 AI agents) ──────────────────────────────

interface AgentDef {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  icon: string;
  reportsTo?: string;
}

const AGENTS: AgentDef[] = [
  { id: "lead_generation", name: "Sofia Rodriguez",     role: "Lead Generation Specialist", department: "Sales",            color: "bg-cyan-500",   icon: "Target",     reportsTo: "Marcus Chen" },
  { id: "sales",           name: "Marcus Chen",          role: "Sales Director",             department: "Sales",            color: "bg-blue-500",   icon: "Users",      reportsTo: "Alexandra Sterling" },
  { id: "ceo",             name: "Alexandra Sterling",   role: "Chief Executive Officer",    department: "Executive",        color: "bg-purple-500", icon: "Crown",      reportsTo: undefined },
  { id: "operations",      name: "David Kumar",          role: "Operations Director",        department: "Operations",       color: "bg-green-500",  icon: "Truck",      reportsTo: "Alexandra Sterling" },
  { id: "hr",              name: "Jennifer Foster",      role: "HR Director",                department: "Human Resources",  color: "bg-orange-500", icon: "UserCheck",  reportsTo: "Alexandra Sterling" },
  { id: "marketing",       name: "Isabella Martinez",    role: "Marketing Director",         department: "Marketing",        color: "bg-pink-500",   icon: "Megaphone",  reportsTo: "Alexandra Sterling" },
  { id: "finance",         name: "Robert Chang",         role: "Finance Director",           department: "Finance",          color: "bg-yellow-500", icon: "DollarSign", reportsTo: "Alexandra Sterling" },
  { id: "customer_success",name: "Emily Watson",         role: "Customer Success Manager",   department: "Customer Success", color: "bg-red-500",    icon: "Heart",      reportsTo: "Marcus Chen" },
];

// Map agent id → human name for DB queries
const AGENT_NAME_MAP: Record<string, string> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a.name]),
);

// Derive the tool list for an agent from its workflow steps
function getAgentTools(agentId: string): string[] {
  const steps = AGENT_WORKFLOWS[agentId] || [];
  const toolSet = new Set<string>();
  for (const step of steps) {
    if (step.tools) {
      for (const t of step.tools) toolSet.add(t);
    }
  }
  return Array.from(toolSet);
}

// Build a tools array with descriptions for an agent
function buildTools(agentId: string) {
  const toolIds = getAgentTools(agentId);
  return toolIds.map((id) => {
    const def = TOOL_DESCRIPTIONS[id];
    return {
      id,
      name: def?.name ?? id,
      description: def?.description ?? "",
      agentUsage: def?.agentUsage?.[agentId] ?? "",
    };
  });
}

// Full-collection windowed metrics per agent (no 500-row sample): one
// $group aggregation with $ifNull-coalesced timestamps.
interface AgentAggMetrics {
  total: number;
  successful: number;
  today: number;
  week: number;
  month: number;
  lastActivity: Date | null;
}

async function aggregateAgentMetrics(db: any): Promise<Map<string, AgentAggMetrics>> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .collection("agent_activity")
    .aggregate([
      {
        $addFields: {
          _t: { $ifNull: ["$createdAt", "$timestamp"] },
          _name: {
            $cond: [
              { $eq: [{ $type: "$agent" }, "string"] },
              "$agent",
              { $ifNull: ["$agent.name", { $ifNull: ["$agentId", "Unknown"] }] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_name",
          total: { $sum: 1 },
          successful: { $sum: { $cond: [{ $ne: ["$success", false] }, 1, 0] } },
          today: { $sum: { $cond: [{ $gte: ["$_t", todayStart] }, 1, 0] } },
          week: { $sum: { $cond: [{ $gte: ["$_t", weekAgo] }, 1, 0] } },
          month: { $sum: { $cond: [{ $gte: ["$_t", monthAgo] }, 1, 0] } },
          lastActivity: { $max: "$_t" },
        },
      },
    ])
    .toArray();

  return new Map(
    rows.map((r: any) => [
      String(r._id),
      {
        total: r.total || 0,
        successful: r.successful || 0,
        today: r.today || 0,
        week: r.week || 0,
        month: r.month || 0,
        lastActivity: r.lastActivity || null,
      },
    ])
  );
}

export type AgentScheduleStatus = "busy" | "on_schedule" | "late" | "error" | "off_duty";

/**
 * Honest status now that agents run as Vercel crons (lib/cron-jobs.ts):
 *  - busy         → logged activity in the last 10 minutes
 *  - on_schedule  → every cron due today ran inside its freshness window
 *  - late         → a due cron hasn't run inside its window (or never ran)
 *  - error        → the last run of one of its crons failed
 *  - off_duty     → nothing scheduled today (e.g. weekly agents outside Monday)
 * "Idle" is gone — a scheduled agent that already did today's run is on
 * schedule, not slacking.
 */
function deriveStatus(
  jobs: JobStatusRow[],
  lastActivityTime: string | null,
  isMondayCT: boolean
): AgentScheduleStatus {
  if (lastActivityTime) {
    const minutesAgo = (Date.now() - new Date(lastActivityTime).getTime()) / (1000 * 60);
    if (minutesAgo < 10) return "busy";
  }
  if (jobs.length === 0) return "off_duty";
  if (jobs.some((j) => j.status === "error")) return "error";
  const dueToday = jobs.filter((j) => j.cadence !== "weekly" || isMondayCT);
  if (dueToday.length === 0) return "off_duty";
  if (dueToday.some((j) => j.status === "late" || j.status === "never_ran")) return "late";
  return "on_schedule";
}

// ── API handler ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!clientPromise) {
      return NextResponse.json(
        { error: "MONGODB_URI not configured" },
        { status: 500 },
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Recent activity rows (for the per-agent activity feeds) sorted by the
    // COALESCED timestamp (legacy rows only have `timestamp`), plus
    // full-collection windowed metrics (aggregation — not a row sample).
    const [allActivityRaw, totalActivityRecords, metricsByName, statusReport] = await Promise.all([
      db
        .collection("agent_activity")
        .aggregate([
          { $addFields: { _sortTime: { $ifNull: ["$createdAt", "$timestamp"] } } },
          { $sort: { _sortTime: -1 } },
          { $limit: 500 },
        ])
        .toArray(),
      // Real total — previously this reported the query's 500-row cap.
      db.collection("agent_activity").countDocuments(),
      aggregateAgentMetrics(db),
      computeJobStatuses(db),
    ]);

    const isMondayCT = chicagoWeekday() === "Monday";
    const jobsByAgent: Record<string, JobStatusRow[]> = {};
    for (const j of statusReport.jobs) {
      (jobsByAgent[j.agent] ??= []).push(j);
    }

    // Group activity by agent name
    const activityByName: Record<string, any[]> = {};
    for (const doc of allActivityRaw) {
      const name =
        typeof doc.agent === "string"
          ? doc.agent
          : doc.agent?.name || doc.agentId || "Unknown";
      if (!activityByName[name]) activityByName[name] = [];
      activityByName[name].push(doc);
    }

    // Build the final agent payloads
    const agents = AGENTS.map((def) => {
      const activity = activityByName[def.name] || [];
      const agg: AgentAggMetrics = metricsByName.get(def.name) || {
        total: 0, successful: 0, today: 0, week: 0, month: 0, lastActivity: null,
      };
      const tasksToday = agg.today;

      const lastActivityTime = agg.lastActivity
        ? new Date(agg.lastActivity).toISOString()
        : activity[0]?.timestamp || activity[0]?.createdAt || null;
      const agentJobs = jobsByAgent[def.name] || [];
      const status = deriveStatus(agentJobs, lastActivityTime, isMondayCT);

      const action = AGENT_ACTIONS[def.id];
      const workflow: WorkflowStep[] = AGENT_WORKFLOWS[def.id] || [];
      const tools = buildTools(def.id);
      // Full-collection metrics: real all-time totals + windowed counts.
      const metrics = {
        tasksToday,
        tasksThisWeek: agg.week,
        tasksThisMonth: agg.month,
        totalTasks: agg.total,
        successRate: agg.total > 0 ? Math.round((agg.successful / agg.total) * 1000) / 10 : 0,
        lastActivityTime,
      };

      const currentTask =
        activity[0]?.activity ||
        activity[0]?.action ||
        (tasksToday > 0
          ? `${tasksToday} task${tasksToday === 1 ? "" : "s"} completed today`
          : "Awaiting next scheduled task");

      // Human-friendly action labels
      const actionLabels: Record<string, string> = {
        "fmcsa_prospecting": "FMCSA Carrier Search",
        "web_prospecting": "Web Search Prospecting",
        "browser_prospecting": "Browser Research",
        "outbound_prospecting": "Outbound Prospecting",
        "outreach_processing": "Processing Outreach",
        "outreach_cron": "Outreach Processed",
        "outreach_cron_summary": "Outreach Summary",
        "outreach_summary": "Outreach Summary",
        "outreach_seeding": "Seeding Outreach Tasks",
        "onboarding_invite": "Onboarding Invitation Sent",
        "auto_onboarding_invite": "Onboarding Invitation Sent",
        "daily_ai_ops": "Daily Operations Review",
        "daily_sales_review": "Sales Strategy Review",
        "daily_ops_check": "Operations Check",
        "daily_ops": "Operations Check",
        "hr_onboarding_review": "HR Onboarding Review",
        "onboarding_link_clicked": "Onboarding Link Clicked",
        "daily_finance_review": "Finance Review",
        "finance_review": "Finance Review",
        "customer_success_check": "Customer Success Check",
        "customer_support": "Customer Support",
        "driver_engagement": "Driver Engagement Check",
        "marketing_analysis": "Marketing Analysis",
        "ceo_strategic_review": "CEO Strategic Review",
        "weekly_review": "Weekly Review",
        "supervisor_monitoring": "Supervisor Monitoring Check",
        "monthly_bi": "Monthly Business Intelligence",
        "proactive_trucking_forum_research": "Trucking Forum Research",
        "proactive_seo_analysis": "SEO Analysis",
        "proactive_fuel_cost_analysis": "Fuel Cost Analysis",
        "proactive_strategic_research": "Strategic Research",
        "proactive_compliance_research": "Compliance Research",
        "find_customers": "Finding New Prospects",
      };

      // Map activity docs to a clean serializable shape (limit 20 per agent)
      const recentActivity = activity.slice(0, 20).map((a) => {
        const rawAction = a.action || a.type || "activity";
        const label = actionLabels[rawAction] || rawAction.replace(/_/g, " ");

        // Build human-friendly description from result
        let description = label;
        const r = a.result || {};
        if (typeof r === "object" && r !== null) {
          if (r.carriersFound !== undefined) {
            description = `Found ${r.carriersFound} carriers, ${r.qualified || 0} qualified, ${r.saved || 0} saved`;
          } else if (r.sent !== undefined) {
            description = `${r.sent} sent, ${r.failed || 0} failed, ${r.skipped || 0} skipped`;
          } else if (r.prospectsFound !== undefined) {
            description = `Found ${r.prospectsFound} prospects, ${r.prospectsSaved || 0} saved`;
          } else if (r.agentsMonitored !== undefined) {
            description = `Monitored ${r.agentsMonitored} agents — ${r.activeAgents || 0} active, ${r.idleAgents || 0} idle`;
          } else if (r.summary) {
            description = String(r.summary);
          } else if (a.activity) {
            description = a.activity;
          }
        }

        return {
          id: a._id?.toString() || "",
          type: rawAction,
          label,
          description,
          details: a.details || a.result || {},
          success: a.success !== false,
          timestamp: a.timestamp || a.createdAt || null,
        };
      });

      // Live schedule rows for this agent (from the real Vercel cron registry)
      const scheduledJobs = agentJobs.map((j) => ({
        id: j.id,
        name: j.name,
        cadence: j.cadence,
        status: j.status,
        lastRun: j.lastRun,
        hoursSinceLastRun: j.hoursSinceLastRun,
      }));

      return {
        id: def.id,
        name: def.name,
        role: def.role,
        department: AGENT_DEPARTMENTS[def.id] || def.department,
        color: def.color,
        icon: def.icon,
        reportsTo: def.reportsTo,
        status,
        currentTask,
        tasksToday,
        lastActivityTime,
        scheduledJobs,
        nextScheduled:
          agentJobs.length > 0
            ? `${agentJobs.length} scheduled job${agentJobs.length === 1 ? "" : "s"} (${agentJobs.map((j) => j.cadence).join(", ")})`
            : action?.label
              ? `Next: ${action.label} at ${action.time || "scheduled time"}`
              : "No scheduled task",
        action: action
          ? {
              action: action.action,
              label: action.label,
              description: action.description,
              icon: action.icon,
              time: action.time,
            }
          : null,
        workflow,
        tools,
        metrics,
        recentActivity,
        configuration: {
          model: "openrouter/owl-alpha",
          provider: "openrouter",
          department: AGENT_DEPARTMENTS[def.id] || def.department,
          reportsTo: def.reportsTo || "—",
        },
      };
    });

    const totalTasksToday = agents.reduce((sum, a) => sum + a.tasksToday, 0);
    const busyCount = agents.filter((a) => a.status === "busy").length;
    const onScheduleCount = agents.filter((a) => a.status === "on_schedule").length;
    const attentionCount = agents.filter((a) => a.status === "late" || a.status === "error").length;
    const offDutyCount = agents.filter((a) => a.status === "off_duty").length;

    return NextResponse.json({
      success: true,
      data: {
        agents,
        summary: {
          totalAgents: agents.length,
          totalTasksToday,
          busyCount,
          onScheduleCount,
          attentionCount,
          offDutyCount,
          totalActivityRecords,
        },
      },
    });
  } catch (error) {
    console.error("[api/admin/agents] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent data", message: String(error) },
      { status: 500 },
    );
  }
}