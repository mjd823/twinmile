import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminCustomersForm } from "@/components/forms/admin-customers-form";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default async function AdminCustomersPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const customers = await db
    .collection("customers")
    .find({}, { sort: { name: 1 }, limit: 500 })
    .toArray();

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Customers</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Add customers and contact details.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminCustomersForm
            customers={customers.map((c: any) => ({
              id: String(c._id),
              name: String(c.name ?? ""),
              contactEmail: c.contactEmail ? String(c.contactEmail) : "",
              contactPhone: c.contactPhone ? String(c.contactPhone) : "",
              notes: c.notes ? String(c.notes) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
