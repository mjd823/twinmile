import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { LeadEngineV2 } from "@/components/admin/LeadEngineV2";

export const metadata = {
  title: "Lead Engine - Twin Mile Admin",
  robots: { index: false, follow: false },
};

// Serialize MongoDB docs so ObjectIds and Dates become plain strings
function serialize(docs: any[]) {
  return docs.map((doc) => ({
    ...doc,
    _id: doc._id?.toString?.() ?? doc._id,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  }));
}

// Pure server-side lead scoring (no Groq / no browser deps)
function scoreLead(lead: any, type: 'quote' | 'driver') {
  let score = 50;
  let estimatedValue = 0;
  const autoActions: string[] = [];

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
      timestamp: lead.createdAt || new Date().toISOString(),
    };
  });
}

export default async function LeadEnginePage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  // Fetch real data from database
  const [quoteLeads, driverLeads, outboundProspects] = await Promise.all([
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
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  // Score leads server-side (no Groq needed)
  const scoredQuotes = processLeads(serialize(quoteLeads), 'quote');
  const scoredDrivers = processLeads(serialize(driverLeads), 'driver');

  // Convert outbound prospects to driver lead format for the pipeline
  const prospectDrivers = outboundProspects.map((p: any) => ({
    ...serialize([p])[0],
    name: p.name || '',
    fullName: p.name || '',
    email: p.contact?.email || '',
    phone: p.contact?.phone || '',
    truckType: p.equipment || '',
    yearsExperience: '',
    hasOwnAuthority: p.authorityStatus === 'authorized',
    score: p.aiScore || 0,
    aiScore: p.aiScore || 0,
    status: p.status === 'onboarding_invited' ? 'onboarding' : p.status,
    quality: (p.aiScore || 0) >= 85 ? 'premium' : (p.aiScore || 0) >= 70 ? 'high' : 'medium',
    estimatedValue: 0,
    priority: (p.aiScore || 0) >= 85 ? 'urgent' : 'medium',
    timestamp: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    dotNumber: p.dotNumber,
    location: p.location,
    state: p.state,
    powerUnits: p.powerUnits,
    safetyRating: p.safetyRating,
    source: p.source,
  }));

  // Merge: outbound prospects + leads_drivers (dedup by name)
  const allDriverLeads = [...prospectDrivers, ...scoredDrivers];

  // Normalize MongoDB Date/ObjectId/nested values before crossing into the client component.
  const clientQuotes = JSON.parse(JSON.stringify(scoredQuotes));
  const clientDrivers = JSON.parse(JSON.stringify(allDriverLeads));

  return (
    <main className="min-h-screen bg-background">
      <LeadEngineV2
        quoteLeads={clientQuotes}
        driverLeads={clientDrivers}
      />
    </main>
  );
}
