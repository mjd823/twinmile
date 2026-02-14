import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminInbox } from "@/components/admin/admin-inbox";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default async function AdminInboxPage() {
  const user = await requireRole("admin");
  if (!user) {
    return null;
  }

  const client = await clientPromise!;
  const db = client.db();

  const [quoteLeads, driverLeads] = await Promise.all([
    db
      .collection("leads_quotes")
      .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 300 })
      .toArray(),
    db
      .collection("leads_drivers")
      .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 300 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Inbox</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Quote requests and driver applications.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminInbox
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
              createdAt: l.createdAt ? String(new Date(l.createdAt).toISOString()) : "",
            }))}
            driverLeads={driverLeads.map((l: any) => ({
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
              createdAt: l.createdAt ? String(new Date(l.createdAt).toISOString()) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
