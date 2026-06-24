import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

// ── Agent roster definitions (mirrors supervisor monitoring) ─────────────────
// Each entry describes an agent the supervisor monitors. Used as fallback
// when no supervisor report exists and to build the health view.

interface AgentDef {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  reportsTo: string;
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  daysOfWeek: number[] | "ALL";
  expectedTasksPerDay: number;
  taskLabel: string;
  nextScheduledTask: string;
  nextScheduledTime: string;
}

const AGENTS: AgentDef[] = [
  {
    id: "lead_generation",
    name: "Sofia Rodriguez",
    role: "Lead Generation Specialist",
    department: "Sales",
    color: "cyan",
    reportsTo: "Marcus Chen",
    shiftStartHour: 8,
    shiftStartMinute: 0,
    shiftEndHour: 17,
    shiftEndMinute: 0,
    daysOfWeek: "ALL",
    expectedTasksPerDay: 12,
    taskLabel: "Prospecting & lead outreach",
    nextScheduledTask: "Morning outreach batch",
    nextScheduledTime: "8:00 AM",
  },
  {
    id: "sales",
    name: "Marcus Chen",
    role: "Sales Director",
    department: "Sales",
    color: "blue",
    reportsTo: "Alexandra Sterling",
    shiftStartHour: 9,
    shiftStartMinute: 0,
    shiftEndHour: 17,
    shiftEndMinute: 0,
    daysOfWeek: "ALL",
    expectedTasksPerDay: 10,
    taskLabel: "Sales pipeline review & follow-ups",
    nextScheduledTask: "Pipeline review call",
    nextScheduledTime: "9:00 AM",
  },
  {
    id: "customer_success",
    name: "Emily Watson",
    role: "Customer Success Manager",
    department: "Customer Success",
    color: "red",
    reportsTo: "Marcus Chen",
    shiftStartHour: 9,
    shiftStartMinute: 30,
    shiftEndHour: 17,
    shiftEndMinute: 0,
    daysOfWeek: "ALL",
    expectedTasksPerDay: 14,
    taskLabel: "Driver engagement & customer success",
    nextScheduledTask: "Driver check-in calls",
    nextScheduledTime: "9:30 AM",
  },
  {
    id: "operations",
    name: "David Kumar",
    role: "Operations Director",
    department: "Operations",
    color: "green",
    reportsTo: "Alexandra Sterling",
    shiftStartHour: 10,
    shiftStartMinute: 0,
    shiftEndHour: 18,
    shiftEndMinute: 0,
    daysOfWeek: "ALL",
    expectedTasksPerDay: 8,
    taskLabel: "Operations check & dispatch review",
    nextScheduledTask: "Dispatch board review",
    nextScheduledTime: "10:00 AM",
  },
  {
    id: "hr",
    name: "Jennifer Foster",
    role: "HR Director",
    department: "Human Resources",
    color: "orange",
    reportsTo: "Alexandra Sterling",
    shiftStartHour: 11,
    shiftStartMinute: 0,
    shiftEndHour: 17,
    shiftEndMinute: 0,
    daysOfWeek: "ALL",
    expectedTasksPerDay: 6,
    taskLabel: "HR review & driver relations",
    nextScheduledTask: "Driver relations check",
    nextScheduledTime: "11:00 AM",
  },
  {
    id: "finance",
    name: "Robert Chang",
    role: "Finance Director",
    department: "Finance",
    color: "amber",
    reportsTo: "Alexandra Sterling",
    shiftStartHour: 12,
    shiftStartMinute: 0,
    shiftEndHour: 17,
    shiftEndMinute: 0,
    daysOfWeek: "ALL",
    expectedTasksPerDay: 5,
    taskLabel: "Finance review & invoicing",
    nextScheduledTask: "Invoice processing",
    nextScheduledTime: "12:00 PM",
  },
  {
    id: "marketing",
    name: "Isabella Martinez",
    role: "Marketing Director",
    department: "Marketing",
    color: "pink",
    reportsTo: "Alexandra Sterling",
    shiftStartHour: 8,
    shiftStartMinute: 0,
    shiftEndHour: 13,
    shiftEndMinute: 0,
    daysOfWeek: [1],
    expectedTasksPerDay: 4,
    taskLabel: "Weekly marketing analysis",
    nextScheduledTask: "SEO ranking analysis",
    nextScheduledTime: "Monday 8:00 AM",
  },
  {
    id: "ceo",
    name: "Alexandra Sterling",
    role: "Chief Executive Officer",
    department: "Executive",
    color: "purple",
    reportsTo: "—",
    shiftStartHour: 6,
    shiftStartMinute: 0,
    shiftEndHour: 11,
    shiftEndMinute: 0,
    daysOfWeek: [1],
    expectedTasksPerDay: 3,
    taskLabel: "CEO strategic review",
    nextScheduledTask: "Executive briefing",
    nextScheduledTime: "Monday 6:00 AM",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOnShift(agent: AgentDef, now: Date): boolean {
  const day = now.getDay();
  const worksToday =
    agent.daysOfWeek === "ALL" ? true : agent.daysOfWeek.includes(day);
  if (!worksToday) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = agent.shiftStartHour * 60 + agent.shiftStartMinute;
  const endMin = agent.shiftEndHour * 60 + agent.shiftEndMinute;
  return nowMin >= startMin && nowMin <= endMin;
}

function formatRelative(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Fetch supervisor monitoring reports ─────────────────────────────────
    const supervisorReports: any[] = await db
      .collection("agent_activity")
      .find({
        "agent.name": "AI Supervisor",
        action: "supervisor_monitoring",
      })
      .sort({ timestamp: -1 })
      .limit(30)
      .toArray();

    // ── Fetch all recent agent activity for health view ─────────────────────
    const allActivityRaw: any[] = await db
      .collection("agent_activity")
      .find({})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(500)
      .toArray();

    // Group by agent name
    const activityByName: Record<string, any[]> = {};
    for (const doc of allActivityRaw) {
      const name =
        typeof doc.agent === "string"
          ? doc.agent
          : doc.agent?.name || doc.agentId || "Unknown";
      if (!activityByName[name]) activityByName[name] = [];
      activityByName[name].push(doc);
    }

    // ── Build latest report ─────────────────────────────────────────────────
    let latestReport: any = null;
    if (supervisorReports.length > 0) {
      const report = supervisorReports[0];
      const result = report.result || {};
      latestReport = {
        timestamp: report.timestamp || report.createdAt || now.toISOString(),
        agentsMonitored: result.agentsMonitored ?? AGENTS.length,
        activeAgents: result.activeAgents ?? 0,
        idleAgents: result.idleAgents ?? 0,
        errorsFound: result.errorsFound ?? 0,
        recommendations: result.recommendations ?? [],
        idleAgentAssignments: result.idleAgentAssignments ?? {},
      };
    } else {
      // No supervisor report found — build a live view from activity data
      let activeCount = 0;
      let idleCount = 0;
      let errorCount = 0;

      for (const agent of AGENTS) {
        const activity = activityByName[agent.name] || [];
        const todayActivity = activity.filter((a) => {
          const ts = new Date(a.timestamp || a.createdAt || now);
          return ts >= todayStart;
        });
        const lastActivity = activity[0];
        const lastActivityTime =
          lastActivity?.timestamp || lastActivity?.createdAt || null;
        const isOn = isOnShift(agent, now);

        if (!isOn) {
          // off shift — don't count as idle or active
        } else if (todayActivity.length > 0) {
          activeCount++;
        } else {
          idleCount++;
        }
      }

      latestReport = {
        timestamp: now.toISOString(),
        agentsMonitored: AGENTS.length,
        activeAgents: activeCount,
        idleAgents: idleCount,
        errorsFound: errorCount,
        recommendations: [],
        idleAgentAssignments: {},
      };
    }

    // ── Build history (past 30 days) ───────────────────────────────────────
    const history = supervisorReports.map((report) => {
      const result = report.result || {};
      const ts = report.timestamp || report.createdAt || now.toISOString();
      const recs: string[] = result.recommendations || [];
      const keyFindings: string[] = [];

      if (result.activeAgents !== undefined) {
        keyFindings.push(
          `${result.activeAgents} of ${result.agentsMonitored || AGENTS.length} agents active`,
        );
      }
      if (result.idleAgents && result.idleAgents > 0) {
        keyFindings.push(`${result.idleAgents} agents needed attention`);
      }
      if (result.errorsFound && result.errorsFound > 0) {
        keyFindings.push(`${result.errorsFound} errors flagged`);
      }
      if (recs.length > 0) {
        keyFindings.push(`${recs.length} recommendations issued`);
      }

      return {
        timestamp: ts,
        agentsMonitored: result.agentsMonitored ?? AGENTS.length,
        activeAgents: result.activeAgents ?? 0,
        idleAgents: result.idleAgents ?? 0,
        errorsFound: result.errorsFound ?? 0,
        recommendations: recs,
        idleAgentAssignments: result.idleAgentAssignments ?? {},
        keyFindings,
      };
    });

    // ── Build agent health ──────────────────────────────────────────────────
    const agentHealth = AGENTS.map((agent) => {
      const activity = activityByName[agent.name] || [];

      const todayActivity = activity.filter((a) => {
        const ts = new Date(a.timestamp || a.createdAt || now);
        return ts >= todayStart;
      });

      const lastActivity = activity[0];
      const lastActivityTime: string | null =
        lastActivity?.timestamp || lastActivity?.createdAt || null;

      const isOn = isOnShift(agent, now);
      const hasActivityToday = todayActivity.length > 0;

      let status: "active" | "idle" | "error" = "idle";
      if (!isOn) {
        status = "idle"; // off-shift
      } else if (hasActivityToday) {
        status = "active";
      } else {
        status = "idle";
      }

      // Current task: most recent activity description
      const currentTask =
        lastActivity?.activity ||
        lastActivity?.action ||
        lastActivity?.details ||
        null;

      // Next scheduled
      const nextScheduled = isOn
        ? `${agent.nextScheduledTask} at ${agent.nextScheduledTime}`
        : `Next: ${agent.nextScheduledTime}`;

      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        department: agent.department,
        color: agent.color,
        reportsTo: agent.reportsTo,
        status,
        lastActivity: lastActivityTime,
        lastActivityRelative: formatRelative(lastActivityTime),
        tasksToday: todayActivity.length,
        currentTask: isOn ? currentTask || "Awaiting assignment" : "Off shift",
        nextScheduled,
        recentActivity: activity.slice(0, 5).map((a) => ({
          id: a._id?.toString() || "",
          action: a.action || a.activity || a.type || "activity",
          description: a.activity || a.action || a.details || "",
          success: a.success !== false,
          timestamp: a.timestamp || a.createdAt || null,
        })),
      };
    });

    // ── Summary counts ─────────────────────────────────────────────────────
    const tasksAssignedToday = Object.keys(
      latestReport.idleAgentAssignments || {},
    ).length;

    return NextResponse.json({
      success: true,
      latestReport: {
        ...latestReport,
        tasksAssignedToday,
      },
      history,
      agentHealth,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    console.error("[api/admin/supervisor] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch supervisor data", message: String(error) },
      { status: 500 },
    );
  }
}
