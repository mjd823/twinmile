import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminLoadsForm } from "@/components/forms/admin-loads-form";

export const metadata: Metadata = {
  title: "Loads",
  robots: { index: false, follow: false },
};

export default async function AdminLoadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const truckIdRaw = sp.truckId;
  const preselectedTruckId = Array.isArray(truckIdRaw)
    ? String(truckIdRaw[0] ?? "")
    : truckIdRaw
      ? String(truckIdRaw)
      : undefined;

  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [trucks, loads] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { projection: { name: 1 }, sort: { updatedAt: -1, createdAt: -1 }, limit: 200 })
      .toArray(),
    db
      .collection("loads")
      .find({}, { sort: { createdAt: -1 }, limit: 200 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Loads</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Create and manage routes/contracts.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminLoadsForm
            trucks={trucks.map((t: any) => ({ id: String(t._id), name: String(t.name ?? "") }))}
            loads={loads.map((l: any) => ({
              id: String(l._id),
              status: String(l.status ?? "planned"),
              pickup: String(l.pickup ?? ""),
              dropoff: String(l.dropoff ?? ""),
              etaHours: Number(l.etaHours ?? 0),
              revenueUsd: Number(l.revenueUsd ?? 0),
              truckId: l.truckId ? String(l.truckId) : "",
            }))}
            preselectedTruckId={preselectedTruckId}
          />
        </div>
      </section>
    </main>
  );
}
