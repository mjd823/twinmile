"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TruckOption = { id: string; name: string };

type LoadOption = { id: string; label: string };

type RouteEventRow = {
  id: string;
  at: string;
  name: string;
  message: string;
  truckId?: string;
  loadId?: string;
};

export function AdminRouteEventsForm({
  trucks,
  loads,
  routeEvents,
}: {
  trucks: TruckOption[];
  loads: LoadOption[];
  routeEvents: RouteEventRow[];
}) {
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      at: String(formData.get("at") ?? "") || undefined,
      name: String(formData.get("name") ?? "note"),
      message: String(formData.get("message") ?? ""),
      truckId: String(formData.get("truckId") ?? "") || undefined,
      loadId: String(formData.get("loadId") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/route-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to create event.");
        return;
      }

      setStatus("Event created. Reload the page to see it in the list.");
      e.currentTarget.reset();
    } catch {
      setStatus("Unable to create event.");
    } finally {
      setSubmitting(false);
    }
  }

  function truckName(truckId?: string) {
    if (!truckId) return "—";
    return trucks.find((t) => t.id === truckId)?.name ?? "—";
  }

  function loadLabel(loadId?: string) {
    if (!loadId) return "—";
    return loads.find((l) => l.id === loadId)?.label ?? "—";
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Create route event</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Add notes/status changes to the ops timeline.
        </div>

        <form onSubmit={onCreate} className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="at">At (optional)</label>
              <Input id="at" name="at" placeholder="2025-12-24T03:55:00Z" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="name">Type</label>
              <select
                id="name"
                name="name"
                className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                defaultValue="note"
              >
                <option value="note">Note</option>
                <option value="status">Status</option>
                <option value="dispatch">Dispatch</option>
                <option value="delay">Delay</option>
                <option value="fuel">Fuel</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="truckId">Truck (optional)</label>
              <select
                id="truckId"
                name="truckId"
                className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                defaultValue=""
              >
                <option value="">Unassigned</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="loadId">Load (optional)</label>
              <select
                id="loadId"
                name="loadId"
                className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                defaultValue=""
              >
                <option value="">Unassigned</option>
                {loads.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="message">Message</label>
            <Textarea id="message" name="message" required />
          </div>

          <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save event"}</Button>
          {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Recent events</div>
        <div className="mt-2 text-sm text-muted-foreground">Latest timeline items.</div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Truck</div>
            <div className="col-span-3">Load</div>
            <div className="col-span-4">Message</div>
          </div>
          {routeEvents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No events yet.</div>
          ) : (
            routeEvents.map((e) => (
              <div key={e.id} className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm">
                <div className="col-span-2 text-muted-foreground">{e.name}</div>
                <div className="col-span-3 text-muted-foreground">{truckName(e.truckId)}</div>
                <div className="col-span-3 text-muted-foreground">{loadLabel(e.loadId)}</div>
                <div className="col-span-4 font-medium">{e.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
