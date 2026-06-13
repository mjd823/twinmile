import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { AgentDashboardClient } from "./agent-dashboard-client";
import {
  AGENT_WORKFLOWS,
  AGENT_ACTIONS,
  AGENT_DEPARTMENTS,
  TOOL_DESCRIPTIONS,
} from "@/lib/agent-dashboard-data";

// All valid agent IDs
const VALID_AGENTS: Record<
  string,
  { name: string; role: string; color: string; reportsTo?: string }
> = {
  ceo: { name: "Alexandra Sterling", role: "Chief Executive Officer", color: "bg-purple-500" },
  sales: { name: "Marcus Chen", role: "Sales Director", color: "bg-blue-500", reportsTo: "Alexandra Sterling" },
  operations: { name: "David Kumar", role: "Operations Director", color: "bg-green-500", reportsTo: "Alexandra Sterling" },
  hr: { name: "Jennifer Foster", role: "HR Director", color: "bg-orange-500", reportsTo: "Alexandra Sterling" },
  marketing: { name: "Isabella Martinez", role: "Marketing Director", color: "bg-pink-500", reportsTo: "Alexandra Sterling" },
  finance: { name: "Robert Chang", role: "Finance Director", color: "bg-yellow-500", reportsTo: "Alexandra Sterling" },
  customer_success: { name: "Emily Watson", role: "Customer Success Manager", color: "bg-red-500", reportsTo: "Marcus Chen" },
  lead_generation: { name: "Sofia Rodriguez", role: "Lead Generation Specialist", color: "bg-cyan-500", reportsTo: "Marcus Chen" },
};

export async function generateStaticParams() {
  return Object.keys(VALID_AGENTS).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = VALID_AGENTS[id];
  return {
    title: agent ? `${agent.name} — AI Agent Dashboard` : "Agent Not Found",
    robots: { index: false, follow: false },
  };
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin");
  if (!user) return null;

  const { id } = await params;
  const agent = VALID_AGENTS[id];
  if (!agent) notFound();

  // Fetch recent activity for this agent from MongoDB
  let recentActivity: any[] = [];
  try {
    const client = await clientPromise!;
    const db = client.db();
    // Agent activity stores agent as object with name, so we need to match by agent.name
    const agentNames = [
      "Sofia Rodriguez", // lead_generation
      "Marcus Chen", // sales
      "Alexandra Sterling", // ceo
      "David Kumar", // operations
      "Jennifer Foster", // hr
      "Robert Chang", // finance
      "Emily Watson", // customer_success
      "Isabella Martinez", // marketing
    ];
    // Map agentId to the display name used in activity logs
    const agentNameMap: Record<string, string> = {
      lead_generation: "Sofia Rodriguez",
      sales: "Marcus Chen",
      ceo: "Alexandra Sterling",
      operations: "David Kumar",
      hr: "Jennifer Foster",
      finance: "Robert Chang",
      customer_success: "Emily Watson",
      marketing: "Isabella Martinez",
    };
    const searchName = agentNameMap[id];
    
    const raw = await db
      .collection("agent_activity")
      .find({ 
        $or: [
          { agent: searchName },
          { "agent.name": searchName },
          { agentId: id },
        ]
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    recentActivity = raw.map((doc) => ({
      ...doc,
      _id: doc._id?.toString?.() ?? doc._id,
      timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : doc.timestamp,
    }));
  } catch {
    // DB may not have agent_activity yet — that's fine
  }

  const workflow = AGENT_WORKFLOWS[id] || [];
  const action = AGENT_ACTIONS[id] || null;
  const department = AGENT_DEPARTMENTS[id] || "General";

  // Resolve tool info for the agent
  const agentTools = workflow
    .flatMap((s) => s.tools || [])
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((toolKey) => ({
      key: toolKey,
      name: TOOL_DESCRIPTIONS[toolKey]?.name || toolKey,
      description: TOOL_DESCRIPTIONS[toolKey]?.description || "",
      usage: TOOL_DESCRIPTIONS[toolKey]?.agentUsage[id] || "",
    }));

  return (
    <AgentDashboardClient
      agentId={id}
      name={agent.name}
      role={agent.role}
      department={department}
      color={agent.color}
      reportsTo={agent.reportsTo}
      action={action}
      tools={agentTools}
      recentActivity={recentActivity}
    />
  );
}
