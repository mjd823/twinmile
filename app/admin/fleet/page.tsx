import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminFleetHub } from "@/components/admin/admin-fleet-hub";

export const metadata: Metadata = {
  title: "Fleet",
  robots: { index: false, follow: false },
};

export default async function AdminFleetPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [trucks, drivers] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { sort: { updatedAt: -1, createdAt: -1 }, limit: 200 })
      .toArray(),
    db
      .collection("users")
      .find(
        { role: "driver" },
        { projection: { email: 1, firstName: 1, lastName: 1 }, sort: { createdAt: -1 } }
      )
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Fleet</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Truck profiles, assignments, and activity.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminFleetHub
            drivers={drivers.map((d: any) => ({
              id: String(d._id),
              email: String(d.email ?? ""),
              firstName: d.firstName ? String(d.firstName) : "",
              lastName: d.lastName ? String(d.lastName) : "",
            }))}
            trucks={trucks.map((t: any) => ({
              id: String(t._id),
              name: String(t.name ?? ""),
              status: String(t.status ?? "idle"),
              fuelPct: Number(t.fuelPct ?? 0),
              lat: typeof t.lat === "number" ? t.lat : null,
              lng: typeof t.lng === "number" ? t.lng : null,
              driverName: t.driverName ? String(t.driverName) : "",
              driverUserId: t.driverUserId ? String(t.driverUserId) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
