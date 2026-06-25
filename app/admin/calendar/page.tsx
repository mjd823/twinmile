import clientPromise from "@/lib/mongodb";
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

    // Recent agent activities (full history window)
    const activities = await db
      .collection<RawActivity>("agent_activity")
      .find({ createdAt: { $gte: HISTORY_START } })
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

    // Nighttime prep events — each agent's proactive prep schedule
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const AGENT_PREP = [
      { name: "Sofia Rodriguez", time: "22:00", task: "🧠 Nighttime Prep — Review today's FMCSA finds, prepare search strategies for tomorrow", color: "bg-cyan-500/40" },
      { name: "Marcus Chen", time: "21:00", task: "🧠 Nighttime Prep — Draft outreach messages, review qualified leads pipeline", color: "bg-blue-500/40" },
      { name: "David Kumar", time: "20:00", task: "🧠 Nighttime Prep — Analyze freight trends, plan dispatch capacity for tomorrow", color: "bg-green-500/40" },
      { name: "Jennifer Foster", time: "21:00", task: "🧠 Nighttime Prep — Prepare compliance checklists, review expiring sessions", color: "bg-orange-500/40" },
      { name: "Robert Chang", time: "22:00", task: "🧠 Nighttime Prep — Review unpaid invoices, prepare financial summary", color: "bg-amber-500/40" },
      { name: "Emily Watson", time: "20:00", task: "🧠 Nighttime Prep — Review customer feedback, prepare retention strategies", color: "bg-red-500/40" },
      { name: "Alexandra Sterling", time: "19:00", task: "🧠 Nighttime Prep — Weekly performance review, strategic planning", color: "bg-purple-500/40" },
      { name: "Team Lead", time: "01:00", task: "⭐ Supervisor Review — Check all agent performance, generate nightly summary", color: "bg-pink-500/60" },
    ];
    AGENT_PREP.forEach(p => {
      const prepDate = new Date(`${todayStr}T${p.time}:00`);
      events.push({
        id: `prep-${p.name.replace(/\s+/g, '-')}`,
        title: p.task,
        date: prepDate,
        type: "agent_action",
        agent: p.name,
        details: `After-hours proactive work — ${p.name} preparing for next day`,
        color: p.color,
      });
    });

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

export default async function CalendarPage() {
  const [events, pipeline] = await Promise.all([
    getCalendarEvents(),
    getPipelineData(),
  ]);

  return (
    <CalendarKanbanPage
      events={serialize(events)}
      pipeline={{
        quoteLeads: pipeline.quoteLeads as Record<string, unknown>[],
        driverLeads: pipeline.driverLeads as Record<string, unknown>[],
        leaseAgreements: pipeline.leaseAgreements as Record<string, unknown>[],
      }}
    />
  );
}