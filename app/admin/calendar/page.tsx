import clientPromise from "@/lib/mongodb";
import { CRON_JOBS } from "@/lib/cron-jobs";
import { cronOccurrences } from "@/lib/cron-schedule";
import { computeJobStatuses, type JobStatus } from "@/lib/agent-status";
import {
  CalendarKanbanPage,
  type CalendarEvent,
} from "@/components/calendar/CalendarKanban";

export const dynamic = "force-dynamic";

// Keep ALL history — do NOT filter to the current month. We fetch a generous
// window (last 18 months) plus all converted deals so past events (e.g. on
// the 22nd) remain visible when navigating back through months.
const HISTORY_START = new Date(Date.now() - 18 * 30 * 86400000);

interface RawActivity {
  _id: unknown;
  timestamp?: Date | string;
  createdAt?: Date | string;
  activity?: string;
  action?: string;
  agent?:
    | string
    | { name?: string; role?: string; department?: string }
    | undefined;
  details?: string;
  success?: boolean;
  result?: unknown;
}

interface RawQuote {
  _id: unknown;
  name?: string;
  company?: string;
  createdAt: Date | string;
  serviceType?: string;
  origin?: string;
  destination?: string;
  status?: string;
  convertedAt?: Date | string;
  estimatedValue?: number | string;
  rate?: number | string;
}

interface RawDriver {
  _id: unknown;
  fullName?: string;
  name?: string;
  createdAt: Date | string;
  truckType?: string;
  yearsExperience?: number | string;
  status?: string;
  score?: number;
}

const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
  if (!clientPromise) return [];
  try {
    const client = await clientPromise;
    const db = client.db();

    const events: CalendarEvent[] = [];

    // Recent agent activities (exclude outreach_processing/cron which runs every 15min — too noisy for calendar)
    const activities = await db
      .collection<RawActivity>("agent_activity")
      .find({
        createdAt: { $gte: HISTORY_START },
        action: { $nin: ["outreach_processing", "outreach_cron", "outreach_cron_summary", "outreach_summary", "outreach_seeding", "seed_outreach_tasks"] },
      })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    activities.forEach((a) => {
      const when = a.createdAt ?? a.timestamp;
      if (!when) return;
      const agentName =
        typeof a.agent === "object" && a.agent
          ? a.agent.name
          : typeof a.agent === "string"
            ? a.agent
            : "System";

      // Human-friendly action labels
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
        "supervisor_monitoring": "Supervisor Monitoring Check",
        "find_customers": "Finding New Prospects",
        "check_revenue": "Revenue & Pipeline Check",
        "schedule_deliveries": "Scheduling & Dispatch",
        "hire_drivers": "Driver Recruitment",
        "send_marketing": "Marketing Outreach",
      };

      const rawAction = a.action || "";
      const actionLabel = actionLabels[rawAction] || rawAction.replace(/_/g, " ");

      // Build a descriptive title: "Sofia Rodriguez – FMCSA Carrier Search"
      const title = agentName !== "System"
        ? `${agentName} — ${actionLabel}`
        : `System — ${actionLabel}`;

      // Build human-friendly details
      let detailText = a.activity || a.action || "";
      if (a.result && typeof a.result === "object") {
        const r = a.result as Record<string, unknown>;
        if (r.summary) {
          detailText = String(r.summary);
        } else if (r.carriersFound !== undefined) {
          detailText = `Found ${r.carriersFound} carriers, ${r.qualified || 0} qualified, ${r.saved || 0} saved`;
        } else if (r.sent !== undefined) {
          detailText = `${r.sent} sent, ${r.failed || 0} failed, ${r.skipped || 0} skipped`;
        } else if (r.agentsMonitored !== undefined) {
          detailText = `Monitored ${r.agentsMonitored} agents — ${r.activeAgents || 0} active, ${r.idleAgents || 0} idle`;
        }
      }

      events.push({
        id: `activity-${String(a._id)}`,
        title,
        date: new Date(when),
        type: "agent_action",
        agent: agentName,
        details: detailText,
        color: "bg-primary/80",
        raw: a as unknown as Record<string, unknown>,
      });
    });

    // Pipeline events — fetch full history, not just last 7 days
    const [newQuotes, newDrivers, converted] = await Promise.all([
      db
        .collection<RawQuote>("leads_quotes")
        .find({ createdAt: { $gte: HISTORY_START } })
        .toArray(),
      db
        .collection<RawDriver>("leads_drivers")
        .find({ createdAt: { $gte: HISTORY_START } })
        .toArray(),
      db
        .collection<RawQuote>("leads_quotes")
        .find({
          status: "converted",
          convertedAt: { $gte: HISTORY_START },
        })
        .toArray(),
    ]);

    newQuotes.forEach((q) =>
      events.push({
        id: `quote-${String(q._id)}`,
        title: `📦 New Quote: ${q.name || q.company}`,
        date: new Date(q.createdAt),
        type: "pipeline",
        details: `${q.serviceType ?? ""} - ${q.origin ?? "?"} → ${q.destination ?? "?"}`,
        color: "bg-blue-500/80",
        serviceType: q.serviceType,
        origin: q.origin,
        destination: q.destination,
        raw: q as unknown as Record<string, unknown>,
      }),
    );

    newDrivers.forEach((d) =>
      events.push({
        id: `driver-${String(d._id)}`,
        title: `🚛 New Driver: ${d.fullName || d.name}`,
        date: new Date(d.createdAt),
        type: "onboarding",
        details: `${d.truckType ?? ""} - ${d.yearsExperience ?? "?"} yrs exp`,
        color: "bg-orange-500/80",
        truckType: d.truckType,
        yearsExperience: d.yearsExperience,
        raw: d as unknown as Record<string, unknown>,
      }),
    );

    converted.forEach((c) =>
      events.push({
        id: `converted-${String(c._id)}`,
        title: `✅ Won: ${c.name || c.company}`,
        date: new Date(c.convertedAt || c.createdAt),
        type: "pipeline",
        details: `Converted! $${c.estimatedValue ?? c.rate ?? 0}`,
        color: "bg-green-500/80",
        estimatedValue: c.estimatedValue ?? c.rate,
        raw: c as unknown as Record<string, unknown>,
      }),
    );

    // Real work schedule — one occurrence per job per scheduled day, expanded
    // from the Vercel cron registry (lib/cron-jobs.ts) and colored by each
    // job's LIVE freshness status (same logic as /api/admin/agent-status).
    const now = new Date();
    const statusReport = await computeJobStatuses(db, now);
    const statusById = new Map(statusReport.jobs.map((j) => [j.id, j]));

    const STATUS_COLOR: Record<JobStatus, string> = {
      on_time: "bg-emerald-500/70 text-emerald-50",
      late: "bg-amber-500/80 text-amber-950",
      error: "bg-red-500/80 text-red-50",
      never_ran: "bg-zinc-500/60 text-zinc-100",
    };

    // Window: first day of last month through last day of next month.
    const windowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const windowEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59)
    );

    for (const occ of cronOccurrences(CRON_JOBS, windowStart, windowEnd)) {
      const live = statusById.get(occ.job.id);
      const status: JobStatus = live?.status ?? "never_ran";
      events.push({
        id: `cron-${occ.job.id}-${occ.date.toISOString().slice(0, 10)}`,
        // job.name already identifies the agent ("Sofia — FMCSA Prospecting");
        // don't prefix the agent name again.
        title: occ.job.name,
        date: occ.date,
        type: "cron",
        agent: occ.job.agentName,
        status,
        schedule: occ.job.schedule,
        freqLabel: occ.freqLabel,
        lastRun: live?.lastRun ?? null,
        details:
          `${occ.freqLabel}. ` +
          (live?.lastRun
            ? `Last run ${new Date(live.lastRun).toLocaleString("en-US", {
                timeZone: "America/Chicago",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })} CT (${live.hoursSinceLastRun}h ago).`
            : "Has never logged a run."),
        color: STATUS_COLOR[status],
      });
    }

    return events;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return [];
  }
};

interface RawPipelineLead {
  _id: unknown;
  [k: string]: unknown;
}

const getPipelineData = async () => {
  if (!clientPromise)
    return { quoteLeads: [], driverLeads: [], leaseAgreements: [] };
  try {
    const client = await clientPromise;
    const db = client.db();

    const [quoteLeads, driverLeads, leaseAgreements] = await Promise.all([
      db
        .collection<RawPipelineLead>("leads_quotes")
        .find({})
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection<RawPipelineLead>("leads_drivers")
        .find({})
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection<RawPipelineLead>("lease_agreements")
        .find({})
        .sort({ createdAt: -1 })
        .toArray(),
    ]);

    return { quoteLeads, driverLeads, leaseAgreements };
  } catch {
    return { quoteLeads: [], driverLeads: [], leaseAgreements: [] };
  }
};

// Dates must be serialized for the client component — convert to ISO strings
const serialize = (events: CalendarEvent[]) =>
  events.map((e) => ({
    ...e,
    date: e.date instanceof Date ? e.date.toISOString() : new Date(e.date).toISOString(),
  }));

// Server → client props must be plain objects. Raw Mongo docs carry ObjectId
// (and other BSON) instances that are NOT plain — round-trip through JSON so
// ObjectIds become hex strings and Dates become ISO strings.
const toPlain = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

export default async function CalendarPage() {
  const [events, pipeline] = await Promise.all([
    getCalendarEvents(),
    getPipelineData(),
  ]);

  return (
    <CalendarKanbanPage
      events={toPlain(serialize(events))}
      pipeline={{
        quoteLeads: toPlain(pipeline.quoteLeads) as Record<string, unknown>[],
        driverLeads: toPlain(pipeline.driverLeads) as Record<string, unknown>[],
        leaseAgreements: toPlain(pipeline.leaseAgreements) as Record<string, unknown>[],
      }}
    />
  );
}