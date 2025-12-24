import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminMaintenanceForm } from "@/components/forms/admin-maintenance-form";

export const metadata: Metadata = {
  title: "Maintenance",
  robots: { index: false, follow: false },
};

export default async function AdminMaintenancePage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [trucks, maintenanceLogs] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { projection: { name: 1 }, sort: { updatedAt: -1, createdAt: -1 }, limit: 200 })
      .toArray(),
    db
      .collection("maintenanceLogs")
      .find({}, { sort: { at: -1 }, limit: 500 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Maintenance</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Track maintenance history and cost.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminMaintenanceForm
            trucks={trucks.map((t: any) => ({ id: String(t._id), name: String(t.name ?? "") }))}
            maintenanceLogs={maintenanceLogs.map((l: any) => ({
              id: String(l._id),
              truckId: l.truckId ? String(l.truckId) : "",
              at: l.at instanceof Date ? l.at.toISOString() : "",
              kind: String(l.kind ?? ""),
              costUsd: Number(l.costUsd ?? 0),
              notes: l.notes ? String(l.notes) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
