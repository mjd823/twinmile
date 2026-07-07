import clientPromise from "@/lib/mongodb";
import { computeJobStatuses, type JobStatusReport } from "@/lib/agent-status";
import { SupervisorDashboard } from "@/components/admin/supervisor-dashboard";
import { SupervisorChat } from "@/components/admin/supervisor-chat";
import { SupervisorReportPanel } from "@/components/admin/supervisor-report";
import { SupervisorTimesheet } from "@/components/admin/supervisor-timesheet";

export const metadata = {
  title: "AI Supervisor Dashboard | Twin Mile Admin",
};

export const dynamic = "force-dynamic";

interface PageData {
  reportResult: Record<string, unknown> | null;
  reportGeneratedAt: string | null;
  reportRunSucceeded: boolean;
  jobStatuses: JobStatusReport | null;
}

/**
 * Server-side data for the supervisor page. Queries Mongo directly (the page
 * runs behind admin auth) — the timesheet reuses lib/agent-status.ts, the same
 * computation the CRON_SECRET-gated /api/admin/agent-status serves to the hub.
 */
async function getPageData(): Promise<PageData> {
  const empty: PageData = {
    reportResult: null,
    reportGeneratedAt: null,
    reportRunSucceeded: true,
    jobStatuses: null,
  };
  if (!clientPromise) return empty;
  try {
    const client = await clientPromise;
    const db = client.db();

    const [reportDocs, jobStatuses] = await Promise.all([
      db
        .collection("agent_activity")
        .find({ action: "supervisor_monitoring" })
        .sort({ createdAt: -1, timestamp: -1 })
        .limit(1)
        .toArray(),
      computeJobStatuses(db),
    ]);

    const doc: any = reportDocs[0];
    const at = doc?.createdAt || doc?.timestamp || null;
    return {
      reportResult:
        doc?.result && typeof doc.result === "object"
          ? (JSON.parse(JSON.stringify(doc.result)) as Record<string, unknown>)
          : null,
      reportGeneratedAt: at ? new Date(at).toISOString() : null,
      reportRunSucceeded: doc ? doc.success !== false : true,
      jobStatuses,
    };
  } catch (error) {
    console.error("[admin/supervisor] page data error:", error);
    return empty;
  }
}

export default async function SupervisorPage() {
  const { reportResult, reportGeneratedAt, reportRunSucceeded, jobStatuses } =
    await getPageData();

  return (
    <main className="mx-auto w-full max-w-7xl px-3 sm:px-5 py-6 space-y-6">
      {/* The daily report is the headline — blunt findings first. */}
      <SupervisorReportPanel
        result={reportResult}
        generatedAt={reportGeneratedAt}
        runSucceeded={reportRunSucceeded}
      />

      {/* Who's clocked in — shared logic with /api/admin/agent-status. */}
      <SupervisorTimesheet report={jobStatuses} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupervisorDashboard />
        <SupervisorChat dataAsOf={jobStatuses?.generatedAt ?? null} />
      </div>
    </main>
  );
}
