import type { Metadata } from "next";
import Link from "next/link";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");
  if (!user) {
    return null;
  }

  const client = await clientPromise!;
  const db = client.db();

  const [quoteLeads, driverLeads] = await Promise.all([
    db
      .collection("leads_quotes")
      .find({}, { sort: { createdAt: -1 }, limit: 50 })
      .toArray(),
    db
      .collection("leads_drivers")
      .find({}, { sort: { createdAt: -1 }, limit: 50 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Admin Dashboard
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Signed in as {user.email}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href="/admin/drivers"
              >
                Driver accounts
              </Link>
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href="/admin/settings/password"
              >
                Change password
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className="text-sm text-muted-foreground hover:text-foreground"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="grid gap-10">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Quote Leads</h2>
                <Link className="text-sm text-muted-foreground hover:text-foreground" href="/get-a-quote">
                  View form
                </Link>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
                <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2">Phone</div>
                  <div className="col-span-4">Route</div>
                </div>
                {quoteLeads.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No leads yet.</div>
                ) : (
                  quoteLeads.map((l: any) => (
                    <div
                      key={String(l._id)}
                      className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm"
                    >
                      <div className="col-span-3 font-medium">{l.name}</div>
                      <div className="col-span-3 text-muted-foreground">{l.email}</div>
                      <div className="col-span-2 text-muted-foreground">{l.phone}</div>
                      <div className="col-span-4 text-muted-foreground">
                        {l.pickupLocation} → {l.dropoffLocation}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Driver Applications</h2>
                <Link className="text-sm text-muted-foreground hover:text-foreground" href="/drive-with-us">
                  View form
                </Link>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
                <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-4">Email</div>
                  <div className="col-span-2">Phone</div>
                  <div className="col-span-2">Truck</div>
                </div>
                {driverLeads.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No applications yet.</div>
                ) : (
                  driverLeads.map((l: any) => (
                    <div
                      key={String(l._id)}
                      className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm"
                    >
                      <div className="col-span-4 font-medium">{l.fullName}</div>
                      <div className="col-span-4 text-muted-foreground">{l.email}</div>
                      <div className="col-span-2 text-muted-foreground">{l.phone}</div>
                      <div className="col-span-2 text-muted-foreground">{l.truckType}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
