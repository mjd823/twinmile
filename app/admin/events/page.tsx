import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminRouteEventsForm } from "@/components/forms/admin-route-events-form";

export const metadata: Metadata = {
  title: "Events",
  robots: { index: false, follow: false },
};

export default async function AdminEventsPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [trucks, loads, routeEvents] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { projection: { name: 1 }, sort: { updatedAt: -1, createdAt: -1 }, limit: 200 })
      .toArray(),
    db
      .collection("loads")
      .find({}, { projection: { pickup: 1, dropoff: 1 }, sort: { createdAt: -1 }, limit: 200 })
      .toArray(),
    db
      .collection("routeEvents")
      .find({}, { sort: { at: -1 }, limit: 500 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Events</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Ops timeline and status updates.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminRouteEventsForm
            trucks={trucks.map((t: any) => ({ id: String(t._id), name: String(t.name ?? "") }))}
            loads={loads.map((l: any) => ({
              id: String(l._id),
              label: `${String(l.pickup ?? "—")} → ${String(l.dropoff ?? "—")}`,
            }))}
            routeEvents={routeEvents.map((e: any) => ({
              id: String(e._id),
              at: e.at instanceof Date ? e.at.toISOString() : "",
              name: String(e.name ?? "note"),
              message: String(e.message ?? ""),
              truckId: e.truckId ? String(e.truckId) : "",
              loadId: e.loadId ? String(e.loadId) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
