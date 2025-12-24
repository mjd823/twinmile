"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";

function shortId(id: string) {
  const s = String(id ?? "");
  return s.length >= 6 ? s.slice(-6) : s;
}

function driverLabel(t: { driverUserId?: string; driverName?: string }) {
  const id = t.driverUserId ? String(t.driverUserId) : "";
  const name = t.driverName ? String(t.driverName) : "";
  if (!id) return name ? name : "Unassigned";
  return `#${shortId(id)} ${name || "Driver"}`;
}

export type OpsTruck = {
  id: string;
  name: string;
  status: "active" | "idle" | "maintenance";
  fuelPct: number;
  lat: number;
  lng: number;
  driverUserId?: string;
  driverName?: string;
  currentLoadId?: string;
};

export type OpsLoad = {
  id: string;
  status: "planned" | "in_transit" | "delayed" | "delivered";
  pickup: string;
  dropoff: string;
  etaHours: number;
  revenueUsd: number;
};

function statusVariant(status: OpsLoad["status"] | OpsTruck["status"]) {
  switch (status) {
    case "active":
    case "in_transit":
      return "default";
    case "idle":
    case "planned":
      return "secondary";
    case "maintenance":
    case "delayed":
      return "destructive";
    case "delivered":
      return "outline";
    default:
      return "secondary";
  }
}

export function AdminOpsMap({
  trucks,
  loads,
  selectedTruckId,
  onSelectTruck,
}: {
  trucks: OpsTruck[];
  loads: OpsLoad[];
  selectedTruckId: string | null;
  onSelectTruck: (truckId: string) => void;
}) {
  const selectedTruck = selectedTruckId
    ? trucks.find((t) => t.id === selectedTruckId) ?? null
    : null;

  const selectedLoad = selectedTruck?.currentLoadId
    ? loads.find((l) => l.id === selectedTruck.currentLoadId) ?? null
    : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-tight">Operations Map</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="default">Active</Badge>
          <Badge variant="secondary">Idle</Badge>
          <Badge variant="destructive">Issues</Badge>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="h-[360px] w-full bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.6)_1px,transparent_0)] [background-size:24px_24px]">
          <div className="absolute inset-0 bg-gradient-to-br from-background/10 via-background/0 to-background/15" />
          <div className="absolute left-4 top-4 z-10 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            Map placeholder (Phase A). Phase C will sync GPS + routes.
          </div>

          <div className="absolute inset-0 z-10">
            {trucks.map((t, idx) => {
              const x = 12 + ((idx * 19) % 78);
              const y = 18 + ((idx * 23) % 68);
              const selected = t.id === selectedTruckId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTruck(t.id)}
                  className={
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (selected
                      ? "h-4 w-4 bg-primary"
                      : t.status === "maintenance" || t.fuelPct < 15
                        ? "h-3.5 w-3.5 bg-destructive"
                        : t.status === "active"
                          ? "h-3.5 w-3.5 bg-primary/90"
                          : "h-3.5 w-3.5 bg-muted-foreground/70")
                  }
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-label={`Select ${t.name}`}
                />
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 p-4">
          {!selectedTruck ? (
            <div className="text-sm text-muted-foreground">
              Select a truck to view route, fuel, and load details.
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <div className="text-sm font-semibold tracking-tight">{selectedTruck.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedTruck.driverUserId || selectedTruck.driverName
                      ? `Driver: ${driverLabel(selectedTruck)}`
                      : "No driver assigned"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(selectedTruck.status)}>
                    {selectedTruck.status.replace("_", " ")}
                  </Badge>
                  <Badge variant={selectedTruck.fuelPct < 15 ? "destructive" : "outline"}>
                    Fuel {selectedTruck.fuelPct}%
                  </Badge>
                </div>
              </div>

              {selectedLoad ? (
                <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-muted-foreground">Current Load</div>
                    <Badge variant={statusVariant(selectedLoad.status)}>
                      {selectedLoad.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">{selectedLoad.pickup}</span> → {selectedLoad.dropoff}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ETA: {selectedLoad.etaHours}h · Revenue: ${selectedLoad.revenueUsd.toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No load assigned.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
