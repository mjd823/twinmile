import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminContractsForm } from "@/components/forms/admin-contracts-form";

export const metadata: Metadata = {
  title: "Contracts",
  robots: { index: false, follow: false },
};

export default async function AdminContractsPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [customers, contracts] = await Promise.all([
    db
      .collection("customers")
      .find({}, { projection: { name: 1 }, sort: { name: 1 }, limit: 500 })
      .toArray(),
    db
      .collection("contracts")
      .find({}, { sort: { createdAt: -1 }, limit: 500 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Contracts</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Customer pricing references.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminContractsForm
            customers={customers.map((c: any) => ({ id: String(c._id), name: String(c.name ?? "") }))}
            contracts={contracts.map((c: any) => ({
              id: String(c._id),
              customerId: c.customerId ? String(c.customerId) : "",
              name: String(c.name ?? ""),
              rateType: String(c.rateType ?? "flat"),
              rateUsd: Number(c.rateUsd ?? 0),
              notes: c.notes ? String(c.notes) : "",
            }))}
          />
        </div>
      </section>
    </main>
  );
}
