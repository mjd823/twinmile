import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

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

    // Start of the current week (Sunday 00:00)
    const weekStart = new Date(now);
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    // Pull recent activity (last 500 docs, newest first) — same pattern as
    // /api/admin/agents so the shapes line up even if field names vary.
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

    const employees = SHIFTS.map((shift) => {
      const activity = activityByName[shift.name] || [];

      const todayActivity = activity.filter((a) => {
        const ts = new Date(a.timestamp || a.createdAt || now);
        return ts >= todayStart;
      });

      const weekActivity = activity.filter((a) => {
        const ts = new Date(a.timestamp || a.createdAt || now);
        return ts >= weekStart;
      });

      // Count distinct days with activity this week for hours-this-week calc
      const daySet = new Set<string>();
      for (const a of weekActivity) {
        const ts = new Date(a.timestamp || a.createdAt || now);
        daySet.add(ts.toDateString());
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

      // Productivity score: tasks today vs expected, capped at 100
      const productivityScore =
        shift.expectedTasksPerDay > 0
          ? Math.min(Math.round((tasksToday / shift.expectedTasksPerDay) * 100), 100)
          : 0;

      const { onClock, status } = isOnShift(shift, now);

      // Today's task breakdown (limit 10, newest first)
      const todaysTasks = todayActivity.slice(0, 10).map((a) => ({
        id: a._id?.toString() || "",
        action: a.action || a.activity || a.type || "activity",
        description: a.activity || a.action || a.details || "Task performed",
        result: a.result || a.details || null,
        success: a.success !== false,
        timestamp: a.timestamp || a.createdAt || null,
      }));

      // Recent activity log (last 5 across all time)
      const recentActivity = activity.slice(0, 5).map((a) => ({
        id: a._id?.toString() || "",
        action: a.action || a.activity || a.type || "activity",
        description: a.activity || a.action || a.details || "Activity performed",
        result: a.result || a.details || null,
        success: a.success !== false,
        timestamp: a.timestamp || a.createdAt || null,
      }));

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
        expectedTasksPerDay: shift.expectedTasksPerDay,
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