import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";
import { CRON_JOBS, chicagoWeekday } from "@/lib/cron-jobs";

// ── Human-friendly action labels ───────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  outreach_processing: "Processing Outreach Tasks",
  outreach_cron: "Outreach Task Processed",
  outreach_cron_summary: "Outreach Run Summary",
  outreach_summary: "Outreach Summary",
  fmcsa_prospecting: "FMCSA Carrier Search",
  outbound_prospecting: "Prospecting Run",
  web_prospecting: "Web Search Prospecting",
  browser_prospecting: "Browser Research",
  onboarding_invite: "Onboarding Invitation Sent",
  auto_onboarding_invite: "Onboarding Invitation Sent",
  daily_ai_ops: "Daily Operations Review",
  daily_ops: "Operations Review",
  daily_sales_review: "Sales Strategy Review",
  daily_ops_check: "Operations Check",
  hr_onboarding_review: "HR Onboarding Review",
  onboarding_link_clicked: "Onboarding Link Clicked",
  daily_finance_review: "Finance Review",
  customer_success_check: "Customer Success Check",
  customer_support: "Customer Support",
  driver_engagement: "Driver Engagement Check",
  marketing_analysis: "Marketing Analysis",
  ceo_strategic_review: "CEO Strategic Review",
  weekly_review: "Weekly Review",
  weekly_strategic_review: "Strategic Review",
  monthly_bi: "Monthly Business Intelligence",
  monthly_report: "Monthly Report",
  supervisor_monitoring: "Supervisor Monitoring Check",
  proactive_trucking_forum_research: "Trucking Forum Research",
  proactive_fuel_cost_analysis: "Fuel Cost Analysis",
  proactive_seo_analysis: "SEO Analysis",
  proactive_strategic_research: "Strategic Research",
  proactive_compliance_research: "Compliance Research",
};

// ── Agent shift definitions (mirrors cron schedules) ─────────────────────────
// Each entry describes the "work block" for an agent based on their cron job.
// hoursPerDay is the estimated shift length. expectedTasksPerDay is the number
// of activities we'd expect to see on a typical day for productivity scoring.

interface ShiftDef {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  reportsTo?: string;
  shiftStartHour: number; // 0-23 (local server time)
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  daysOfWeek: number[] | "ALL"; // 0=Sun … 6=Sat
  hoursPerDay: number;
  expectedTasksPerDay: number;
  taskLabel: string; // human label for the scheduled task
}

const SHIFTS: ShiftDef[] = [
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
    hoursPerDay: 9,
    expectedTasksPerDay: 12,
    taskLabel: "Prospecting & lead outreach",
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
    hoursPerDay: 8,
    expectedTasksPerDay: 10,
    taskLabel: "Sales pipeline review & follow-ups",
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
    hoursPerDay: 7.5,
    expectedTasksPerDay: 14,
    taskLabel: "Driver engagement (AM) & customer success (PM)",
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
    hoursPerDay: 8,
    expectedTasksPerDay: 8,
    taskLabel: "Operations check & dispatch review",
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
    hoursPerDay: 6,
    expectedTasksPerDay: 6,
    taskLabel: "HR review & driver relations",
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
    hoursPerDay: 5,
    expectedTasksPerDay: 5,
    taskLabel: "Finance review & invoicing",
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
    daysOfWeek: [1], // Monday
    hoursPerDay: 5,
    expectedTasksPerDay: 4,
    taskLabel: "Weekly marketing analysis",
  },
  {
    id: "ceo",
    name: "Alexandra Sterling",
    role: "Chief Executive Officer",
    department: "Executive",
    color: "purple",
    shiftStartHour: 6,
    shiftStartMinute: 0,
    shiftEndHour: 11,
    shiftEndMinute: 0,
    daysOfWeek: [1], // Monday
    hoursPerDay: 5,
    expectedTasksPerDay: 3,
    taskLabel: "CEO strategic review",
  },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * A "task" on this timesheet = one scheduled cron run the agent owes for the
 * day, taken straight from the real Vercel cron registry (lib/cron-jobs.ts).
 * Daily jobs are due every day; weekly jobs only on Mondays (America/Chicago).
 * Productivity = scheduled runs completed ÷ scheduled runs due — the same
 * numbers the row displays, so "2 of 3 = 33%" style mismatches can't happen.
 */
function scheduledJobsFor(agentName: string, isMondayCT: boolean) {
  return CRON_JOBS.filter(
    (j) =>
      j.agentName === agentName &&
      (j.cadence !== "weekly" || isMondayCT)
  );
}

function activityTime(a: any): Date {
  return new Date(a.createdAt || a.timestamp || 0);
}

function ctDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function summarizeActivity(a: any): { label: string; description: string; result: any; rawAction: string } {
  const rawAction = a.action || a.activity || a.type || "activity";
  const label = ACTION_LABELS[rawAction] || rawAction.replace(/_/g, " ");
  const r = a.result || a.details || null;
  let description = a.activity || "Activity performed";

  if (r && typeof r === "object") {
    if (r.summary) description = String(r.summary);
    else if (r.carriersFound !== undefined) description = `Found ${r.carriersFound} carriers, ${r.qualified || 0} qualified, ${r.saved || 0} saved`;
    else if (r.sent !== undefined) description = `${r.sent} emails sent, ${r.failed || 0} failed, ${r.skipped || 0} skipped`;
    else if (r.agentsMonitored !== undefined) description = `Monitored ${r.agentsMonitored} agents — ${r.activeAgents || 0} active, ${r.idleAgents || 0} idle`;
    else description = label;
  } else if (!description || description === rawAction) {
    description = label;
  }

  return { label, description, result: r, rawAction };
}

function formatHourLabel(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}:00 ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function isOnShift(shift: ShiftDef, now: Date): { onClock: boolean; status: "on_clock" | "off_duty" | "on_break" } {
  // Use America/Chicago timezone for shift calculations (company HQ is Houston, TX)
  const ctTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const day = ctTime.getDay();
  const worksToday =
    shift.daysOfWeek === "ALL" ? true : shift.daysOfWeek.includes(day);
  if (!worksToday) return { onClock: false, status: "off_duty" };

  const nowMin = ctTime.getHours() * 60 + ctTime.getMinutes();
  const startMin = shift.shiftStartHour * 60 + shift.shiftStartMinute;
  const endMin = shift.shiftEndHour * 60 + shift.shiftEndMinute;

  if (nowMin >= startMin && nowMin <= endMin) {
    // Consider a 15-min break window around the midpoint — purely cosmetic.
    const midMin = Math.round((startMin + endMin) / 2);
    if (Math.abs(nowMin - midMin) <= 7) {
      return { onClock: true, status: "on_break" };
    }
    return { onClock: true, status: "on_clock" };
  }
  return { onClock: false, status: "off_duty" };
}

// ── API handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!clientPromise) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Parse week offset parameter (0 = current, -1 = last week, etc.)
    const { searchParams } = new URL(req.url);
    const weekOffset = parseInt(searchParams.get("week") || "0", 10);

    const client = await clientPromise;
    const db = client.db();

    const now = new Date();
    // Use America/Chicago business day/week for timesheet windows.
    const ctNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
    ctNow.setDate(ctNow.getDate() + weekOffset * 7);
    const todayStart = new Date(ctNow);
    todayStart.setHours(0, 0, 0, 0);

    // Start of the current CT week (Sunday 00:00)
    const weekStart = new Date(ctNow);
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    // Pull recent activity (last 500 docs, newest first) — same pattern as
    // /api/admin/agents so the shapes line up even if field names vary.
    const allActivityRaw: any[] = await db
      .collection("agent_activity")
      .find({})
      .sort({ createdAt: -1, timestamp: -1 })
      .limit(800)
      .toArray();

    // Normalize order after fetch because legacy rows may use timestamp while newer rows use createdAt.
    allActivityRaw.sort((a, b) => activityTime(b).getTime() - activityTime(a).getTime());

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

    const employees = SHIFTS.map((shift) => {
      const activity = activityByName[shift.name] || [];

      const todayKey = ctDateKey(ctNow);
      const weekStartMs = weekStart.getTime();

      const todayActivity = activity.filter((a) => ctDateKey(activityTime(a)) === todayKey);

      const weekActivity = activity.filter((a) => {
        const ts = new Date(activityTime(a).toLocaleString("en-US", { timeZone: "America/Chicago" }));
        return ts.getTime() >= weekStartMs;
      });

      // Count distinct days with activity this week for hours-this-week calc
      const daySet = new Set<string>();
      for (const a of weekActivity) {
        daySet.add(ctDateKey(activityTime(a)));
      }
      const daysWorkedThisWeek = daySet.size;
      const hoursThisWeek = Math.round(daysWorkedThisWeek * shift.hoursPerDay * 10) / 10;

      const tasksToday = todayActivity.length;
      const tasksThisWeek = weekActivity.length;

      const lastActivityDoc = activity[0];
      const lastActivityTime: string | null =
        lastActivityDoc?.timestamp || lastActivityDoc?.createdAt || null;

      const successful = activity.filter((a) => a.success !== false).length;
      const total = activity.length;
      const successRate = total > 0 ? Math.round((successful / total) * 1000) / 10 : 0;

      // Productivity: scheduled cron runs completed today ÷ scheduled runs due
      // today (from the real cron registry). One daily review = 1 due / 1 done
      // = 100% — it does NOT pretend to be an all-day workload.
      const isMondayCT = chicagoWeekday(now) === "Monday";
      const distinctToday = new Set(todayActivity.map((a) => a.action).filter(Boolean));
      const dueJobs = scheduledJobsFor(shift.name, isMondayCT);
      const scheduledExpected = dueJobs.length;
      const scheduledDone = dueJobs.filter((job) =>
        job.actions.some((action) => distinctToday.has(action))
      ).length;
      const productivityScore =
        scheduledExpected > 0
          ? Math.min(Math.round((scheduledDone / scheduledExpected) * 100), 100)
          : tasksToday > 0
            ? 100
            : 0;

      const { onClock, status } = isOnShift(shift, now);

      // Today's task breakdown (limit 10, newest first) with rich detail
      const todaysTasks = todayActivity.slice(0, 10).map((a) => {
        const rawAction = a.action || a.activity || a.type || "activity";
        const label = ACTION_LABELS[rawAction] || rawAction.replace(/_/g, " ");
        const r = a.result || a.details;
        let description = "Task performed";
        let detailLines: string[] = [];

        if (r && typeof r === "object") {
          if (r.carriersFound !== undefined) {
            description = `Found ${r.carriersFound} carriers, ${r.qualified || 0} qualified, ${r.saved || 0} saved to pipeline`;
            if (r.source) detailLines.push(`Source: ${r.source}`);
            if (r.targetStates) detailLines.push(`Target states: ${r.targetStates.join(", ")}`);
            if (r.searchQueries) detailLines.push(`Search queries: ${r.searchQueries.length} queries used`);
            if (r.pagesVisited) detailLines.push(`Pages visited: ${r.pagesVisited.join(", ").substring(0, 200)}`);
            if (r.dataSource) detailLines.push(`Data source: ${r.dataSource}`);
          } else if (r.sent !== undefined) {
            description = `${r.sent} emails sent, ${r.failed || 0} failed, ${r.skipped || 0} skipped`;
            if (r.template) detailLines.push(`Template: ${r.template}`);
          } else if (r.agentsMonitored !== undefined) {
            description = `Monitored ${r.agentsMonitored} agents — ${r.activeAgents || 0} active, ${r.idleAgents || 0} idle`;
            if (r.bottleneck) detailLines.push(`Bottleneck: ${r.bottleneck}`);
          } else if (r.summary) {
            description = String(r.summary);
          } else if (a.activity) {
            description = a.activity;
          }
        }

        return {
          id: a._id?.toString() || "",
          action: rawAction,
          label,
          description,
          detailLines,
          result: r,
          success: a.success !== false,
          timestamp: a.timestamp || a.createdAt || null,
        };
      });

      // Recent activity log — last 5, human-friendly
      const recentActivity = activity.slice(0, 5).map((a) => {
        const rawAction = a.action || a.activity || a.type || "activity";
        const label = ACTION_LABELS[rawAction] || rawAction.replace(/_/g, " ");
        let description = a.activity || a.action || a.details || "Activity performed";
        const r = a.result || a.details;
        if (r && typeof r === "object") {
          if (r.summary) {
            description = String(r.summary);
          } else if (r.carriersFound !== undefined) {
            description = `Found ${r.carriersFound} carriers, ${r.qualified || 0} qualified, ${r.saved || 0} saved`;
          } else if (r.sent !== undefined) {
            description = `${r.sent} emails sent, ${r.failed || 0} failed`;
          } else if (r.agentsMonitored !== undefined) {
            description = `Monitored ${r.agentsMonitored} agents — ${r.activeAgents || 0} active, ${r.idleAgents || 0} idle`;
          }
        }
        return {
          id: a._id?.toString() || "",
          action: rawAction,
          label,
          description,
          result: r,
          success: a.success !== false,
          timestamp: a.timestamp || a.createdAt || null,
        };
      });

      // Weekly schedule description
      const scheduleDays =
        shift.daysOfWeek === "ALL"
          ? "Mon–Sun"
          : shift.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ");

      const weeklySchedule = {
        days: scheduleDays,
        shiftStart: formatHourLabel(shift.shiftStartHour, shift.shiftStartMinute),
        shiftEnd: formatHourLabel(shift.shiftEndHour, shift.shiftEndMinute),
        hoursPerDay: shift.hoursPerDay,
        taskLabel: shift.taskLabel,
      };

      // Performance metrics
      const avgTasksPerDay =
        daysWorkedThisWeek > 0
          ? Math.round((tasksThisWeek / daysWorkedThisWeek) * 10) / 10
          : 0;

      // Simple trend: compare tasks today vs avg tasks per day this week
      let trend: "up" | "down" | "steady" = "steady";
      if (avgTasksPerDay > 0) {
        if (tasksToday > avgTasksPerDay * 1.1) trend = "up";
        else if (tasksToday < avgTasksPerDay * 0.9) trend = "down";
      } else if (tasksToday > 0) {
        trend = "up";
      }

      return {
        id: shift.id,
        name: shift.name,
        role: shift.role,
        department: shift.department,
        color: shift.color,
        reportsTo: shift.reportsTo || null,
        status,
        onClock,
        shiftStart: formatHourLabel(shift.shiftStartHour, shift.shiftStartMinute),
        shiftEnd: formatHourLabel(shift.shiftEndHour, shift.shiftEndMinute),
        shiftStart24: `${String(shift.shiftStartHour).padStart(2, "0")}:${String(shift.shiftStartMinute).padStart(2, "0")}`,
        shiftEnd24: `${String(shift.shiftEndHour).padStart(2, "0")}:${String(shift.shiftEndMinute).padStart(2, "0")}`,
        hoursToday: onClock ? shift.hoursPerDay : 0,
        hoursThisWeek,
        tasksToday,
        tasksThisWeek,
        scheduledDone,
        scheduledExpected,
        expectedTasksPerDay: scheduledExpected,
        productivityScore,
        successRate,
        lastActivityTime,
        taskLabel: shift.taskLabel,
        todaysTasks,
        recentActivity,
        weeklySchedule,
        performance: {
          successRate,
          avgTasksPerDay,
          totalTasks: total,
          trend,
        },
      };
    });

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalEmployees = employees.length;
    const currentlyOnClock = employees.filter((e) => e.onClock).length;
    const totalTasksToday = employees.reduce((s, e) => s + e.tasksToday, 0);
    const avgProductivity =
      totalEmployees > 0
        ? Math.round(
            (employees.reduce((s, e) => s + e.productivityScore, 0) / totalEmployees) * 10,
          ) / 10
        : 0;

    // Pay period = start of current week
    const payPeriodStart = weekStart.toISOString().slice(0, 10);
    const payPeriodEnd = new Date(weekStart.getTime() + 6 * 86400000)
      .toISOString()
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        employees,
        summary: {
          totalEmployees,
          currentlyOnClock,
          totalTasksToday,
          avgProductivity,
          payPeriodStart,
          payPeriodEnd,
          serverTime: now.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[api/admin/timesheet] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timesheet data", message: String(error) },
      { status: 500 },
    );
  }
}