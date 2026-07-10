import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import {
  getPipelineCounts,
  getQuoteStageCounts,
  stageForProspect,
  ENGAGED_SESSION_FILTER,
} from "@/lib/pipeline-stages";
import { paginatedList, parsePage } from "@/lib/paginate";
import {
  RecruitingPipeline,
  type PipelineTab,
  type ProspectRow,
  type EngagedRow,
  type ActivityRow,
} from "@/components/admin/RecruitingPipeline";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recruiting Pipeline - Twin Mile Admin",
  robots: { index: false, follow: false },
};

/**
 * Recruiting Pipeline — the ONE pipeline page.
 * /admin/pipeline, /admin/inbox and /admin/dashboard/recruiting redirect here.
 *
 * Every count comes from lib/pipeline-stages.getPipelineCounts (full
 * collections), every list is paginated newest-first with its REAL total.
 */

const ACTION_LABELS: Record<string, string> = {
  outreach_processing: "Processing Outreach Tasks",
  outreach_cron: "Outreach Task Processed",
  outreach_cron_summary: "Outreach Run Summary",
  outreach_summary: "Outreach Summary",
  outreach_requeue: "Outreach Requeued",
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
  prospect_reply_received: "Prospect Reply Received",
  prospect_reply_sent: "Prospect Reply Answered",
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

function isoDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function locationString(loc: unknown): string {
  if (typeof loc === "string") return loc;
  if (loc && typeof loc === "object") {
    const o = loc as { city?: string; state?: string };
    return [o.city, o.state].filter(Boolean).join(", ");
  }
  return "";
}

function parseTab(value: unknown): PipelineTab {
  const v = String(value ?? "prospects");
  return v === "manual" || v === "engaged" || v === "activity" ? v : "prospects";
}

export default async function RecruitingPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const user = await requireRole("admin");
  if (!user) return null;

  const params = await searchParams;
  const tab = parseTab(params.tab);
  const page = parsePage(params.page);

  try {
    if (!clientPromise) throw new Error("Database not configured");
    const client = await clientPromise;
    const db = client.db();

    const [counts, quotes, prospectsPage, activityTotal, engagedRaw, quoteLeads, driverLeads] =
      await Promise.all([
        getPipelineCounts(db),
        getQuoteStageCounts(db),
        // Prospects: newest first (safe post 2026-07 date-normalization
        // migration), REAL total, 50/page.
        paginatedList(db.collection("outbound_prospects"), {}, {
          page: tab === "prospects" ? page : 1,
          sort: { createdAt: -1, _id: -1 },
        }),
        db.collection("agent_activity").countDocuments({
          action: { $nin: ["outreach_processing", "outreach_cron", "outreach_cron_summary"] },
        }),
        db
          .collection("onboarding_sessions")
          .find(ENGAGED_SESSION_FILTER as never)
          .sort({ firstClickedAt: -1, createdAt: -1 })
          .toArray(),
        db.collection("leads_quotes").find({ isArchived: { $ne: true } }).sort({ createdAt: -1 }).toArray(),
        db.collection("leads_drivers").find({ isArchived: { $ne: true } }).sort({ createdAt: -1 }).toArray(),
      ]);

    // Activity: paginated over the FULL collection, sorted by whichever
    // timestamp field the row actually has (legacy rows use `timestamp`).
    const activityPage = tab === "activity" ? page : 1;
    const activityPageSize = 50;
    const activityPageCount = Math.max(1, Math.ceil(activityTotal / activityPageSize));
    const boundedActivityPage = Math.min(activityPage, activityPageCount);
    const rawActivity = await db
      .collection("agent_activity")
      .aggregate([
        { $match: { action: { $nin: ["outreach_processing", "outreach_cron", "outreach_cron_summary"] } } },
        { $addFields: { _sortTime: { $ifNull: ["$createdAt", "$timestamp"] } } },
        { $sort: { _sortTime: -1 } },
        { $skip: (boundedActivityPage - 1) * activityPageSize },
        { $limit: activityPageSize },
      ])
      .toArray();

    const prospectRows: ProspectRow[] = prospectsPage.rows.map((p: any) => {
      const badge = stageForProspect(p);
      return {
        id: p._id?.toString() || "",
        name: p.name || p.companyName || "Unknown Prospect",
        dotNumber: String(p.dotNumber || p.dot_number || ""),
        location: locationString(p.location),
        aiScore: p.aiScore || 0,
        status: p.status || "new",
        stage: { key: badge.key, label: badge.label, hex: badge.hex },
        source: p.source || "FMCSA",
        phone: p.contact?.phone || p.phone || "",
        email: p.contact?.email || p.email || "",
        equipment: p.equipment || "",
        powerUnits: p.powerUnits || 0,
        drivers: p.drivers || 0,
        safetyRating: p.safetyRating || "",
        authorityStatus: p.authorityStatus || "",
        interestSignals: Array.isArray(p.interestSignals) ? p.interestSignals : [],
        sourceUrl: p.sourceUrl || "",
        createdAt: isoDate(p.createdAt),
        invitedAt: isoDate(p.onboardingInvitedAt),
      };
    });

    const engaged: EngagedRow[] = engagedRaw.map((s: any) => ({
      id: s._id?.toString() || "",
      leadName: s.name || s.leadName || "Unknown lead",
      leadEmail: s.email || "",
      status: s.status || "pending",
      currentStep: s.currentStep || 1,
      firstClickedAt: isoDate(s.firstClickedAt),
      createdAt: isoDate(s.createdAt),
      onboardingUrl: s.rawToken ? `/onboarding?token=${s.rawToken}` : "",
    }));

    const activityRows: ActivityRow[] = rawActivity.map((a: any) => {
      const rawAction = a.action || a.type || "activity";
      const result = a.result || a.details || null;
      const summary =
        (result && typeof result === "object" && "summary" in result && String((result as any).summary)) ||
        a.activity ||
        "";
      return {
        id: a._id?.toString() || "",
        action: rawAction,
        actionLabel: ACTION_LABELS[rawAction] || String(rawAction).replace(/_/g, " "),
        agent: typeof a.agent === "string" ? a.agent : a.agent?.name || "System",
        agentRole: (typeof a.agent === "object" && a.agent?.role) || "Automated",
        summary,
        details: result ? JSON.parse(JSON.stringify(result)) : null,
        success: a.success !== false,
        timestamp: isoDate(a.createdAt || a.timestamp),
      };
    });

    const manualQuoteLeads = quoteLeads.map((l: any) => ({
      id: String(l._id),
      name: String(l.name ?? ""),
      company: String(l.company ?? ""),
      email: String(l.email ?? ""),
      phone: String(l.phone ?? ""),
      pickupLocation: String(l.pickupLocation ?? ""),
      dropoffLocation: String(l.dropoffLocation ?? ""),
      serviceType: String(l.serviceType ?? ""),
      pickupDate: String(l.pickupDate ?? ""),
      notes: String(l.notes ?? ""),
      status: (l.status ?? "new") as never,
      createdAt: isoDate(l.createdAt),
    }));

    const manualDriverLeads = driverLeads.map((l: any) => ({
      id: String(l._id),
      fullName: String(l.fullName ?? ""),
      email: String(l.email ?? ""),
      phone: String(l.phone ?? ""),
      truckType: String(l.truckType ?? ""),
      yearsExperience: String(l.yearsExperience ?? ""),
      preferredRoutes: String(l.preferredRoutes ?? ""),
      startDate: String(l.startDate ?? ""),
      notes: String(l.notes ?? ""),
      status: (l.status ?? "new") as never,
      createdAt: isoDate(l.createdAt),
    }));

    return (
      <main className="min-h-screen bg-background">
        <RecruitingPipeline
          counts={JSON.parse(JSON.stringify(counts))}
          quotes={quotes}
          tab={tab}
          prospects={{
            rows: prospectRows,
            total: prospectsPage.total,
            page: prospectsPage.page,
            pageCount: prospectsPage.pageCount,
            pageSize: prospectsPage.pageSize,
          }}
          engaged={engaged}
          activity={{
            rows: activityRows,
            total: activityTotal,
            page: boundedActivityPage,
            pageCount: activityPageCount,
            pageSize: activityPageSize,
          }}
          manualQuoteLeads={manualQuoteLeads}
          manualDriverLeads={manualDriverLeads}
        />
      </main>
    );
  } catch (error) {
    console.error("[recruiting-pipeline] Failed to load data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-2xl px-5 py-12">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
            <h2 className="text-lg font-semibold text-red-400">Recruiting Pipeline unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The database connection dropped — refresh to try again. The rest of the admin keeps working.
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground/70">{message.substring(0, 200)}</p>
          </div>
        </div>
      </main>
    );
  }
}
