"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecruitingCoverageMap } from "@/components/admin/recruiting-coverage-map";
import type { RecruitingCoverage } from "@/lib/recruiting-coverage";
import { getAdminOpsAction } from "@/app/actions/admin";

/**
 * Operations dashboard — every number on this page is real:
 *  - the map is recruiting coverage from actual FMCSA prospect locations
 *    (replaces the "Map placeholder (Phase A)" with fake index-positioned
 *    truck dots)
 *  - fleet + loads come straight from their collections, with honest empty
 *    states (the old Revenue/Fuel KPIs were computed from an EMPTY loads
 *    collection — fuel was literally revenue × 0.18 — and are gone)
 *  - truck GPS is stated as not connected instead of pretended
 */

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
  driverUserId?: string;
  driverName?: string;
};

export type OpsLoad = {
  id: string;
  status: "planned" | "in_transit" | "delayed" | "delivered";
  pickup: string;
  dropoff: string;
};

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
  return {
    id,
    name,
    status: asTruckStatus(doc?.status),
    fuelPct: Number.isFinite(fuelPct) ? Math.max(0, Math.min(100, fuelPct)) : 0,
    driverUserId: doc?.driverUserId ? String(doc.driverUserId) : undefined,
    driverName: doc?.driverName ? String(doc.driverName) : undefined,
  };
}

function toOpsLoad(doc: any): OpsLoad {
  const id = String(doc?.id ?? doc?._id ?? "");
  const pickup = String(
    doc?.pickup ?? doc?.pickupLocation ?? doc?.origin ?? doc?.stops?.[0]?.location ?? ""
  );
  const dropoff = String(
    doc?.dropoff ??
      doc?.dropoffLocation ??
      doc?.destination ??
      doc?.stops?.[doc?.stops?.length - 1]?.location ??
      ""
  );
  return {
    id,
    status: asLoadStatus(doc?.status),
    pickup: pickup || "—",
    dropoff: dropoff || "—",
  };
}

function Kpi({
  label,
  value,
  sub,
  badge,
  badgeVariant = "outline",
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  badgeVariant?: "outline" | "destructive" | "default";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>
    </div>
  );
}

export function AdminOpsDashboard({ coverage }: { coverage: RecruitingCoverage }) {
  const [trucks, setTrucks] = React.useState<OpsTruck[]>([]);
  const [loads, setLoads] = React.useState<OpsLoad[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function loadOps() {
      try {
        const data = (await getAdminOpsAction()) as OpsApiResponse;
        if (cancelled || !data?.ok) return;
        setTrucks(
          Array.isArray(data.trucks)
            ? data.trucks.map(toOpsTruck).filter((t) => Boolean(t.id))
            : []
        );
        setLoads(
          Array.isArray(data.loads)
            ? data.loads.map(toOpsLoad).filter((l) => Boolean(l.id))
            : []
        );
      } catch {
        // ignore — honest empty states below
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadOps();
    return () => {
      cancelled = true;
    };
  }, []);

  const maintenanceTrucks = trucks.filter((t) => t.status === "maintenance").length;
  const inTransit = loads.filter((l) => l.status === "in_transit").length;
  const delayed = loads.filter((l) => l.status === "delayed").length;

  return (
    <div className="grid gap-6">
      {/* KPIs — all real, no derived make-believe */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Recruiting reach"
          value={coverage.totals.statesCovered.toLocaleString()}
          sub={`states · ${coverage.totals.prospects.toLocaleString()} prospects`}
        />
        <Kpi
          label="Qualified (score 75+)"
          value={coverage.totals.qualified.toLocaleString()}
          sub={`${coverage.totals.invited.toLocaleString()} invited so far`}
        />
        <Kpi
          label="Fleet"
          value={isLoading ? "…" : trucks.length.toLocaleString()}
          sub={trucks.length === 1 ? "truck" : "trucks"}
          badge={
            isLoading
              ? undefined
              : maintenanceTrucks > 0
                ? `${maintenanceTrucks} in maintenance`
                : trucks.length > 0
                  ? "All clear"
                  : undefined
          }
          badgeVariant={maintenanceTrucks > 0 ? "destructive" : "outline"}
        />
        <Kpi
          label="Active loads"
          value={isLoading ? "…" : inTransit.toLocaleString()}
          sub={
            isLoading
              ? undefined
              : loads.length === 0
                ? "No loads tracked yet"
                : `${loads.length} total`
          }
          badge={!isLoading && delayed > 0 ? `${delayed} delayed` : undefined}
          badgeVariant="destructive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* THE map — real recruiting coverage */}
        <div className="lg:col-span-8">
          <RecruitingCoverageMap coverage={coverage} />
        </div>

        {/* Fleet — real trucks, honest about what isn't tracked */}
        <div className="grid content-start gap-6 lg:col-span-4">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-tight">Fleet</div>
              <Button asChild variant="outline" size="sm">
                <a href="/admin/drivers">Drivers</a>
              </Button>
            </div>
            <div className="mt-4 grid gap-2">
              {isLoading ? (
                <div className="h-12 animate-pulse rounded-md bg-muted" />
              ) : trucks.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No trucks in fleet</p>
                  <p className="mt-1 text-xs">Add trucks from the Fleet page</p>
                </div>
              ) : (
                trucks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/20 px-3 py-2 text-sm"
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
                      <Badge variant={t.fuelPct < 15 ? "destructive" : "outline"}>
                        {t.fuelPct}%
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="mt-3 border-t border-border/50 pt-3 text-[11px] leading-relaxed text-muted-foreground">
              Straight talk: truck GPS isn&apos;t connected, so there is no live truck map —
              that needs a telematics device in each truck. The map here shows the recruiting
              operation instead, from real FMCSA prospect locations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
