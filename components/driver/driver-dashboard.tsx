"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DriverOpsResponse = {
  ok: boolean;
  driver: { email: string; firstName?: string; lastName?: string; isOwnerOperator?: boolean };
  truck: any | null;
  currentLoad: any | null;
  fuelLogs: any[];
  maintenanceLogs: any[];
  routeEvents: any[];
};

function fullName(d: { firstName?: string; lastName?: string; email: string }) {
  const name = `${String(d.firstName ?? "").trim()} ${String(d.lastName ?? "").trim()}`.trim();
  return name || d.email;
}

function money(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "$0";
  return `$${Math.round(v).toLocaleString()}`;
}

export function DriverDashboard() {
  const [data, setData] = React.useState<DriverOpsResponse | null>(null);

  React.useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/driver/ops", {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as DriverOpsResponse;
        if (!json?.ok) return;
        setData(json);
      } catch {
        // ignore
      }
    }

    load();
    return () => ac.abort();
  }, []);

  const truckName = data?.truck?.name ? String(data.truck.name) : "Unassigned";
  const fuelPct = Number(data?.truck?.fuelPct ?? 0);
  const load = data?.currentLoad;
  const who = data?.driver ? fullName(data.driver as any) : "";
  const ownerOp = Boolean((data?.driver as any)?.isOwnerOperator);

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">My Truck</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{truckName}</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {who ? who : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={Number.isFinite(fuelPct) && fuelPct < 15 ? "destructive" : "outline"}>
              Fuel {Number.isFinite(fuelPct) ? fuelPct : 0}%
            </Badge>
            <Badge variant="outline">{ownerOp ? "Owner-op" : "Company"}</Badge>
            <Button asChild variant="outline" size="sm">
              <a href="/driver/settings/profile">Profile</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/driver/settings/password">Password</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Current Load</div>
            <div className="mt-2 text-lg font-semibold tracking-tight">
              {load ? `${String(load.pickup ?? "—")} → ${String(load.dropoff ?? "—")}` : "No load assigned"}
            </div>
            {load ? (
              <div className="mt-2 text-sm text-muted-foreground">
                Status: {String(load.status ?? "planned").replace("_", " ")}
                {" · "}ETA {Number(load.etaHours ?? 0)}h{" · "}Revenue {money(load.revenueUsd)}
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                Ask dispatch to assign you a load.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-sm font-semibold tracking-tight">Recent events</div>
          <div className="mt-4 grid gap-3">
            {(data?.routeEvents ?? []).slice(0, 6).map((e: any) => (
              <div key={String(e.id ?? e._id)} className="rounded-lg border border-border/60 bg-background/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {String(e.name ?? "note").toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.at ? String(e.at).slice(0, 16).replace("T", " ") : ""}
                  </div>
                </div>
                <div className="mt-2 text-sm">{String(e.message ?? "")}</div>
              </div>
            ))}
            {(data?.routeEvents ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No events yet.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-sm font-semibold tracking-tight">Fuel & Maintenance</div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-border/60 bg-background/30 p-3">
              <div className="text-xs font-semibold text-muted-foreground">Fuel logs</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {(data?.fuelLogs?.length ?? 0) > 0
                  ? `${data?.fuelLogs?.length} recent entries`
                  : "No fuel logs yet."}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/30 p-3">
              <div className="text-xs font-semibold text-muted-foreground">Maintenance logs</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {(data?.maintenanceLogs?.length ?? 0) > 0
                  ? `${data?.maintenanceLogs?.length} recent entries`
                  : "No maintenance logs yet."}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              This portal is mobile-first. Next: documents, checklists, and load confirmations.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
