import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { LeadEngineV2, type PipelineStats } from "@/components/admin/LeadEngineV2";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lead Engine - Twin Mile Admin",
  robots: { index: false, follow: false },
};

// Serialize MongoDB docs so ObjectIds and Dates become plain strings.
// createdAt in outbound_prospects is a string on ~450 legacy docs and a Date
// on the rest — normalize both without ever throwing on odd values.
function isoDate(value: any): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function serialize(docs: any[]) {
  return docs.map((doc) => ({
    ...doc,
    _id: doc._id?.toString?.() ?? doc._id,
    createdAt: isoDate(doc.createdAt),
  }));
}

// Pure server-side lead scoring (no Groq / no browser deps)
function scoreLead(lead: any, type: 'quote' | 'driver') {
  let score = 50;
  let estimatedValue = 0;

  if (type === 'quote') {
    if (lead.serviceType === 'freight') { score += 20; estimatedValue += 1000; }
    if (lead.serviceType === 'hotshot') { score += 15; estimatedValue += 800; }
    if (lead.serviceType === 'flatbed') { score += 15; estimatedValue += 900; }
    if (lead.serviceType === 'last_mile') { score += 10; estimatedValue += 500; }
    if (lead.pickupLocation && lead.dropoffLocation) { score += 15; estimatedValue += 500; }
    if (lead.company) { score += 10; estimatedValue += 300; }
    if (lead.urgency === 'rush' || lead.urgency === 'urgent') { score += 10; }
  } else {
    const years = parseInt(lead.yearsExperience || '0');
    if (years >= 5) { score += 20; estimatedValue += 5000; }
    else if (years >= 2) { score += 15; estimatedValue += 3000; }
    else if (years >= 1) { score += 10; estimatedValue += 2000; }
    if (lead.truckType === 'power_only') { score += 15; estimatedValue += 2000; }
    if (lead.truckType === 'hotshot') { score += 10; estimatedValue += 1500; }
    if (lead.truckType === 'flatbed') { score += 10; estimatedValue += 1500; }
    if (lead.truckType === 'reefer') { score += 10; estimatedValue += 1800; }
    if (lead.hasOwnAuthority) { score += 15; estimatedValue += 3000; }
    if ((lead.endorsements?.length || 0) > 0) { score += 5; estimatedValue += 500; }
  }

  score = Math.min(score, 100);
  const quality = score >= 85 ? 'premium' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';
  const priority = score >= 85 ? 'urgent' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';

  const assignee = quality === 'premium' ? 'owner'
    : type === 'driver' ? 'recruiting_team'
    : lead.serviceType === 'freight' ? 'freight_specialist'
    : lead.serviceType === 'hotshot' ? 'hotshot_team'
    : 'general_sales';

  return {
    score, quality, estimatedValue, priority,
    routing: { shouldAutoRespond: true, shouldNotify: quality !== 'low', shouldEscalate: quality === 'premium', assignee },
    processingMethod: 'server-scored' as const,
  };
}

function processLeads(rawLeads: any[], type: 'quote' | 'driver') {
  return rawLeads.map((lead) => {
    const scored = scoreLead(lead, type);
    return {
      ...lead,
      ...scored,
      name: type === 'driver' ? (lead.fullName || '') : (lead.name || ''),
      email: lead.email || '',
      phone: lead.phone || '',
      timestamp: lead.createdAt || '',
    };
  });
}

function locationString(loc: any): string {
  if (typeof loc === "string") return loc;
  if (loc && typeof loc === "object") {
    const city = loc.city || "";
    const state = loc.state || "";
    return [city, state].filter(Boolean).join(", ");
  }
  return "";
}

/**
 * Mutually exclusive driver-pipeline stage counts over the FULL collections
 * (countDocuments — not the limited page of rows we render below). Every
 * record lands in exactly one stage, so stages sum to the total.
 */
async function computePipelineStats(db: any): Promise<PipelineStats> {
  const prospectByStatus: Record<string, number> = {};
  for (const row of await db
    .collection("outbound_prospects")
    .aggregate([{ $group: { _id: { $ifNull: ["$status", "new"] }, count: { $sum: 1 } } }])
    .toArray()) {
    prospectByStatus[String(row._id)] = row.count;
  }
  const driverLeadByStatus: Record<string, number> = {};
  for (const row of await db
    .collection("leads_drivers")
    .aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: { $ifNull: ["$status", "new"] }, count: { $sum: 1 } } },
    ])
    .toArray()) {
    driverLeadByStatus[String(row._id)] = row.count;
  }
  const quoteByStatus: Record<string, number> = {};
  for (const row of await db
    .collection("leads_quotes")
    .aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: { $ifNull: ["$status", "new"] }, count: { $sum: 1 } } },
    ])
    .toArray()) {
    quoteByStatus[String(row._id)] = row.count;
  }

  const p = (s: string) => prospectByStatus[s] || 0;
  const d = (s: string) => driverLeadByStatus[s] || 0;
  const q = (s: string) => quoteByStatus[s] || 0;

  const driverStages = [
    { key: "new", label: "New", count: p("new") + d("new") },
    { key: "qualified", label: "Qualified", count: p("qualified") + p("reviewed") + d("qualified") + d("contacted") },
    { key: "onboarding", label: "Invited", count: p("onboarding_invited") + p("onboarding") + d("onboarding") + d("compliance_check") },
    { key: "ready", label: "Ready", count: p("ready_to_dispatch") + d("ready_to_dispatch") },
    { key: "converted", label: "Hired", count: p("converted") + d("converted") },
    { key: "rejected", label: "Rejected", count: p("rejected") + p("lost") + d("rejected") + d("lost") },
  ];

  const quoteStages = [
    { key: "new", label: "New", count: q("new") },
    { key: "contacted", label: "Contacted", count: q("contacted") },
    { key: "qualified", label: "Qualified", count: q("qualified") },
    { key: "negotiating", label: "Negotiating", count: q("quoted") + q("negotiating") },
    { key: "converted", label: "Won", count: q("converted") },
    { key: "lost", label: "Lost", count: q("lost") },
  ];

  const totalDriverLeads = Object.values(prospectByStatus).reduce((a, b) => a + b, 0)
    + Object.values(driverLeadByStatus).reduce((a, b) => a + b, 0);
  const totalQuoteLeads = Object.values(quoteByStatus).reduce((a, b) => a + b, 0);

  return { driverStages, quoteStages, totalDriverLeads, totalQuoteLeads };
}

export default async function LeadEnginePage() {
  const user = await requireRole("admin");
  if (!user) return null;

  let clientQuotes: any[] = [];
  let clientDrivers: any[] = [];
  let stats: PipelineStats | null = null;
  let loadError: string | null = null;

  try {
    if (!clientPromise) throw new Error("Database not configured");
    const client = await clientPromise;
    const db = client.db();

    // Fetch real data from database
    const [quoteLeads, driverLeads, outboundProspects, pipelineStats] = await Promise.all([
      db
        .collection("leads_quotes")
        .find({ isArchived: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      db
        .collection("leads_drivers")
        .find({ isArchived: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      db
        .collection("outbound_prospects")
        .find({})
        // priorityScore first (new-authority/insurance-lapse boosts), then
        // recency. Docs without priorityScore sort after boosted ones.
        .sort({ priorityScore: -1, createdAt: -1 })
        .limit(200)
        .toArray(),
      computePipelineStats(db),
    ]);
    stats = pipelineStats;

    // Score leads server-side (no Groq needed)
    const scoredQuotes = processLeads(serialize(quoteLeads), 'quote');
    const scoredDrivers = processLeads(serialize(driverLeads), 'driver');

    // Convert outbound prospects to driver lead format for the pipeline
    const prospectDrivers = outboundProspects.map((p: any) => {
      const locStr = locationString(p.location);
      return {
        ...serialize([p])[0],
        name: p.name || "",
        fullName: p.name || "",
        email: p.contact?.email || "",
        phone: p.contact?.phone || "",
        truckType: p.equipment || "",
        yearsExperience: "",
        hasOwnAuthority: p.authorityStatus === "authorized",
        score: p.priorityScore || p.aiScore || 0,
        aiScore: p.aiScore || 0,
        priorityScore: p.priorityScore || 0,
        sourceTag: p.sourceTag || "fmcsa-census",
        status: p.status === "onboarding_invited" ? "onboarding" : p.status,
        quality: (p.aiScore || 0) >= 85 ? "premium" : (p.aiScore || 0) >= 70 ? "high" : "medium",
        estimatedValue: 0,
        priority: (p.aiScore || 0) >= 85 ? "urgent" : "medium",
        timestamp: isoDate(p.createdAt),
        dotNumber: p.dotNumber || p.dot_number || "",
        location: locStr,
        state: locStr.split(",")[1]?.trim() || "",
        powerUnits: p.powerUnits ?? p.power_units ?? 0,
        safetyRating: p.safetyRating || "",
        source: p.source || "",
      };
    });

    // Merge: outbound prospects + leads_drivers
    const allDriverLeads = [...prospectDrivers, ...scoredDrivers];

    // Normalize MongoDB Date/ObjectId/nested values before crossing into the client component.
    clientQuotes = JSON.parse(JSON.stringify(scoredQuotes));
    clientDrivers = JSON.parse(JSON.stringify(allDriverLeads));
  } catch (error) {
    console.error("[lead-engine] Failed to load data:", error);
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-2xl px-5 py-12">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
            <h2 className="text-lg font-semibold text-red-400">Lead Engine data unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The database connection dropped — refresh to try again. The rest of the admin keeps working.
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground/70">{loadError.substring(0, 200)}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <LeadEngineV2
        quoteLeads={clientQuotes}
        driverLeads={clientDrivers}
        stats={stats}
      />
    </main>
  );
}
