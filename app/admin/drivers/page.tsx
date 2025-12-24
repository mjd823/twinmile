import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminDriversHub } from "@/components/admin/admin-drivers-hub";

export const metadata: Metadata = {
  title: "Drivers",
  robots: { index: false, follow: false },
};

export default async function AdminDriversPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const drivers = await db
    .collection("users")
    .find(
      { role: "driver" },
      { projection: { email: 1, firstName: 1, lastName: 1, isOwnerOperator: 1 }, sort: { createdAt: -1 } }
    )
    .toArray();

  const driverIds = drivers.map((d: any) => String(d._id));
  const trucks = await db
    .collection("trucks")
    .find({ driverUserId: { $in: driverIds } }, { projection: { name: 1, driverUserId: 1 } })
    .toArray();

  const assignedTruckByDriverId = new Map<string, string>();
  for (const t of trucks as any[]) {
    const driverUserId = t?.driverUserId ? String(t.driverUserId) : "";
    if (!driverUserId) continue;
    if (!assignedTruckByDriverId.has(driverUserId)) {
      assignedTruckByDriverId.set(driverUserId, t?.name ? String(t.name) : "—");
    }
  }

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Drivers
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Driver profiles, assignments, and activity.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminDriversHub
            drivers={drivers.map((d: any) => ({
              id: String(d._id),
              email: String(d.email),
              firstName: d.firstName ? String(d.firstName) : "",
              lastName: d.lastName ? String(d.lastName) : "",
              isOwnerOperator: Boolean(d.isOwnerOperator),
              assignedTruckName: assignedTruckByDriverId.get(String(d._id)) ?? "—",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
