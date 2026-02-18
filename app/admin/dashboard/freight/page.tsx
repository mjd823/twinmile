import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { FreightDashboard } from "@/components/admin/freight-dashboard";
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";

export const metadata = {
  title: "Freight Dashboard - Twin Mile Admin",
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

  if (lead.serviceType === 'freight') { score += 20; estimatedValue += 1000; }
  if (lead.serviceType === 'hotshot') { score += 15; estimatedValue += 800; }
  if (lead.serviceType === 'flatbed') { score += 15; estimatedValue += 900; }
  if (lead.serviceType === 'last_mile') { score += 10; estimatedValue += 500; }
  if (lead.pickupLocation && lead.dropoffLocation) { score += 15; estimatedValue += 500; }
  if (lead.company) { score += 10; estimatedValue += 300; }
  if (lead.urgency === 'rush' || lead.urgency === 'urgent') { score += 10; }

  score = Math.min(score, 100);
  const quality = score >= 85 ? 'premium' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';
  const priority = score >= 85 ? 'urgent' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';

  return {
    score, quality, estimatedValue, priority,
    routing: { shouldAutoRespond: true, shouldNotify: quality !== 'low', shouldEscalate: quality === 'premium', assignee: 'freight_specialist' },
    processingMethod: 'server-scored' as const,
  };
}

function processLeads(rawLeads: any[]) {
  return rawLeads.map((lead) => {
    const scored = scoreLead(lead, 'quote');
    return {
      ...lead,
      ...scored,
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      timestamp: lead.createdAt || new Date().toISOString(),
    };
  });
}

export default async function FreightDashboardPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const quoteLeads = await db
    .collection("leads_quotes")
    .find({ isArchived: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const freightLeads = processLeads(serialize(quoteLeads));

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
        <div className="p-4 rounded-xl bg-green-500/15">
          <Truck className="h-8 w-8 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Freight Dashboard</h1>
          <p className="text-muted-foreground">Quote requests routed for freight quote generation</p>
        </div>
      </div>

      <FreightDashboard quoteLeads={freightLeads} />
    </main>
  );
}
