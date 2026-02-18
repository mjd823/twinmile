import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { OwnerDashboard } from "@/components/admin/owner-dashboard";
import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";

export const metadata = {
  title: "Owner Dashboard - Twin Mile Admin",
  robots: { index: false, follow: false },
};

function serialize(docs: any[]) {
  return docs.map((doc) => ({
    ...doc,
    _id: doc._id?.toString?.() ?? doc._id,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  }));
}

function scoreLead(lead: any, type: 'quote' | 'driver') {
  let score = 50;
  let estimatedValue = 0;
  const autoActions: string[] = [];

  if (type === 'quote') {
    if (lead.serviceType === 'freight') { score += 20; estimatedValue += 1000; }
    if (lead.serviceType === 'hotshot') { score += 15; estimatedValue += 800; }
    if (lead.serviceType === 'flatbed') { score += 15; estimatedValue += 900; }
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

export default async function OwnerDashboardPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [quoteLeads, driverLeads] = await Promise.all([
    db.collection("leads_quotes").find({ isArchived: { $ne: true } }).sort({ createdAt: -1 }).limit(100).toArray(),
    db.collection("leads_drivers").find({ isArchived: { $ne: true } }).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);

  const allLeads = [...processLeads(serialize(quoteLeads), 'quote'), ...processLeads(serialize(driverLeads), 'driver')];
  const ownerLeads = allLeads.filter((lead: any) => lead.routing?.assignee === 'owner');

  return (
    <main className="max-w-6xl mx-auto">
      <Link
        href="/admin/lead-engine"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Business Center
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 rounded-xl bg-purple-500/15">
          <Crown className="h-8 w-8 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Owner Dashboard</h1>
          <p className="text-muted-foreground">Premium leads requiring your immediate attention</p>
        </div>
      </div>

      <OwnerDashboard premiumLeads={ownerLeads} />
    </main>
  );
}
