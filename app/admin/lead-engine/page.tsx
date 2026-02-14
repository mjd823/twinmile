import { redirect } from "next/navigation";
import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { LeadEngineDashboard } from "@/components/admin/lead-engine-dashboard";

export const metadata = {
  title: "Lead Engine - Twin Mile Admin",
  robots: { index: false, follow: false },
};

export default async function LeadEnginePage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  // Fetch real data from database
  const [quoteLeads, driverLeads] = await Promise.all([
    db
      .collection("leads_quotes")
      .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 100 })
      .toArray(),
    db
      .collection("leads_drivers")
      .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 100 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">🚀 Lead Engine</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Automated lead qualification, scoring, and team routing - Zero manual intervention required
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Real-time lead processing</div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <LeadEngineDashboard 
            quoteLeads={JSON.parse(JSON.stringify(quoteLeads))}
            driverLeads={JSON.parse(JSON.stringify(driverLeads))}
          />
        </div>
      </section>
    </main>
  );
}
