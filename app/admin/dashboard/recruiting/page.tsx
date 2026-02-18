import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { RecruitingDashboard } from "@/components/admin/recruiting-dashboard";
import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";

export const metadata = {
  title: "Recruiting Dashboard - Twin Mile Admin",
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

  score = Math.min(score, 100);
  const quality = score >= 85 ? 'premium' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';
  const priority = score >= 85 ? 'urgent' : score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low';

  return {
    score, quality, estimatedValue, priority,
    routing: { shouldAutoRespond: true, shouldNotify: quality !== 'low', shouldEscalate: quality === 'premium', assignee: 'recruiting_team' },
    processingMethod: 'server-scored' as const,
  };
}

function processLeads(rawLeads: any[]) {
  return rawLeads.map((lead) => {
    const scored = scoreLead(lead, 'driver');
    return {
      ...lead,
      ...scored,
      name: lead.fullName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      timestamp: lead.createdAt || new Date().toISOString(),
    };
  });
}

export default async function RecruitingDashboardPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const driverLeads = await db
    .collection("leads_drivers")
    .find({ isArchived: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const recruitingLeads = processLeads(serialize(driverLeads));

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
        <div className="p-4 rounded-xl bg-blue-500/15">
          <UserCheck className="h-8 w-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recruiting Dashboard</h1>
          <p className="text-muted-foreground">Driver applications scored and assigned for processing</p>
        </div>
      </div>

      <RecruitingDashboard driverLeads={recruitingLeads} />
    </main>
  );
}
