import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const AGENT_CONFIG: Record<string, { name: string; role: string; department: string; color: string; reportsTo?: string }> = {
  ceo: { name: "Alexandra Sterling", role: "Chief Executive Officer", department: "Executive", color: "bg-purple-500" },
  sales: { name: "Marcus Chen", role: "Sales Director", department: "Sales", color: "bg-blue-500", reportsTo: "Alexandra Sterling" },
  operations: { name: "David Kumar", role: "Operations Director", department: "Operations", color: "bg-green-500", reportsTo: "Alexandra Sterling" },
  hr: { name: "Jennifer Foster", role: "HR Director", department: "Human Resources", color: "bg-orange-500", reportsTo: "Alexandra Sterling" },
  marketing: { name: "Isabella Martinez", role: "Marketing Director", department: "Marketing", color: "bg-pink-500", reportsTo: "Alexandra Sterling" },
  finance: { name: "Robert Chang", role: "Finance Director", department: "Finance", color: "bg-yellow-500", reportsTo: "Alexandra Sterling" },
  customer_success: { name: "Emily Watson", role: "Customer Success Manager", department: "Customer Success", color: "bg-red-500", reportsTo: "Marcus Chen" },
  lead_generation: { name: "Sofia Rodriguez", role: "Lead Generation Specialist", department: "Sales", color: "bg-cyan-500", reportsTo: "Marcus Chen" },
};

const AGENT_NAME_MAP: Record<string, string> = {
  lead_generation: "Sofia Rodriguez",
  sales: "Marcus Chen",
  ceo: "Alexandra Sterling",
  operations: "David Kumar",
  hr: "Jennifer Foster",
  finance: "Robert Chang",
  customer_success: "Emily Watson",
  marketing: "Isabella Martinez",
};

const AGENT_TASKS: Record<string, Array<{ title: string; description: string; priority: "high" | "medium" | "low"; offsetHours: number }>> = {
  lead_generation: [
    { title: "Run Outbound Prospecting", description: "Search FMCSA, DAT, LinkedIn for new owner-operators matching criteria", priority: "high", offsetHours: 1 },
    { title: "Score & Qualify New Prospects", description: "Apply weighted scoring algorithm to new prospects", priority: "high", offsetHours: 2 },
    { title: "Auto-respond to New Leads", description: "Send immediate acknowledgment to new prospects", priority: "medium", offsetHours: 3 },
    { title: "Route Qualified Leads", description: "Route qualified leads to appropriate teams", priority: "high", offsetHours: 4 },
    { title: "Weekly Prospecting Report", description: "Generate weekly prospecting performance report", priority: "medium", offsetHours: 24 },
  ],
  sales: [
    { title: "Process Quote Leads", description: "Research companies, build quotes, send proposals", priority: "high", offsetHours: 1 },
    { title: "Follow up on Pending Quotes", description: "Follow up on quotes sent 3+ days ago", priority: "high", offsetHours: 2 },
    { title: "Negotiate Active Deals", description: "Negotiate terms for deals in negotiation", priority: "high", offsetHours: 3 },
    { title: "Update Pipeline Forecast", description: "Update sales pipeline forecast for the week", priority: "medium", offsetHours: 4 },
  ],
  ceo: [
    { title: "Review Premium Leads", description: "Review and approve/reject premium leads (85+ score)", priority: "high", offsetHours: 1 },
    { title: "Strategic Pipeline Review", description: "Review pipeline health, conversion rates, strategic priorities", priority: "high", offsetHours: 2 },
    { title: "Resource Allocation Review", description: "Review resource allocation and SLA timelines", priority: "medium", offsetHours: 3 },
    { title: "Weekly Strategic Review", description: "Comprehensive weekly strategic review", priority: "high", offsetHours: 24 },
  ],
  operations: [
    { title: "Schedule & Dispatch Loads", description: "Optimize routes, assign trucks/drivers, dispatch loads", priority: "high", offsetHours: 1 },
    { title: "Track Active Loads", description: "Monitor active loads, update ETAs, handle exceptions", priority: "high", offsetHours: 2 },
    { title: "Fleet Assignment", description: "Match available trucks + drivers to pending loads", priority: "high", offsetHours: 3 },
    { title: "Route Optimization", description: "Optimize routes for fuel efficiency and timeline", priority: "medium", offsetHours: 4 },
  ],
  hr: [
    { title: "Review Driver Applications", description: "Review and qualify new driver applications", priority: "high", offsetHours: 1 },
    { title: "Background & Compliance Checks", description: "Run background checks, verify MVR, FMCSA compliance", priority: "high", offsetHours: 2 },
    { title: "Schedule Driver Interviews", description: "Schedule screening interviews for qualified candidates", priority: "high", offsetHours: 3 },
    { title: "Onboard New Drivers", description: "Process paperwork, fleet assignment, payroll setup", priority: "high", offsetHours: 4 },
  ],
  finance: [
    { title: "Generate Invoices", description: "Create and send invoices for delivered loads", priority: "high", offsetHours: 1 },
    { title: "Process Driver Payroll", description: "Calculate driver settlements, deductions, process weekly pay", priority: "high", offsetHours: 2 },
    { title: "Process Collections", description: "Track payment status, handle collections, aging reports", priority: "high", offsetHours: 3 },
    { title: "Cost Analysis for Quotes", description: "Calculate fuel, tolls, insurance, driver pay, margin", priority: "high", offsetHours: 4 },
  ],
  customer_success: [
    { title: "Customer Check-ins", description: "Post-delivery satisfaction checks, gather feedback", priority: "high", offsetHours: 1 },
    { title: "Monitor Active Accounts", description: "Monitor active customer accounts for issues", priority: "high", offsetHours: 2 },
    { title: "Retention Outreach", description: "Identify churn risks, propose volume contracts", priority: "medium", offsetHours: 3 },
    { title: "Weekly CS Report", description: "Generate weekly customer success report", priority: "medium", offsetHours: 24 },
  ],
  marketing: [
    { title: "Launch Nurture Campaigns", description: "Send drip emails to warm leads, re-engage prospects", priority: "high", offsetHours: 1 },
    { title: "Monitor Campaign Performance", description: "Track open rates, clicks, re-score leads", priority: "high", offsetHours: 2 },
    { title: "Content Creation", description: "Create content for nurture sequences, social media", priority: "medium", offsetHours: 3 },
    { title: "Weekly Marketing Report", description: "Generate weekly marketing performance report", priority: "medium", offsetHours: 24 },
  ],
};

function getBusinessHours(): { isBusinessHours: boolean; nextBusinessHour: Date } {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekday = day >= 1 && day <= 5;
  const isBusinessHour = hour >= 8 && hour < 18;
  let nextBusinessHour = new Date(now);
  if (!isWeekday || !isBusinessHour) {
    if (!isWeekday) {
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      nextBusinessHour.setDate(now.getDate() + daysUntilMonday);
    } else if (hour < 8) {
      nextBusinessHour.setHours(8, 0, 0, 0);
    } else {
      const daysUntilNext = day === 5 ? 3 : day === 6 ? 2 : 1;
      nextBusinessHour.setDate(now.getDate() + daysUntilNext);
      nextBusinessHour.setHours(8, 0, 0, 0);
    }
  }
  return { isBusinessHours: isWeekday && isBusinessHour, nextBusinessHour };
}

function isBusinessHour(date: Date): boolean {
  const day = date.getDay();
  const hour = date.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

function generateUpcomingTasks(agentId: string) {
  const { isBusinessHours: isBH, nextBusinessHour } = getBusinessHours();
  const baseTime = new Date();
  const agentTasksList = AGENT_TASKS[agentId] || [];
  return agentTasksList.map((task, index) => {
    const scheduledFor = new Date(baseTime.getTime() + task.offsetHours * 60 * 60 * 1000);
    if (!isBusinessHour(scheduledFor)) {
      scheduledFor.setTime(nextBusinessHour.getTime() + index * 60 * 60 * 1000);
    }
    return {
      id: `${agentId}-task-${index}`,
      title: task.title,
      description: task.description,
      scheduledFor: scheduledFor.toISOString(),
      agentId,
      priority: task.priority,
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    if (!AGENT_CONFIG[agentId]) {
      return NextResponse.json({ success: false, error: "Invalid agent ID" }, { status: 400 });
    }
    if (!clientPromise) {
      return NextResponse.json({ success: false, error: "MONGODB_URI not configured" }, { status: 500 });
    }
    const client = await clientPromise;
    const db = client.db();
    const config = AGENT_CONFIG[agentId];
    const searchName = AGENT_NAME_MAP[agentId];
    const nameFilter = { $or: [{ agent: searchName }, { "agent.name": searchName }, { agentId }] };
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Windowed metrics + 30-day history from aggregations over the FULL
    // collection (not the 50-row feed sample), timestamps coalesced so legacy
    // rows that only carry `timestamp` count too.
    const [recentActivity, windowAggRows, dailyAgg] = await Promise.all([
      db.collection("agent_activity").aggregate([
        { $match: nameFilter },
        { $addFields: { _sortTime: { $ifNull: ["$createdAt", "$timestamp"] } } },
        { $sort: { _sortTime: -1 } },
        { $limit: 50 },
      ]).toArray(),
      db.collection("agent_activity").aggregate([
        { $match: nameFilter },
        { $addFields: { _t: { $ifNull: ["$createdAt", "$timestamp"] } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: { $sum: { $cond: [{ $ne: ["$success", false] }, 1, 0] } },
            today: { $sum: { $cond: [{ $gte: ["$_t", todayStart] }, 1, 0] } },
            week: { $sum: { $cond: [{ $gte: ["$_t", weekAgo] }, 1, 0] } },
            month: { $sum: { $cond: [{ $gte: ["$_t", monthAgo] }, 1, 0] } },
            firstActivity: { $min: "$_t" },
            lastActivity: { $max: "$_t" },
          },
        },
      ]).toArray(),
      db.collection("agent_activity").aggregate([
        { $match: nameFilter },
        { $addFields: { _t: { $ifNull: ["$createdAt", "$timestamp"] } } },
        { $match: { _t: { $gte: monthAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$_t", timezone: "America/Chicago" } },
            total: { $sum: 1 },
            successful: { $sum: { $cond: [{ $ne: ["$success", false] }, 1, 0] } },
          },
        },
      ]).toArray(),
    ]);
    const upcomingTasks = generateUpcomingTasks(agentId);
    const { isBusinessHours: isBH, nextBusinessHour } = getBusinessHours();

    const win = windowAggRows[0] || { total: 0, successful: 0, today: 0, week: 0, month: 0, firstActivity: null, lastActivity: null };
    const tasksToday = win.today;
    const tasksThisWeek = win.week;
    const tasksThisMonth = win.month;
    const totalTasks = win.total;
    const successRate = totalTasks > 0 ? (win.successful / totalTasks) * 100 : 0;

    const dailyByDate = new Map<string, { total: number; successful: number }>(
      dailyAgg.map((d: any) => [String(d._id), { total: d.total, successful: d.successful }])
    );
    const performanceHistory = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = date.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      const day = dailyByDate.get(key) || { total: 0, successful: 0 };
      performanceHistory.push({
        date: key,
        tasksCompleted: day.total,
        successRate: day.total > 0 ? (day.successful / day.total) * 100 : 100,
      });
    }
    const currentTask = recentActivity.length > 0 ? recentActivity[0].activity || recentActivity[0].action || "No current task" : "No current task";
    const lastActivity = win.lastActivity || null;
    const nextTaskTime = isBH ? new Date(now.getTime() + 60 * 60 * 1000).toISOString() : nextBusinessHour.toISOString();
    const cfg = AGENT_CONFIG[agentId];
    const response = {
      agentId,
      name: cfg.name,
      role: cfg.role,
      department: cfg.department,
      color: cfg.color,
      reportsTo: cfg.reportsTo,
      metrics: { tasksToday, tasksThisWeek, tasksThisMonth, successRate: Math.round(successRate * 10) / 10, avgTaskDuration: 0, lastActivity, currentTask, nextScheduledTask: nextTaskTime },
      recentActivity: recentActivity.map((a) => ({ id: a._id?.toString() || "", type: a.type || a.action || "activity", description: a.activity || a.action || "Activity performed", details: a.details || {}, timestamp: a._sortTime || a.timestamp || a.createdAt, success: a.success !== false })),
      upcomingTasks: upcomingTasks.slice(0, 10),
      kpis: { tasksCompleted: totalTasks, successRate: Math.round(successRate * 10) / 10, avgDuration: 0, activeSince: win.firstActivity ? new Date(win.firstActivity).toISOString() : new Date().toISOString() },
      performanceHistory,
      upcomingTasksList: upcomingTasks.slice(0, 10),
      businessHours: { isBusinessHours: isBH, nextBusinessHour: nextBusinessHour.toISOString() },
    };
    const finalResponse = {
      ...response,
      id: agentId,
      name: cfg.name,
      role: cfg.role,
      department: cfg.department,
      color: cfg.color,
      reportsTo: cfg.reportsTo,
    };
    return NextResponse.json({ success: true, data: finalResponse });
  } catch (error) {
    console.error("[api/admin/agent-metrics] GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch agent metrics", message: String(error) }, { status: 500 });
  }
}