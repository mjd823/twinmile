import type { Metadata } from "next";

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

      <section>
        <div className="w-full py-6">
          <AdminOpsDashboard coverage={JSON.parse(JSON.stringify(coverage))} />
        </div>
      </section>
    </main>
  );
}
