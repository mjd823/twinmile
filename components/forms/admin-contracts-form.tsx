"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CustomerOption = { id: string; name: string };

type ContractRow = {
  id: string;
  customerId: string;
  name: string;
  rateType: string;
  rateUsd: number;
  notes?: string;
};

export function AdminContractsForm({
  customers,
  contracts,
}: {
  customers: CustomerOption[];
  contracts: ContractRow[];
}) {
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      customerId: String(formData.get("customerId") ?? ""),
      name: String(formData.get("name") ?? ""),
      rateType: String(formData.get("rateType") ?? "flat"),
      rateUsd: Number(formData.get("rateUsd") ?? 0),
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to create contract.");
        return;
      }

      setStatus("Contract created. Reload the page to see it in the list.");
      e.currentTarget.reset();
    } catch {
      setStatus("Unable to create contract.");
    } finally {
      setSubmitting(false);
    }
  }

  function customerName(customerId: string) {
    return customers.find((c) => c.id === customerId)?.name ?? "—";
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Add contract</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Create a contract for a customer (pricing reference).
        </div>

        <form onSubmit={onCreate} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="customerId">
              Customer
            </label>
            <select
              id="customerId"
              name="customerId"
              className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
              defaultValue={customers[0]?.id ?? ""}
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="name">
              Contract name
            </label>
            <Input id="name" name="name" required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="rateType">
                Rate type
              </label>
              <select
                id="rateType"
                name="rateType"
                className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                defaultValue="flat"
              >
                <option value="flat">Flat</option>
                <option value="per_mile">Per mile</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="rateUsd">
                Rate ($)
              </label>
              <Input id="rateUsd" name="rateUsd" type="number" min={0} defaultValue={0} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <Textarea id="notes" name="notes" />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create contract"}
          </Button>
          {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Contracts</div>
        <div className="mt-2 text-sm text-muted-foreground">Existing contracts.</div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-4">Customer</div>
            <div className="col-span-4">Contract</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Rate</div>
          </div>
          {contracts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No contracts yet.</div>
          ) : (
            contracts.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm"
              >
                <div className="col-span-4 font-medium">{customerName(c.customerId)}</div>
                <div className="col-span-4 text-muted-foreground">{c.name}</div>
                <div className="col-span-2 text-muted-foreground">{c.rateType.replace("_", " ")}</div>
                <div className="col-span-2 text-muted-foreground">${Math.round(c.rateUsd).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
