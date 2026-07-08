import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminInbox } from "@/components/admin/admin-inbox";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

/** Never-throwing date → ISO conversion (createdAt is string OR Date in the wild). */
function isoDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function locationString(loc: unknown): string {
  if (typeof loc === "string") return loc;
  if (loc && typeof loc === "object") {
    const o = loc as { city?: string; state?: string };
    return [o.city, o.state].filter(Boolean).join(", ");
  }
  return "";
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; stage?: string; filter?: string }>;
}) {
  const user = await requireRole("admin");
  if (!user) {
    return null;
  }

  const params = await searchParams;
  // Back-compat: older links used ?filter=driver / ?filter=quote
  const initialType =
    params.type === "drivers" || params.filter === "driver" ? "drivers"
    : params.type === "quotes" || params.filter === "quote" ? "quotes"
    : "all";
  const initialStage = (params.stage || "all").toLowerCase();

  let quoteLeads: any[] = [];
  let driverLeads: any[] = [];
  let outboundProspects: any[] = [];
  let loadError: string | null = null;

  try {
    if (!clientPromise) throw new Error("Database not configured");
    const client = await clientPromise;
    const db = client.db();

    [quoteLeads, driverLeads, outboundProspects] = await Promise.all([
      db
        .collection("leads_quotes")
        .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 300 })
        .toArray(),
      db
        .collection("leads_drivers")
        .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 300 })
        .toArray(),
      // All prospects (slim projection) so stage drill-downs show the real
      // counts, not an arbitrary 300-row sample.
      db
        .collection("outbound_prospects")
        .find(
          {},
          {
            sort: { createdAt: -1 },
            limit: 2000,
            projection: {
              name: 1,
              contact: 1,
              equipment: 1,
              status: 1,
              createdAt: 1,
              aiScore: 1,
              dotNumber: 1,
              dot_number: 1,
              location: 1,
              source: 1,
            },
          }
        )
        .toArray(),
    ]);
  } catch (error) {
    console.error("[admin/leads] Failed to load leads:", error);
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-12">
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-400">Leads unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The database connection dropped — refresh to try again.
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground/70">{loadError.substring(0, 200)}</p>
        </div>
      </main>
    );
  }

  // Merge outbound prospects into driver leads so they show in the leads list
  const prospectDriverLeads = outboundProspects.map((p: any) => ({
    _id: p._id,
    fullName: p.name || "",
    email: p.contact?.email || "",
    phone: p.contact?.phone || "",
    truckType: p.equipment || "",
    yearsExperience: "",
    preferredRoutes: "",
    startDate: "",
    notes: `AI Score: ${p.aiScore || 0} | DOT: ${p.dotNumber || p.dot_number || "N/A"} | ${locationString(p.location)} | Source: ${p.source || "FMCSA"}`,
    status: (p.status === "onboarding_invited" ? "onboarding" : p.status) || "new",
    createdAt: p.createdAt,
  }));

  const allDriverLeads = [...driverLeads, ...prospectDriverLeads];

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Leads</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Every quote request, driver application, and outbound prospect — the working list behind the Lead Engine.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminInbox
            initialType={initialType}
            initialStage={initialStage}
            quoteLeads={quoteLeads.map((l: any) => ({
              id: String(l._id),
              name: String(l.name ?? ""),
              company: String(l.company ?? ""),
              email: String(l.email ?? ""),
              phone: String(l.phone ?? ""),
              pickupLocation: String(l.pickupLocation ?? ""),
              dropoffLocation: String(l.dropoffLocation ?? ""),
              serviceType: String(l.serviceType ?? ""),
              pickupDate: String(l.pickupDate ?? ""),
              notes: String(l.notes ?? ""),
              status: (l.status ?? "new") as any,
              createdAt: isoDate(l.createdAt),
            }))}
            driverLeads={allDriverLeads.map((l: any) => ({
              id: String(l._id),
              fullName: String(l.fullName ?? ""),
              email: String(l.email ?? ""),
              phone: String(l.phone ?? ""),
              truckType: String(l.truckType ?? ""),
              yearsExperience: String(l.yearsExperience ?? ""),
              preferredRoutes: String(l.preferredRoutes ?? ""),
              startDate: String(l.startDate ?? ""),
              notes: String(l.notes ?? ""),
              status: (l.status ?? "new") as any,
              createdAt: isoDate(l.createdAt),
            }))}
          />
        </div>
      </section>
    </main>
  );
}
