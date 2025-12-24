"use client";

import * as React from "react";

import { AdminOpsMap, type OpsLoad, type OpsTruck } from "@/components/admin/admin-ops-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

type OpsApiResponse = {
  ok: boolean;
  trucks: any[];
  loads: any[];
};

function asTruckStatus(v: any): OpsTruck["status"] {
  return v === "active" || v === "idle" || v === "maintenance" ? v : "idle";
}

function asLoadStatus(v: any): OpsLoad["status"] {
  return v === "planned" || v === "in_transit" || v === "delayed" || v === "delivered"
    ? v
    : "planned";
}

function toOpsTruck(doc: any): OpsTruck {
  const id = String(doc?.id ?? doc?._id ?? "");
  const name = String(doc?.name ?? doc?.unitNumber ?? doc?.label ?? id);
  const fuelPct = Number(doc?.fuelPct ?? doc?.fuelPercent ?? doc?.fuel?.pct ?? 0);

  const lat = Number(doc?.lat ?? doc?.location?.lat ?? doc?.lastLocation?.lat ?? 0);
  const lng = Number(doc?.lng ?? doc?.location?.lng ?? doc?.lastLocation?.lng ?? 0);

  return {
    id,
    name,
    status: asTruckStatus(doc?.status),
    fuelPct: Number.isFinite(fuelPct) ? Math.max(0, Math.min(100, fuelPct)) : 0,
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    driverUserId: doc?.driverUserId ? String(doc.driverUserId) : undefined,
    driverName: doc?.driverName ? String(doc.driverName) : undefined,
    currentLoadId: doc?.currentLoadId ? String(doc.currentLoadId) : undefined,
  };
}

function toOpsLoad(doc: any): OpsLoad {
  const id = String(doc?.id ?? doc?._id ?? "");

  const pickup = String(
    doc?.pickup ??
      doc?.pickupLocation ??
      doc?.origin ??
      doc?.stops?.[0]?.location ??
      ""
  );
  const dropoff = String(
    doc?.dropoff ??
      doc?.dropoffLocation ??
      doc?.destination ??
      doc?.stops?.[doc?.stops?.length - 1]?.location ??
      ""
  );

  const etaHours = Number(doc?.etaHours ?? doc?.eta?.hours ?? doc?.eta_hours ?? 0);
  const revenueUsd = Number(doc?.revenueUsd ?? doc?.revenue?.usd ?? doc?.revenue_usd ?? 0);

  return {
    id,
    status: asLoadStatus(doc?.status),
    pickup: pickup || "—",
    dropoff: dropoff || "—",
    etaHours: Number.isFinite(etaHours) ? etaHours : 0,
    revenueUsd: Number.isFinite(revenueUsd) ? revenueUsd : 0,
  };
}

export function AdminOpsDashboard({
}: {}) {
  const fallbackTrucks: OpsTruck[] = React.useMemo(
    () => [
      {
        id: "t-101",
        name: "TM-101",
        status: "active",
        fuelPct: 62,
        lat: 29.7604,
        lng: -95.3698,
        driverName: "A. Driver",
        currentLoadId: "l-901",
      },
      {
        id: "t-102",
        name: "TM-102",
        status: "idle",
        fuelPct: 41,
        lat: 32.7767,
        lng: -96.797,
        driverName: "B. Driver",
      },
      {
        id: "t-103",
        name: "TM-103",
        status: "maintenance",
        fuelPct: 12,
        lat: 30.2672,
        lng: -97.7431,
      },
      {
        id: "t-104",
        name: "TM-104",
        status: "active",
        fuelPct: 24,
        lat: 29.9511,
        lng: -90.0715,
        driverName: "C. Driver",
        currentLoadId: "l-902",
      },
    ],
    []
  );

  const fallbackLoads: OpsLoad[] = React.useMemo(
    () => [
      {
        id: "l-901",
        status: "in_transit",
        pickup: "Houston, TX",
        dropoff: "San Antonio, TX",
        etaHours: 4,
        revenueUsd: 1650,
      },
      {
        id: "l-902",
        status: "delayed",
        pickup: "New Orleans, LA",
        dropoff: "Baton Rouge, LA",
        etaHours: 2,
        revenueUsd: 980,
      },
      {
        id: "l-903",
        status: "planned",
        pickup: "Dallas, TX",
        dropoff: "Austin, TX",
        etaHours: 3,
        revenueUsd: 1200,
      },
    ],
    []
  );

  const [trucks, setTrucks] = React.useState<OpsTruck[]>(fallbackTrucks);
  const [loads, setLoads] = React.useState<OpsLoad[]>(fallbackLoads);
  const [selectedTruckId, setSelectedTruckId] = React.useState<string | null>(
    fallbackTrucks[0]?.id ?? null
  );

  React.useEffect(() => {
    const ac = new AbortController();

    async function loadOps() {
      try {
        const res = await fetch("/api/admin/ops", {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as OpsApiResponse;
        if (!data?.ok) return;

        const nextTrucks = Array.isArray(data.trucks)
          ? data.trucks.map(toOpsTruck).filter((t) => Boolean(t.id))
          : [];
        const nextLoads = Array.isArray(data.loads)
          ? data.loads.map(toOpsLoad).filter((l) => Boolean(l.id))
          : [];

        if (nextTrucks.length > 0) {
          setTrucks(nextTrucks);
          setSelectedTruckId((prev) =>
            prev && nextTrucks.some((t) => t.id === prev) ? prev : nextTrucks[0].id
          );
        }
        if (nextLoads.length > 0) {
          setLoads(nextLoads);
        }
      } catch {
        // ignore
      }
    }

    loadOps();
    return () => ac.abort();
  }, []);

  const kpis = React.useMemo(() => {
    const activeTrucks = trucks.filter((t) => t.status === "active").length;
    const maintenanceTrucks = trucks.filter((t) => t.status === "maintenance").length;
    const inTransit = loads.filter((l) => l.status === "in_transit").length;
    const delayed = loads.filter((l) => l.status === "delayed").length;

    const revenueWeek = loads.reduce((sum, l) => sum + l.revenueUsd, 0);
    const fuelSpendWeek = Math.round(revenueWeek * 0.18);

    return {
      activeTrucks,
      maintenanceTrucks,
      inTransit,
      delayed,
      revenueWeek,
      fuelSpendWeek,
    };
  }, [loads, trucks]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="rounded-lg border border-border/60 bg-card p-4 md:col-span-2">
          <div className="text-xs font-semibold text-muted-foreground">Active Loads</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold tracking-tight">{kpis.inTransit}</div>
            <Badge variant={kpis.delayed > 0 ? "destructive" : "outline"}>
              {kpis.delayed > 0 ? `${kpis.delayed} delayed` : "No delays"}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-4 md:col-span-2">
          <div className="text-xs font-semibold text-muted-foreground">Fleet Status</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-2xl font-semibold tracking-tight">{kpis.activeTrucks}</div>
            <Badge variant={kpis.maintenanceTrucks > 0 ? "destructive" : "outline"}>
              {kpis.maintenanceTrucks > 0
                ? `${kpis.maintenanceTrucks} maint.`
                : "All clear"}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-4 md:col-span-1">
          <div className="text-xs font-semibold text-muted-foreground">Fuel (wk)</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{money(kpis.fuelSpendWeek)}</div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-4 md:col-span-1">
          <div className="text-xs font-semibold text-muted-foreground">Revenue (wk)</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{money(kpis.revenueWeek)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AdminOpsMap
            trucks={trucks}
            loads={loads}
            selectedTruckId={selectedTruckId}
            onSelectTruck={setSelectedTruckId}
          />
        </div>

        <div className="grid gap-6 lg:col-span-4">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-tight">Fleet</div>
              <Button asChild variant="outline" size="sm">
                <a href="/admin/drivers">Drivers</a>
              </Button>
            </div>
            <div className="mt-4 grid gap-2">
              {trucks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTruckId(t.id)}
                  className={
                    "flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40 " +
                    (t.id === selectedTruckId ? "bg-accent/35" : "bg-background/20")
                  }
                >
                  <div className="grid">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {driverLabel(t)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        t.status === "maintenance" || t.fuelPct < 15
                          ? "destructive"
                          : t.status === "active"
                            ? "default"
                            : "outline"
                      }
                    >
                      {t.status}
                    </Badge>
                    <Badge variant={t.fuelPct < 15 ? "destructive" : "outline"}>
                      {t.fuelPct}%
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="text-sm font-semibold tracking-tight">Loads</div>
            <div className="mt-4 grid gap-2">
              {loads.map((l) => (
                <div
                  key={l.id}
                  className="rounded-md border border-border/60 bg-background/20 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">
                      {l.pickup} → {l.dropoff}
                    </div>
                    <Badge
                      variant={
                        l.status === "delayed"
                          ? "destructive"
                          : l.status === "in_transit"
                            ? "default"
                            : l.status === "planned"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {l.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ETA {l.etaHours}h · {money(l.revenueUsd)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
