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
      db.collection("onboarding_sessions").countDocuments({ status: "pending" }),
      db.collection("onboarding_sessions").countDocuments({ status: "documents_submitted" }),
      db.collection("lease_agreements").countDocuments({ status: "signed" }),
      db.collection("lease_agreements").countDocuments({ status: "approved" }),
    ]);

    // Get recent prospects for the detail view
    const rawProspects = await db.collection("outbound_prospects")
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
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

    // Recent activity feed
    const rawActivity = await db.collection("agent_activity")
      .find({})
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    const activityFeed = rawActivity.map((a: any) => ({
      id: a._id?.toString(),
      action: a.action,
      agent: a.agent?.name,
      agentRole: a.agent?.role,
      result: a.result,
      success: a.success,
      timestamp: a.createdAt,
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