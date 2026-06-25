import clientPromise from "@/lib/mongodb";

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

function serializeDate(value: any): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function getAgentName(agent: any): string {
  if (typeof agent === "string") return agent;
  return agent?.name || "System";
}

function getAgentRole(agent: any): string {
  if (typeof agent === "object" && agent?.role) return agent.role;
  return "Automated";
}

function summarizeResult(activity: any): any {
  let result = activity.result || activity.details || (activity.activity ? { summary: activity.activity } : undefined);
  if (!result || typeof result !== "object") return result;

  if (result.tasksProcessed === 0) {
    return { summary: "No outreach tasks were due — system checked queue and stayed idle", ...result };
  }
  if (result.carriersFound !== undefined) {
    return {
      summary: `Found ${result.carriersFound} carriers, ${result.qualified || 0} qualified, ${result.saved || 0} saved to the pipeline`,
      workflowStage: "Prospecting → Qualification",
      nextStep: (result.saved || 0) > 0 ? "Score saved carriers and create outreach tasks for qualified prospects" : "Continue prospecting with broader search criteria",
      ...result,
    };
  }
  if (result.sent !== undefined) {
    return {
      summary: `${result.sent} emails sent, ${result.failed || 0} failed, ${result.skipped || 0} skipped`,
      workflowStage: "Qualified Prospect → Outreach",
      nextStep: "Wait for link clicks; move engaged prospects into onboarding",
      ...result,
    };
  }
  if (result.agentsMonitored !== undefined) {
    return {
      summary: `Monitored ${result.agentsMonitored} agents — ${result.activeAgents || 0} active, ${result.idleAgents || 0} idle, ${result.errorsFound || 0} errors`,
      workflowStage: "Supervisor Monitoring",
      nextStep: result.errorsFound > 0 ? "Investigate failing jobs and assign fixes" : "Continue monitoring growth and agent productivity",
      ...result,
    };
  }
  if (result.summary) return result;
  return result;
}

export async function getPipelineFunnelData() {
  if (!clientPromise) throw new Error("Database not configured");

  const client = await clientPromise;
  const db = client.db();

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
    db.collection("outbound_prospects").countDocuments({
      aiScore: { $gte: 75 },
      status: { $in: ["reviewed", "onboarding_invited"] },
    }),
    db.collection("outbound_prospects").countDocuments({ status: "onboarding_invited" }),
    db.collection("onboarding_sessions").countDocuments({
      $or: [{ currentStep: { $gt: 1 } }, { firstClickedAt: { $exists: true } }, { status: { $in: ["started", "documents_submitted", "completed"] } }],
    }),
    db.collection("onboarding_sessions").countDocuments({ status: "documents_submitted" }),
    db.collection("lease_agreements").countDocuments({ status: "signed" }),
    db.collection("lease_agreements").countDocuments({ status: "approved" }),
  ]);

  const [rawProspects, rawSessions, rawActivity, agentActivityCounts] = await Promise.all([
    db.collection("outbound_prospects").find({}).sort({ createdAt: -1 }).limit(300).toArray(),
    db.collection("onboarding_sessions").find({}).sort({ createdAt: -1 }).limit(50).toArray(),
    db
      .collection("agent_activity")
      .find({ action: { $nin: ["outreach_processing", "outreach_cron", "outreach_cron_summary"] } })
      .sort({ createdAt: -1, timestamp: -1 })
      .limit(100)
      .toArray(),
    db
      .collection("agent_activity")
      .aggregate([
        {
          $group: {
            _id: { $ifNull: ["$agent.name", { $ifNull: ["$agent", "System"] }] },
            count: { $sum: 1 },
            lastActivity: { $max: { $ifNull: ["$createdAt", "$timestamp"] } },
          },
        },
      ])
      .toArray(),
  ]);

  const recentProspects = rawProspects.map((p: any) => ({
    id: p._id?.toString(),
    name: p.name || p.companyName || "Unknown Prospect",
    dotNumber: p.dotNumber || p.dot || "",
    location: p.location || "",
    state: p.state || p.location?.split(",")?.[1]?.trim() || "",
    score: p.aiScore || p.score || 0,
    aiScore: p.aiScore || p.score || 0,
    status: p.status || "new",
    source: p.source || "FMCSA",
    phone: p.contact?.phone || p.phone || "",
    email: p.contact?.email || p.email || "",
    equipment: p.equipment || "",
    powerUnits: p.powerUnits || 0,
    drivers: p.drivers || 0,
    safetyRating: p.safetyRating || "",
    authorityStatus: p.authorityStatus || "",
    interestSignals: p.interestSignals || [],
    sourceUrl: p.sourceUrl || "",
    createdAt: serializeDate(p.createdAt),
  }));

  const onboardingSessions = rawSessions.map((s: any) => ({
    id: s._id?.toString(),
    leadName: s.name || s.leadName || "Unknown Lead",
    leadEmail: s.email || "",
    leadType: s.leadType || "outbound_prospect",
    status: s.status || "pending",
    aiScore: s.metadata?.aiScore || s.aiScore || 0,
    createdAt: serializeDate(s.createdAt),
    expiresAt: serializeDate(s.expiresAt),
    completedAt: serializeDate(s.completedAt),
    preFilledData: s.preFilledData || {},
    onboardingUrl: s.rawToken ? `/onboarding?token=${s.rawToken}` : "",
  }));

  const activityFeed = rawActivity.map((a: any) => {
    const rawAction = a.action || a.type || "activity";
    const result = summarizeResult(a);
    return {
      id: a._id?.toString(),
      action: rawAction,
      actionLabel: ACTION_LABELS[rawAction] || rawAction.replace(/_/g, " "),
      agent: getAgentName(a.agent),
      agentRole: getAgentRole(a.agent),
      result,
      success: a.success !== false,
      timestamp: serializeDate(a.createdAt || a.timestamp),
    };
  });

  const agentStats = agentActivityCounts.map((a: any) => ({
    name: a._id || "System",
    activityCount: a.count || 0,
    lastActivity: serializeDate(a.lastActivity),
    isActive: a.lastActivity && Date.now() - new Date(a.lastActivity).getTime() < 24 * 60 * 60 * 1000,
  }));

  return {
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
    workflowHealth: {
      outreachQueue: "System automation sends queued emails every 15 minutes; this is not Sofia. Sofia creates/scoring prospects upstream.",
      currentBottleneck:
        onboardingInvited > onboardingStarted
          ? "Prospects have been emailed but have not clicked/started onboarding yet"
          : qualified > onboardingInvited
            ? "Qualified prospects need onboarding invitations"
            : "Keep prospecting and scoring owner-operators",
      nextBestActions: [
        qualified > onboardingInvited ? "Invite more qualified prospects to onboarding" : "Monitor email clicks and replies",
        onboardingInvited > onboardingStarted ? "Have Emily/Marcus follow up with invited prospects who have not clicked" : "Continue daily prospecting",
        "Supervisor should compare daily prospect growth, invite rate, click rate, and onboarding completion rate",
      ],
    },
  };
}

export type PipelineFunnelData = Awaited<ReturnType<typeof getPipelineFunnelData>>;
