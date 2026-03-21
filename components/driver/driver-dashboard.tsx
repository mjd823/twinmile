"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getDriverOpsAction,
  updateLoadStatusAction,
  getDriverLoadHistoryAction,
  getDriverSettlementsAction,
} from "@/app/actions/driver";

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
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  accepted: "Accepted",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const NEXT_ACTION: Record<string, { label: string; status: string; color: string }> = {
  planned: { label: "Accept Load", status: "accepted", color: "bg-blue-600 hover:bg-blue-700" },
  accepted: { label: "Mark Picked Up", status: "picked_up", color: "bg-amber-600 hover:bg-amber-700" },
  picked_up: { label: "Start Transit", status: "in_transit", color: "bg-purple-600 hover:bg-purple-700" },
  in_transit: { label: "Mark Delivered", status: "delivered", color: "bg-green-600 hover:bg-green-700" },
};

type Tab = "overview" | "history" | "earnings";

export function DriverDashboard() {
  const [data, setData] = React.useState<DriverOpsResponse | null>(null);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [loadHistory, setLoadHistory] = React.useState<any[] | null>(null);
  const [settlements, setSettlements] = React.useState<{
    list: any[];
    weekTotal: number;
    ytdTotal: number;
  } | null>(null);

  async function reload() {
    try {
      const result = await getDriverOpsAction();
      if (result.ok) setData(result as any);
    } catch { /* ignore */ }
  }

  React.useEffect(() => {
    reload();
  }, []);

  React.useEffect(() => {
    if (tab === "history" && !loadHistory) {
      getDriverLoadHistoryAction().then((r) => {
        if (r.ok) setLoadHistory(r.loads);
      }).catch(() => {});
    }
    if (tab === "earnings" && !settlements) {
      getDriverSettlementsAction().then((r) => {
        if (r.ok) setSettlements({ list: r.settlements, weekTotal: r.currentWeekTotal, ytdTotal: r.ytdTotal });
      }).catch(() => {});
    }
  }, [tab, loadHistory, settlements]);

  async function handleStatusUpdate(loadId: string, newStatus: string) {
    setBusy(true);
    setStatusMsg(null);
    const result = await updateLoadStatusAction({
      loadId,
      newStatus,
      note: note.trim() || undefined,
    });
    if (result.ok) {
      setStatusMsg("Updated.");
      setNote("");
      await reload();
      // Refresh history/settlements if on those tabs
      if (tab === "history") {
        getDriverLoadHistoryAction().then((r) => { if (r.ok) setLoadHistory(r.loads); }).catch(() => {});
      }
      if (tab === "earnings") {
        getDriverSettlementsAction().then((r) => {
          if (r.ok) setSettlements({ list: r.settlements, weekTotal: r.currentWeekTotal, ytdTotal: r.ytdTotal });
        }).catch(() => {});
      }
    } else {
      setStatusMsg(result.error || "Unable to update.");
    }
    setBusy(false);
  }

  const truckName = data?.truck?.name ? String(data.truck.name) : "Unassigned";
  const fuelPct = Number(data?.truck?.fuelPct ?? 0);
  const currentLoad = data?.currentLoad;
  const who = data?.driver ? fullName(data.driver as any) : "";
  const ownerOp = Boolean((data?.driver as any)?.isOwnerOperator);

  const loadStatus = String(currentLoad?.status ?? "planned");
  const nextAction = NEXT_ACTION[loadStatus];

  return (
    <div className="grid gap-6">
      {/* Truck card */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">My Truck</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{truckName}</div>
            <div className="mt-2 text-sm text-muted-foreground">{who}</div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <Badge className="w-full justify-center" variant={Number.isFinite(fuelPct) && fuelPct < 15 ? "destructive" : "outline"}>
              Fuel {Number.isFinite(fuelPct) ? fuelPct : 0}%
            </Badge>
            <Badge className="w-full justify-center" variant="outline">
              {ownerOp ? "Owner-op" : "Company"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <a href="/driver/settings/profile">Profile</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/driver/settings/password">Password</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
        {(["overview", "history", "earnings"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "overview" ? "Overview" : t === "history" ? "Load History" : "Earnings"}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <>
          {/* Current Load */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="text-xs font-semibold text-muted-foreground">Current Load</div>
            {currentLoad ? (
              <>
                <div className="mt-3 text-lg font-semibold tracking-tight">
                  {String(currentLoad.pickup ?? "—")} → {String(currentLoad.dropoff ?? "—")}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">
                    {STATUS_LABELS[loadStatus] ?? loadStatus}
                  </Badge>
                  <span className="text-muted-foreground">
                    ETA {Number(currentLoad.etaHours ?? 0)}h
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium text-primary">
                    Revenue {money(currentLoad.revenueUsd)}
                  </span>
                  {ownerOp && (
                    <span className="text-muted-foreground">
                      (Your share: {money(Number(currentLoad.revenueUsd ?? 0) * 0.8)})
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {nextAction && (
                  <div className="mt-4 space-y-3">
                    {loadStatus === "in_transit" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Delivery note (optional)</label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.currentTarget.value)}
                          maxLength={500}
                          rows={2}
                          placeholder="e.g. Left at dock B, signed by John Smith"
                          className="mt-1 w-full rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        disabled={busy}
                        className={`${nextAction.color} text-white`}
                        onClick={() => handleStatusUpdate(String(currentLoad._id ?? currentLoad.id), nextAction.status)}
                      >
                        {busy ? "Updating…" : nextAction.label}
                      </Button>
                      {statusMsg && (
                        <span className="text-sm text-muted-foreground">{statusMsg}</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                No load assigned. Ask dispatch to assign you a load.
              </div>
            )}
          </div>

          {/* Events + Fuel */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="text-sm font-semibold tracking-tight">Recent Events</div>
              <div className="mt-4 grid gap-3">
                {(data?.routeEvents ?? []).slice(0, 8).map((e: any) => (
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
                {(data?.routeEvents ?? []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No events yet.</div>
                )}
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
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab: Load History */}
      {tab === "history" && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-sm font-semibold tracking-tight">Completed Loads</div>
          {!loadHistory ? (
            <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
          ) : loadHistory.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No completed loads yet.</div>
          ) : (
            <div className="mt-4 grid gap-3">
              {loadHistory.map((l: any) => (
                <div key={String(l._id ?? l.id)} className="rounded-lg border border-border/60 bg-background/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-sm">
                      {String(l.pickup ?? "—")} → {String(l.dropoff ?? "—")}
                    </div>
                    <Badge variant="outline" className="text-[10px]">Delivered</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Revenue: {money(l.revenueUsd)}</span>
                    {ownerOp && <span>Your share: {money(Number(l.revenueUsd ?? 0) * 0.8)}</span>}
                    {l.deliveredAt && <span>{String(l.deliveredAt).slice(0, 10)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Earnings */}
      {tab === "earnings" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="text-xs font-semibold text-muted-foreground">This Week</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-primary">
                {settlements ? money(settlements.weekTotal) : "…"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">80% gross to you</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="text-xs font-semibold text-muted-foreground">Year to Date</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">
                {settlements ? money(settlements.ytdTotal) : "…"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date().getFullYear()} total earnings</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="text-sm font-semibold tracking-tight">Settlement History</div>
            {!settlements ? (
              <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
            ) : settlements.list.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">No settlements yet. Complete deliveries to see earnings.</div>
            ) : (
              <div className="mt-4 grid gap-2">
                {settlements.list.map((s: any) => (
                  <div key={String(s._id ?? s.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-primary">{money(s.driverPayout)}</span>
                      <span className="text-xs text-muted-foreground">of {money(s.revenueUsd)} gross</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.createdAt ? String(s.createdAt).slice(0, 10) : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
