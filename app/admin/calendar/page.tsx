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
      events.push({
        id: `activity-${String(a._id)}`,
        title: agentName || "System",
        date: new Date(when),
        type: "agent_action",
        agent: agentName,
        details: a.activity || a.action || a.details,
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