import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminFuelForm } from "@/components/forms/admin-fuel-form";

export const metadata: Metadata = {
  title: "Fuel",
  robots: { index: false, follow: false },
};

export default async function AdminFuelPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [trucks, fuelLogs] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { projection: { name: 1 }, sort: { updatedAt: -1, createdAt: -1 }, limit: 200 })
      .toArray(),
    db
      .collection("fuelLogs")
      .find({}, { sort: { at: -1 }, limit: 500 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Fuel</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Track fuel spend and usage.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminFuelForm
            trucks={trucks.map((t: any) => ({ id: String(t._id), name: String(t.name ?? "") }))}
            fuelLogs={fuelLogs.map((l: any) => ({
              id: String(l._id),
              truckId: l.truckId ? String(l.truckId) : "",
              at: l.at instanceof Date ? l.at.toISOString() : "",
              gallons: Number(l.gallons ?? 0),
              costUsd: Number(l.costUsd ?? 0),
              odometer: typeof l.odometer === "number" ? l.odometer : null,
              notes: l.notes ? String(l.notes) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
