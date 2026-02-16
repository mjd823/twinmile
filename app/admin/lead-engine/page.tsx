import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AIBusinessDashboard } from "@/components/admin/ai-business-dashboard";
import { LeadEngineDashboard } from "@/components/admin/lead-engine-dashboard";

export const metadata = {
  title: "AI Business Center - Twin Mile Admin",
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
    if (lead.company) { score += 10; estimatedValue += 300; autoActions.push('business_client_priority'); }
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
    if (lead.hasOwnAuthority) { score += 15; estimatedValue += 3000; autoActions.push('owner_operator_priority'); }
    if ((lead.endorsements?.length || 0) > 0) { score += 5; estimatedValue += 500; }
  }

  score = Math.min(score, 100);
  const quality = score >= 85 ? 'premium' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';
  const priority = score >= 85 ? 'urgent' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';

  if (quality === 'premium') autoActions.push('immediate_response', 'escalate_to_owner');
  else if (quality === 'high') autoActions.push('priority_response', 'assign_to_best_rep');
  else if (quality === 'medium') autoActions.push('standard_response');
  else autoActions.push('automated_response');

  const assignee = quality === 'premium' ? 'owner'
    : type === 'driver' ? 'recruiting_team'
    : lead.serviceType === 'freight' ? 'freight_specialist'
    : lead.serviceType === 'hotshot' ? 'hotshot_team'
    : 'general_sales';

  return {
    score, quality, estimatedValue, priority, autoActions,
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
  const [quoteLeads, driverLeads] = await Promise.all([
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
  ]);

  // Score leads server-side (no Groq needed)
  const scoredQuotes = processLeads(serialize(quoteLeads), 'quote');
  const scoredDrivers = processLeads(serialize(driverLeads), 'driver');

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">🤖 AI Business Center</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Your AI team is working 24/7 to grow your business - Monitor and control everything from here
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {quoteLeads.length + driverLeads.length} active leads in pipeline
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AIBusinessDashboard />
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="w-full py-6">
          <LeadEngineDashboard
            quoteLeads={scoredQuotes}
            driverLeads={scoredDrivers}
          />
        </div>
      </section>
    </main>
  );
}
