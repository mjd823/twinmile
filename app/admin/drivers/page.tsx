import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AdminDriversForm } from "@/components/forms/admin-drivers-form";

export const metadata: Metadata = {
  title: "Driver Accounts",
  robots: { index: false, follow: false },
};

export default async function AdminDriversPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const drivers = await db
    .collection("users")
    .find({ role: "driver" }, { projection: { email: 1 }, sort: { createdAt: -1 } })
    .toArray();

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Driver Accounts
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Create driver logins and reset passwords.
              </div>
            </div>
            <a
              className="text-sm text-muted-foreground hover:text-foreground"
              href="/admin"
            >
              ← Back to dashboard
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <AdminDriversForm
            drivers={drivers.map((d: any) => ({
              id: String(d._id),
              email: String(d.email),
            }))}
          />
        </div>
      </section>
    </main>
  );
}
