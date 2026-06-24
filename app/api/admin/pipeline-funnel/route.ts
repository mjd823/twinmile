import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

/**
 * GET /api/admin/pipeline-funnel
 * Returns live pipeline funnel data showing counts at each stage:
 *   Prospects Found → Qualified → Onboarding Invited → Onboarding Started → Documents Submitted → Lease Signed → Dispatch Ready
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

    // Count prospects at each stage
    const [
      totalProspects,
      qualified,
      onboardingInvited,
      onboardingStarted,
      documentsSubmitted,
      leaseSigned,
      dispatchReady,
    ] = await Promise.all([
      db.collection("outbound_prospects").countDocuments(),
      db.collection("outbound_prospects").countDocuments({ status: "qualified" }),
      db.collection("outbound_prospects").countDocuments({ status: "onboarding_invited" }),
      // Onboarding started = prospects who have a session AND have interacted with it
      db.collection("onboarding_sessions").countDocuments({ currentStep: { $gt: 1 } }),
      db.collection("onboarding_sessions").countDocuments({ status: "documents_submitted" }),
      db.collection("lease_agreements").countDocuments({ status: "signed" }),
      db.collection("lease_agreements").countDocuments({ status: "approved" }),
    ]);

    // Get recent prospects for the detail view
    const rawProspects = await db.collection("outbound_prospects")
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const recentProspects = rawProspects.map((p: any) => ({
        id: p._id?.toString(),
        name: p.name,
        dotNumber: p.dotNumber,
        location: p.location,
        state: p.state || p.location?.split(",")?.[1]?.trim(),
        aiScore: p.aiScore,
        status: p.status,
        source: p.source,
        phone: p.contact?.phone,
        email: p.contact?.email,
        equipment: p.equipment,
        powerUnits: p.powerUnits,
        drivers: p.drivers,
        safetyRating: p.safetyRating,
        authorityStatus: p.authorityStatus,
        interestSignals: p.interestSignals,
        sourceUrl: p.sourceUrl,
        createdAt: p.createdAt,
      }));

    // Get onboarding sessions with details
    const rawSessions = await db.collection("onboarding_sessions")
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const onboardingSessions = rawSessions.map((s: any) => ({
        id: s._id?.toString(),
        leadName: s.name,
        leadEmail: s.email,
        leadType: s.leadType,
        status: s.status,
        aiScore: s.metadata?.aiScore,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        completedAt: s.completedAt,
        preFilledData: s.preFilledData,
        onboardingUrl: `/onboarding?token=${s.rawToken}`,
      }));

    // Recent activity feed — include ALL agents, not just Sofia
    const rawActivity = await db.collection("agent_activity")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Map activity to human-friendly format
    const activityFeed = rawActivity.map((a: any) => {
      // Convert code action names to human-friendly labels
      const actionLabels: Record<string, string> = {
        "outreach_processing": "Processing Outreach Tasks",
        "outreach_cron": "Outreach Task Processed",
        "outreach_cron_summary": "Outreach Run Summary",
        "fmcsa_prospecting": "FMCSA Carrier Search",
        "outbound_prospecting": "Prospecting Run",
        "web_prospecting": "Web Search Prospecting",
        "browser_prospecting": "Browser Research",
        "onboarding_invite": "Onboarding Invitation Sent",
        "auto_onboarding_invite": "Onboarding Invitation Sent",
        "daily_ai_ops": "Daily Operations Review",
        "daily_ops": "Operations Review",
        "daily_sales_review": "Sales Strategy Review",
        "daily_ops_check": "Operations Check",
        "hr_onboarding_review": "HR Onboarding Review",
        "onboarding_link_clicked": "Onboarding Link Clicked",
        "daily_finance_review": "Finance Review",
        "customer_success_check": "Customer Success Check",
        "customer_support": "Customer Support",
        "driver_engagement": "Driver Engagement Check",
        "marketing_analysis": "Marketing Analysis",
        "ceo_strategic_review": "CEO Strategic Review",
        "weekly_review": "Weekly Review",
        "weekly_strategic_review": "Strategic Review",
        "monthly_bi": "Monthly Business Intelligence",
        "monthly_report": "Monthly Report",
      };

      // Build human-friendly result summary
      let friendlyResult: any = undefined;
      if (a.result) {
        friendlyResult = a.result;
      } else if (a.details) {
        friendlyResult = a.details;
      } else if (a.activity) {
        friendlyResult = { summary: a.activity };
      }

      // Convert result to human-friendly text if it's raw data
      if (friendlyResult && friendlyResult.tasksProcessed === 0) {
        friendlyResult = { summary: "No tasks to process — system idle" };
      } else if (friendlyResult && friendlyResult.carriersFound !== undefined) {
        friendlyResult = {
          summary: `Found ${friendlyResult.carriersFound} carriers, ${friendlyResult.qualified || 0} qualified, ${friendlyResult.saved || 0} new prospects saved`,
          ...friendlyResult,
        };
      } else if (friendlyResult && friendlyResult.sent !== undefined) {
        friendlyResult = {
          summary: `${friendlyResult.sent} emails sent, ${friendlyResult.failed || 0} failed, ${friendlyResult.skipped || 0} skipped`,
          ...friendlyResult,
        };
      }

      return {
        id: a._id?.toString(),
        action: a.action || a.type || "activity",
        actionLabel: actionLabels[a.action || a.type] || (a.action || a.type || "Activity").replace(/_/g, " "),
        agent: a.agent?.name || (typeof a.agent === "string" ? a.agent : "System"),
        agentRole: a.agent?.role || "Automated",
        result: friendlyResult,
        success: a.success,
        timestamp: a.createdAt || a.timestamp,
      };
    });

    // Get activity counts per agent for the agent overview
    const agentActivityCounts = await db.collection("agent_activity")
      .aggregate([
        { $group: { _id: "$agent.name", count: { $sum: 1 }, lastActivity: { $max: "$createdAt" } } },
      ])
      .toArray();

    const agentStats = agentActivityCounts.map((a: any) => ({
      name: a._id || "System",
      activityCount: a.count,
      lastActivity: a.lastActivity,
      isActive: a.lastActivity && (Date.now() - new Date(a.lastActivity).getTime()) < 24 * 60 * 60 * 1000,
    }));

    return NextResponse.json({
      success: true,
      data: {
        funnel: {
          totalProspects,
          qualified,
          onboardingInvited,
          onboardingStarted,
          documentsSubmitted,
          leaseSigned,
          dispatchReady,
        },
        recentProspects,
        onboardingSessions,
        activityFeed,
        agentStats,
      },
    });
  } catch (error) {
    console.error("[pipeline-funnel] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline data" },
      { status: 500 }
    );
  }
}