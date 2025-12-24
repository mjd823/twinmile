"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CustomerRow = {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
};

export function AdminCustomersForm({ customers }: { customers: CustomerRow[] }) {
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
      contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to create customer.");
        return;
      }

      setStatus("Customer created. Reload the page to see it in the list.");
      e.currentTarget.reset();
    } catch {
      setStatus("Unable to create customer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Add customer</div>
        <div className="mt-2 text-sm text-muted-foreground">Create a customer record.</div>

        <form onSubmit={onCreate} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="name">
              Customer name
            </label>
            <Input id="name" name="name" required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="contactEmail">
                Contact email
              </label>
              <Input id="contactEmail" name="contactEmail" type="email" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="contactPhone">
                Contact phone
              </label>
              <Input id="contactPhone" name="contactPhone" />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <Textarea id="notes" name="notes" />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create customer"}
          </Button>
          {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Customers</div>
        <div className="mt-2 text-sm text-muted-foreground">Existing customers.</div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-5">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-3">Phone</div>
          </div>
          {customers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No customers yet.</div>
          ) : (
            customers.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm"
              >
                <div className="col-span-5 font-medium">{c.name}</div>
                <div className="col-span-4 text-muted-foreground">{c.contactEmail || "—"}</div>
                <div className="col-span-3 text-muted-foreground">{c.contactPhone || "—"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
