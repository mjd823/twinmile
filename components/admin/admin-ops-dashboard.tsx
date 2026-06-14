"use client";

import * as React from "react";

import { AdminOpsMap, type OpsLoad, type OpsTruck } from "@/components/admin/admin-ops-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminOpsAction } from "@/app/actions/admin";

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
  const [trucks, setTrucks] = React.useState<OpsTruck[]>([]);
  const [loads, setLoads] = React.useState<OpsLoad[]>([]);
  const [selectedTruckId, setSelectedTruckId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const ac = new AbortController();

    async function loadOps() {
      try {
        if (ac.signal.aborted) return;
        const data = (await getAdminOpsAction()) as OpsApiResponse;
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
      } finally {
        setIsLoading(false);
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

  const selectedTruck = React.useMemo(() => {
    if (!selectedTruckId) return null;
    return trucks.find((t) => t.id === selectedTruckId) ?? null;
  }, [selectedTruckId, trucks]);

  const selectedLoad = React.useMemo(() => {
    const loadId = selectedTruck?.currentLoadId ? String(selectedTruck.currentLoadId) : "";
    if (!loadId) return null;
    return loads.find((l) => l.id === loadId) ?? null;
  }, [loads, selectedTruck?.currentLoadId]);


  if (isLoading) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="aspect-[4/3] rounded-lg border border-border/60 bg-muted animate-pulse" />
          </div>
          <div className="lg:col-span-4">
            <div className="rounded-lg border border-border/60 bg-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
    </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-6">
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
            <div className="mt-4 grid max-h-[52vh] gap-2 overflow-auto pr-1 lg:max-h-none">
              {trucks.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <p className="font-medium">No trucks in fleet</p>
                  <p className="text-sm mt-1">Add trucks from the Fleet page</p>
                </div>
              ) : (
                trucks.map((t) => {
                const isSelected = t.id === selectedTruckId;

                return (
                  <div key={t.id} className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTruckId(t.id)}
                      className={
                        "flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40 " +
                        (isSelected ? "bg-accent/35" : "bg-background/20")
                      }
                    >
                      <div className="grid">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{driverLabel(t)}</div>
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
                        <Badge variant={t.fuelPct < 15 ? "destructive" : "outline"}>{t.fuelPct}%</Badge>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
