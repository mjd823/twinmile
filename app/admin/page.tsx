import type { Metadata } from "next";
import Link from "next/link";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { getRecruitingCoverage, type RecruitingCoverage } from "@/lib/recruiting-coverage";
import { AdminOpsDashboard } from "@/components/admin/admin-ops-dashboard";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const EMPTY_COVERAGE: RecruitingCoverage = {
  states: [],
  totals: {
    prospects: 0,
    statesCovered: 0,
    qualified: 0,
    invited: 0,
    engagedPlus: 0,
    unknownLocation: 0,
  },
  generatedAt: new Date(0).toISOString(),
};

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");
  if (!user) {
    return null;
  }

  // Real recruiting coverage for the ops map — computed server-side from
  // outbound_prospects (every prospect carries an FMCSA location).
  let coverage = EMPTY_COVERAGE;
  try {
    if (clientPromise) {
      const client = await clientPromise;
      coverage = await getRecruitingCoverage(client.db());
    }
  } catch (error) {
    console.error("[admin] recruiting coverage unavailable:", error);
  }

  let quoteAttention: number | null = null;
  try {
    if (clientPromise) {
      const db = (await clientPromise).db();
      // Match the inbox's unarchived owner/GVAI warnings; count quotes, not destinations.
      quoteAttention = await db.collection("leads_quotes").countDocuments({
        isArchived: { $ne: true },
        $or: [
          { "quoteDelivery.owner.status": "attention" },
          { "quoteDelivery.gvai.status": "attention" },
        ],
      });
    }
  } catch {
    console.error("[admin] quote handoff status unavailable");
  }

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Operations
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Signed in as {user.email}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Fleet, loads, and recruiting coverage — real data only
            </div>
          </div>
        </div>
      </section>

      {(quoteAttention === null || quoteAttention > 0) && (
        <section aria-label="Quote handoff attention" className="border-b border-border/60 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p role="status">
              {quoteAttention === null
                ? "Quote handoff status unavailable"
                : `${quoteAttention.toLocaleString()} quote handoff${quoteAttention === 1 ? " needs" : "s need"} review`}
            </p>
            <Link href="/admin/lead-engine?tab=manual" className="font-medium underline underline-offset-4">
              Review quotes
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="w-full py-6">
          <AdminOpsDashboard coverage={JSON.parse(JSON.stringify(coverage))} />
        </div>
      </section>
    </main>
  );
}
