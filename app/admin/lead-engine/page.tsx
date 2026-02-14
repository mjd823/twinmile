import { redirect } from "next/navigation";
import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AIBusinessDashboard } from "@/components/admin/ai-business-dashboard";

export const metadata = {
  title: "AI Business Center - Twin Mile Admin",
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
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">🤖 AI Business Center</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Your AI team is working 24/7 to grow your business - Monitor and control everything from here
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Real-time AI operations</div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AIBusinessDashboard />
        </div>
      </section>
    </main>
  );
}
