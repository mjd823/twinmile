"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TruckOption = { id: string; name: string };

type MaintenanceLogRow = {
  id: string;
  truckId: string;
  at: string;
  kind: string;
  costUsd: number;
  notes?: string;
};

export function AdminMaintenanceForm({
  trucks,
  maintenanceLogs,
}: {
  trucks: TruckOption[];
  maintenanceLogs: MaintenanceLogRow[];
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
      kind: String(formData.get("kind") ?? ""),
      costUsd: Number(formData.get("costUsd") ?? 0),
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/maintenance-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to log maintenance.");
        return;
      }

      setStatus("Maintenance log created. Reload the page to see it in the list.");
      e.currentTarget.reset();
    } catch {
      setStatus("Unable to log maintenance.");
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
        <div className="text-lg font-semibold tracking-tight">Log maintenance</div>
        <div className="mt-2 text-sm text-muted-foreground">Record a maintenance event.</div>

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
              <label className="text-sm font-medium" htmlFor="costUsd">Cost ($)</label>
              <Input id="costUsd" name="costUsd" type="number" min={0} step="any" defaultValue={0} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="kind">Type</label>
            <Input id="kind" name="kind" placeholder="Oil change" required />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="notes">Notes</label>
            <Textarea id="notes" name="notes" />
          </div>

          <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save maintenance"}</Button>
          {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Maintenance logs</div>
        <div className="mt-2 text-sm text-muted-foreground">Recent entries.</div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-4">Truck</div>
            <div className="col-span-4">Type</div>
            <div className="col-span-2">Cost</div>
            <div className="col-span-2">At</div>
          </div>
          {maintenanceLogs.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No maintenance logs yet.</div>
          ) : (
            maintenanceLogs.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm">
                <div className="col-span-4 font-medium">{truckName(l.truckId)}</div>
                <div className="col-span-4 text-muted-foreground">{l.kind}</div>
                <div className="col-span-2 text-muted-foreground">${Math.round(l.costUsd).toLocaleString()}</div>
                <div className="col-span-2 text-muted-foreground">{l.at ? l.at.slice(0, 10) : ""}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
