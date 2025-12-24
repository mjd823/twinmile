"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TruckOption = { id: string; name: string };

type FuelLogRow = {
  id: string;
  truckId: string;
  at: string;
  gallons: number;
  costUsd: number;
  odometer: number | null;
  notes?: string;
};

export function AdminFuelForm({
  trucks,
  fuelLogs,
}: {
  trucks: TruckOption[];
  fuelLogs: FuelLogRow[];
}) {
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      truckId: String(formData.get("truckId") ?? ""),
      at: String(formData.get("at") ?? "") || undefined,
      gallons: Number(formData.get("gallons") ?? 0),
      costUsd: Number(formData.get("costUsd") ?? 0),
      odometer: formData.get("odometer") ? Number(formData.get("odometer")) : undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/fuel-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to log fuel.");
        return;
      }

      setStatus("Fuel log created. Reload the page to see it in the list.");
      e.currentTarget.reset();
    } catch {
      setStatus("Unable to log fuel.");
    } finally {
      setSubmitting(false);
    }
  }

  function truckName(truckId: string) {
    return trucks.find((t) => t.id === truckId)?.name ?? "—";
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Log fuel</div>
        <div className="mt-2 text-sm text-muted-foreground">Record a fuel purchase/refuel.</div>

        <form onSubmit={onCreate} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="truckId">Truck</label>
            <select
              id="truckId"
              name="truckId"
              className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
              defaultValue={trucks[0]?.id ?? ""}
              required
            >
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="at">At (optional)</label>
              <Input id="at" name="at" placeholder="2025-12-24T03:55:00Z" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="odometer">Odometer (optional)</label>
              <Input id="odometer" name="odometer" type="number" min={0} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="gallons">Gallons</label>
              <Input id="gallons" name="gallons" type="number" min={0} step="any" defaultValue={0} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="costUsd">Cost ($)</label>
              <Input id="costUsd" name="costUsd" type="number" min={0} step="any" defaultValue={0} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="notes">Notes</label>
            <Textarea id="notes" name="notes" />
          </div>

          <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save fuel log"}</Button>
          {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Fuel logs</div>
        <div className="mt-2 text-sm text-muted-foreground">Recent entries.</div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-4">Truck</div>
            <div className="col-span-3">Gallons</div>
            <div className="col-span-3">Cost</div>
            <div className="col-span-2">At</div>
          </div>
          {fuelLogs.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No fuel logs yet.</div>
          ) : (
            fuelLogs.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm">
                <div className="col-span-4 font-medium">{truckName(l.truckId)}</div>
                <div className="col-span-3 text-muted-foreground">{l.gallons}</div>
                <div className="col-span-3 text-muted-foreground">${Math.round(l.costUsd).toLocaleString()}</div>
                <div className="col-span-2 text-muted-foreground">{l.at ? l.at.slice(0, 10) : ""}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
