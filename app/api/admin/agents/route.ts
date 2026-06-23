import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";
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

// Build metrics from activity counts
function buildMetrics(agentId: string, activity: any[], tasksToday: number) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const tasksThisWeek = activity.filter((a) => {
    const ts = new Date(a.timestamp || a.createdAt || now);
    return ts >= weekAgo;
  }).length;

  const tasksThisMonth = activity.filter((a) => {
    const ts = new Date(a.timestamp || a.createdAt || now);
    return ts >= monthAgo;
  }).length;

  const successful = activity.filter((a) => a.success !== false).length;
  const total = activity.length;
  const successRate = total > 0 ? Math.round((successful / total) * 1000) / 10 : 0;

  const lastActivityTime = activity[0]?.timestamp || activity[0]?.createdAt || null;

  return {
    tasksToday,
    tasksThisWeek,
    tasksThisMonth,
    totalTasks: total,
    successRate,
    lastActivityTime,
  };
}

// Determine status from activity recency + tasks today
function deriveStatus(tasksToday: number, lastActivityTime: string | null): "active" | "idle" | "busy" {
  if (tasksToday === 0) return "idle";
  if (!lastActivityTime) return "idle";
  const last = new Date(lastActivityTime);
  const minutesAgo = (Date.now() - last.getTime()) / (1000 * 60);
  if (minutesAgo < 10) return "busy";   // actively working (activity in last 10 min)
  if (minutesAgo < 120) return "active"; // worked recently (within 2 hours)
  return "idle";
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

    // Fetch real activity for each agent from agent_activity collection.
    // The collection stores the agent name either as a top-level string or
    // nested under agent.name — query both shapes.
    const allActivityRaw = await db
      .collection("agent_activity")
      .find({})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(500)
      .toArray();

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
      const tasksToday = activity.filter((a) => {
        const ts = new Date(a.timestamp || a.createdAt || now);
        return ts >= todayStart;
      }).length;

      const lastActivityTime =
        activity[0]?.timestamp || activity[0]?.createdAt || null;
      const status = deriveStatus(tasksToday, lastActivityTime);

      const action = AGENT_ACTIONS[def.id];
      const workflow: WorkflowStep[] = AGENT_WORKFLOWS[def.id] || [];
      const tools = buildTools(def.id);
      const metrics = buildMetrics(def.id, activity, tasksToday);

      const currentTask =
        activity[0]?.activity ||
        activity[0]?.action ||
        (tasksToday > 0
          ? `${tasksToday} task${tasksToday === 1 ? "" : "s"} completed today`
          : "Awaiting next scheduled task");

      // Map activity docs to a clean serializable shape (limit 20 per agent)
      const recentActivity = activity.slice(0, 20).map((a) => ({
        id: a._id?.toString() || "",
        type: a.type || a.action || "activity",
        description:
          a.activity || a.action || "Activity performed",
        details: a.details || a.result || {},
        success: a.success !== false,
        timestamp: a.timestamp || a.createdAt || null,
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
        nextScheduled: action?.label
          ? `Next: ${action.label}`
          : "No scheduled task",
        action: action
          ? {
              action: action.action,
              label: action.label,
              description: action.description,
              icon: action.icon,
            }
          : null,
        workflow,
        tools,
        metrics,
        recentActivity,
        configuration: {
          model: process.env.OLLAMA_MODEL || "glm-5.2",
          provider: "ollama-cloud",
          department: AGENT_DEPARTMENTS[def.id] || def.department,
          reportsTo: def.reportsTo || "—",
        },
      };
    });

    const totalTasksToday = agents.reduce((sum, a) => sum + a.tasksToday, 0);
    const activeCount = agents.filter((a) => a.status === "active" || a.status === "busy").length;
    const idleCount = agents.filter((a) => a.status === "idle").length;
    const busyCount = agents.filter((a) => a.status === "busy").length;

    return NextResponse.json({
      success: true,
      data: {
        agents,
        summary: {
          totalAgents: agents.length,
          totalTasksToday,
          activeCount,
          idleCount,
          busyCount,
          totalActivityRecords: allActivityRaw.length,
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