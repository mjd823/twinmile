import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

const execAsync = promisify(exec);

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  lastRun: string | null;
  lastStatus: string | null;
  nextRun: string | null;
  enabled: boolean;
  model: string | null;
  provider: string | null;
}

/**
 * GET /api/admin/cron-monitor
 * Returns all Hermes cron jobs with their status, plus recent activity logs.
 * Requires admin auth.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get cron job data from Hermes CLI
    let cronJobs: CronJob[] = [];
    try {
      const { stdout } = await execAsync("hermes cron list --json 2>/dev/null || hermes cron list", {
        timeout: 15000,
        encoding: "utf-8",
      });

      // Parse the CLI output - try JSON first, fall back to text parsing
      try {
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
          cronJobs = parsed;
        }
      } catch {
        // If not JSON, we'll get data from the DB instead
      }
    } catch (err) {
      console.error("[cron-monitor] Error fetching cron list:", err);
    }

    // Also get activity data from MongoDB for richer context
    let activityLogs: any[] = [];
    let emailLogs: any[] = [];

    if (clientPromise) {
      const client = await clientPromise;
      const db = client.db();

      // Recent agent activity (from all cron jobs)
      activityLogs = await db.collection("agent_activity")
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      // Email logs - track emails sent via onboarding invitations
      const rawSessions = await db.collection("onboarding_sessions")
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      emailLogs = rawSessions.map((s: any) => ({
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
    }

    return NextResponse.json({
      success: true,
      data: {
        cronJobs,
        activityLogs: activityLogs.map((a: any) => ({
          id: a._id?.toString(),
          action: a.action,
          agent: a.agent?.name,
          agentRole: a.agent?.role,
          agentDepartment: a.agent?.department,
          result: a.result,
          success: a.success,
          timestamp: a.createdAt,
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