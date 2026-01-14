"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  assignDriverToTruckAction,
  createFuelLogAction,
  createLoadAction,
  createMaintenanceLogAction,
  createRouteEventAction,
  createTruckAction,
  deleteTruckAction,
  getTruckOverviewAction,
  updateTruckAction,
} from "@/app/actions/admin";

type DriverOption = { id: string; email: string; firstName?: string; lastName?: string };

function fullName(d: { firstName?: string; lastName?: string; email: string }) {
  const name = `${String(d.firstName ?? "").trim()} ${String(d.lastName ?? "").trim()}`.trim();
  return name || d.email;
}

function shortId(id: string) {
  const s = String(id ?? "");
  return s.length >= 6 ? s.slice(-6) : s;
}

type TruckListItem = {
  id: string;
  name: string;
  status: string;
  fuelPct: number;
  lat?: number | null;
  lng?: number | null;
  driverName?: string;
  driverUserId?: string;
};

type Overview = {
  ok: boolean;
  truck: any;
  driver: any | null;
  currentLoad: any | null;
  fuelLogs: any[];
  maintenanceLogs: any[];
  routeEvents: any[];
};

function money(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "$0";
  return `$${Math.round(v).toLocaleString()}`;
}

function locationLabel(t: { lat?: number | null; lng?: number | null }) {
  if (typeof t.lat !== "number" || typeof t.lng !== "number") return "—";
  return `${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`;
}

function statusBadge(status: string) {
  const s = String(status ?? "");
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  const cls =
    s === "active"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : s === "maintenance"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200";
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

function fuelBadge(fuelPct: number) {
  const v = Number(fuelPct ?? 0);
  const cls =
    Number.isFinite(v) && v < 15
      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
      : Number.isFinite(v) && v < 30
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  return (
    <Badge variant="outline" className={cls}>
      {Number.isFinite(v) ? `${v}%` : "0%"}
    </Badge>
  );
}

export function AdminFleetHub({
  trucks,
  drivers,
}: {
  trucks: TruckListItem[];
  drivers: DriverOption[];
}) {
  const router = useRouter();

  const [rows, setRows] = React.useState<TruckListItem[]>(trucks);
  const [selectedId, setSelectedId] = React.useState<string | null>(trucks[0]?.id ?? null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({
    name: "",
    status: "idle",
    fuelPct: 0,
    lat: "",
    lng: "",
  });
  const [statusPickerOpen, setStatusPickerOpen] = React.useState(false);
  const [driverDraftId, setDriverDraftId] = React.useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);

  const [fuelOpen, setFuelOpen] = React.useState(false);
  const [fuelStatus, setFuelStatus] = React.useState<string | null>(null);

  const [maintenanceOpen, setMaintenanceOpen] = React.useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = React.useState<string | null>(null);

  const [eventOpen, setEventOpen] = React.useState(false);
  const [eventStatus, setEventStatus] = React.useState<string | null>(null);

  const [loadOpen, setLoadOpen] = React.useState(false);
  const [loadStatus, setLoadStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(trucks);
  }, [trucks]);

  function showNotice(msg: string) {
    setNotice(msg);
    setNoticeOpen(true);
  }

  React.useEffect(() => {
    if (!rows.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && rows.some((r) => r.id === selectedId)) return;
    setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  function driverLabelForTruck(t: { driverUserId?: string; driverName?: string }) {
    const driverUserId = t.driverUserId ? String(t.driverUserId) : "";
    if (driverUserId) {
      const d = drivers.find((x) => String(x.id) === driverUserId);
      if (d) return `#${shortId(driverUserId)} ${fullName(d)}`;
      return `#${shortId(driverUserId)} ${t.driverName || "Driver"}`;
    }
    return "Unassigned";
  }

  React.useEffect(() => {
    if (!selectedId) return;
    const id = selectedId;
    const ac = new AbortController();

    async function load() {
      setStatus(null);
      setOverview(null);
      try {
        if (ac.signal.aborted) return;
        const data = await getTruckOverviewAction(id);
        if (!data.ok) {
          setStatus(data.error ?? "Unable to load truck.");
          return;
        }
        setOverview(data as Overview);
      } catch {
        // ignore
      }
    }

    load();
    return () => ac.abort();
  }, [selectedId]);

  React.useEffect(() => {
    setDeleteConfirm(false);
    setFuelOpen(false);
    setMaintenanceOpen(false);
    setEventOpen(false);
    setLoadOpen(false);
    setFuelStatus(null);
    setMaintenanceStatus(null);
    setEventStatus(null);
    setLoadStatus(null);
  }, [selectedId]);

  React.useEffect(() => {
    if (!overview?.truck) return;
    setEditDraft({
      name: String(overview.truck.name ?? ""),
      status: String(overview.truck.status ?? "idle"),
      fuelPct: Number(overview.truck.fuelPct ?? 0),
      lat: overview.truck.lat == null ? "" : String(overview.truck.lat),
      lng: overview.truck.lng == null ? "" : String(overview.truck.lng),
    });
    setDriverDraftId(overview.truck.driverUserId ? String(overview.truck.driverUserId) : "");
  }, [overview?.truck]);

  async function saveTruckEdits(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;

    setBusy(true);
    setStatus(null);
    try {
      const payload: any = {
        name: String(editDraft.name ?? "").trim(),
        status: String(editDraft.status ?? "idle"),
        fuelPct: Number(editDraft.fuelPct ?? 0),
      };

      payload.lat = editDraft.lat.trim() === "" ? null : Number(editDraft.lat);
      payload.lng = editDraft.lng.trim() === "" ? null : Number(editDraft.lng);

      const result = await updateTruckAction(selectedId, payload);
      if (!result.ok) {
        setStatus(result.error ?? "Unable to update truck.");
        return;
      }
      showNotice("Truck updated.");

      setRows((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                name: payload.name,
                status: payload.status,
                fuelPct: payload.fuelPct,
                lat: payload.lat ?? null,
                lng: payload.lng ?? null,
              }
            : t
        )
      );

      router.refresh();

      const odata = await getTruckOverviewAction(selectedId);
      if (odata.ok) setOverview(odata as Overview);
    } catch {
      setStatus("Unable to update truck.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDriverAssignment() {
    const next = driverDraftId ? String(driverDraftId) : null;
    await assignDriver(next);
  }

  async function createLoad(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setLoadStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      status: String(formData.get("status") ?? "planned"),
      pickup: String(formData.get("pickup") ?? ""),
      dropoff: String(formData.get("dropoff") ?? ""),
      etaHours: Number(formData.get("etaHours") ?? 0),
      revenueUsd: Number(formData.get("revenueUsd") ?? 0),
      truckId: selectedId,
    };

    try {
      const data = await createLoadAction(payload);
      if (!data.ok) {
        setLoadStatus(data.error ?? "Unable to create load.");
        return;
      }

      const odata = await getTruckOverviewAction(selectedId);
      if (odata.ok) setOverview(odata as Overview);

      router.refresh();
      showNotice("Load created.");
      e.currentTarget.reset();
      setLoadOpen(false);
    } catch {
      setLoadStatus("Unable to create load.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTruck() {
    if (!selectedId) return;
    setBusy(true);
    setStatus(null);
    try {
      const data = await deleteTruckAction(selectedId);
      if (!data.ok) {
        setStatus(data.error ?? "Unable to delete truck.");
        return;
      }
      showNotice("Truck deleted.");
      setDeleteConfirm(false);

      setRows((prev) => prev.filter((t) => t.id !== selectedId));
      router.refresh();
    } catch {
      setStatus("Unable to delete truck.");
    } finally {
      setBusy(false);
    }
  }

  async function createFuelLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setFuelStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      truckId: selectedId,
      at: String(formData.get("at") ?? "") || undefined,
      gallons: Number(formData.get("gallons") ?? 0),
      costUsd: Number(formData.get("costUsd") ?? 0),
      odometer: formData.get("odometer") ? Number(formData.get("odometer")) : undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    try {
      const data = await createFuelLogAction(payload);
      if (!data.ok) {
        setFuelStatus(data.error ?? "Unable to log fuel.");
        return;
      }
      setFuelStatus("Fuel log created.");
      e.currentTarget.reset();
      setFuelOpen(false);
      setStatus("Fuel log created.");
    } catch {
      setFuelStatus("Unable to log fuel.");
    } finally {
      setBusy(false);
    }
  }

  async function createMaintenanceLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setMaintenanceStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      truckId: selectedId,
      at: String(formData.get("at") ?? "") || undefined,
      kind: String(formData.get("kind") ?? ""),
      costUsd: Number(formData.get("costUsd") ?? 0),
      notes: String(formData.get("notes") ?? "") || undefined,
    };

    try {
      const data = await createMaintenanceLogAction(payload);
      if (!data.ok) {
        setMaintenanceStatus(data.error ?? "Unable to log maintenance.");
        return;
      }
      setMaintenanceStatus("Maintenance log created.");
      e.currentTarget.reset();
      setMaintenanceOpen(false);
      setStatus("Maintenance log created.");
    } catch {
      setMaintenanceStatus("Unable to log maintenance.");
    } finally {
      setBusy(false);
    }
  }

  async function createRouteEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setEventStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      at: String(formData.get("at") ?? "") || undefined,
      name: String(formData.get("name") ?? "note"),
      message: String(formData.get("message") ?? ""),
      truckId: selectedId,
      loadId: currentLoad?.id ? String(currentLoad.id) : undefined,
    };

    try {
      const data = await createRouteEventAction(payload);
      if (!data.ok) {
        setEventStatus(data.error ?? "Unable to create event.");
        return;
      }
      setEventStatus("Event created.");
      e.currentTarget.reset();
      setEventOpen(false);
      setStatus("Event created.");
    } catch {
      setEventStatus("Unable to create event.");
    } finally {
      setBusy(false);
    }
  }

  async function assignDriver(nextDriverUserId: string | null) {
    if (!selectedId) return;
    setBusy(true);
    setStatus(null);
    try {
      const data = await assignDriverToTruckAction(selectedId, { driverUserId: nextDriverUserId });
      if (!data.ok) {
        setStatus(data.error ?? "Unable to assign driver.");
        return;
      }

      const previousTruckForDriver = nextDriverUserId
        ? rows.find((t) => t.id !== selectedId && t.driverUserId === nextDriverUserId)
        : undefined;

      setRows((prev) =>
        prev.map((t) => {
          if (nextDriverUserId && t.id !== selectedId && t.driverUserId === nextDriverUserId) {
            return { ...t, driverUserId: "", driverName: "" };
          }

          if (t.id === selectedId) {
            return {
              ...t,
              driverUserId: nextDriverUserId ?? "",
              driverName: nextDriverUserId
                ? fullName(drivers.find((d) => d.id === nextDriverUserId) ?? { email: t.driverName || "" })
                : "",
            };
          }

          return t;
        })
      );

      const odata = await getTruckOverviewAction(selectedId);
      if (odata.ok) setOverview(odata as Overview);

      router.refresh();
      if (previousTruckForDriver?.name && nextDriverUserId) {
        showNotice(`Driver moved from ${previousTruckForDriver.name} to this truck.`);
      } else {
        showNotice("Driver assignment updated.");
      }
    } catch {
      setStatus("Unable to assign driver.");
    } finally {
      setBusy(false);
    }
  }

  async function createTruck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      status: String(formData.get("status") ?? "idle"),
      fuelPct: Number(formData.get("fuelPct") ?? 0),
      lat: formData.get("lat") ? Number(formData.get("lat")) : undefined,
      lng: formData.get("lng") ? Number(formData.get("lng")) : undefined,
      driverUserId: formData.get("driverUserId") ? String(formData.get("driverUserId")) : undefined,
    };

    try {
      const data = await createTruckAction(payload);
      if (!data.ok) {
        setCreateStatus(data.error ?? "Unable to create truck.");
        return;
      }
      showNotice("Truck created.");
      e.currentTarget.reset();
      setCreateOpen(false);

      const assignedDriver = payload.driverUserId
        ? drivers.find((d) => d.id === payload.driverUserId)
        : undefined;

      const nextRow: TruckListItem = {
        id: String(data?.truckId ?? ""),
        name: String(payload.name ?? ""),
        status: String(payload.status ?? "idle"),
        fuelPct: Number(payload.fuelPct ?? 0),
        lat: typeof payload.lat === "number" ? payload.lat : null,
        lng: typeof payload.lng === "number" ? payload.lng : null,
        driverName: assignedDriver ? fullName(assignedDriver) : "",
        driverUserId: payload.driverUserId ? String(payload.driverUserId) : "",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
      }

      router.refresh();
    } catch {
      setCreateStatus("Unable to create truck.");
    } finally {
      setBusy(false);
    }
  }

  const truckName = overview?.truck?.name ? String(overview.truck.name) : "—";
  const fuelPct = Number(overview?.truck?.fuelPct ?? 0);
  const currentLoad = overview?.currentLoad;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCreateStatus(null);
            setCreateOpen(true);
          }}
        >
          + Add truck
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-3">Unit</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Fuel</div>
          <div className="col-span-3">Driver</div>
          <div className="col-span-2">Location</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No trucks yet.</div>
        ) : (
          rows.map((t) => (
            <button
              key={t.id}
              type="button"
              className="grid w-full grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
              onClick={() => {
                setSelectedId(t.id);
                setProfileOpen(true);
              }}
            >
              <div className="col-span-3 font-medium">#{shortId(t.id)} {t.name}</div>
              <div className="col-span-2">{statusBadge(t.status)}</div>
              <div className="col-span-2">{fuelBadge(t.fuelPct)}</div>
              <div className="col-span-3 text-muted-foreground">{driverLabelForTruck(t)}</div>
              <div className="col-span-2 text-muted-foreground">{locationLabel(t)}</div>
            </button>
          ))
        )}
      </div>

      {profileOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setProfileOpen(false)}
          />
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Truck profile</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">#{selectedId ? shortId(selectedId) : ""} {truckName}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setProfileOpen(false)} aria-label="Close">
                    ✕
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              {status ? (
                <div className="mt-4 rounded-md border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground">
                  {status}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Vehicle details</div>
                  </div>

                  <form id="truck-edit-form" onSubmit={saveTruckEdits} className="mt-4 grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="edit-name">Unit name</label>
                      <Input
                        id="edit-name"
                        value={editDraft.name}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement | null)?.value ?? "";
                          setEditDraft((p) => ({ ...p, name: v }));
                        }}
                        required
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-sm font-medium" htmlFor="edit-status">Status</label>
                        </div>
                        <div className="relative">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 justify-start px-0"
                            onClick={() => setStatusPickerOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={statusPickerOpen}
                          >
                            {statusBadge(editDraft.status)}
                          </Button>

                          {statusPickerOpen ? (
                            <div className="absolute left-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-md border border-border/60 bg-background/80 shadow-lg shadow-black/20 backdrop-blur">
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                                onClick={() => {
                                  setEditDraft((p) => ({ ...p, status: "active" }));
                                  setStatusPickerOpen(false);
                                }}
                              >
                                <div>Active</div>
                                {statusBadge("active")}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                                onClick={() => {
                                  setEditDraft((p) => ({ ...p, status: "idle" }));
                                  setStatusPickerOpen(false);
                                }}
                              >
                                <div>Idle</div>
                                {statusBadge("idle")}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                                onClick={() => {
                                  setEditDraft((p) => ({ ...p, status: "maintenance" }));
                                  setStatusPickerOpen(false);
                                }}
                              >
                                <div>Maintenance</div>
                                {statusBadge("maintenance")}
                              </button>
                            </div>
                          ) : null}

                          {statusPickerOpen ? (
                            <button
                              type="button"
                              className="fixed inset-0 z-40 cursor-default"
                              aria-label="Close"
                              onClick={() => setStatusPickerOpen(false)}
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="edit-fuel">Fuel %</label>
                        <Input
                          id="edit-fuel"
                          className="w-28"
                          type="number"
                          min={0}
                          max={100}
                          value={String(editDraft.fuelPct)}
                          onChange={(e) => {
                            const v = (e.target as HTMLInputElement | null)?.value ?? "0";
                            setEditDraft((p) => ({ ...p, fuelPct: Number(v) }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="edit-lat">Lat (optional)</label>
                        <Input
                          id="edit-lat"
                          className="max-w-[220px]"
                          value={editDraft.lat}
                          onChange={(e) => {
                            const v = (e.target as HTMLInputElement | null)?.value ?? "";
                            setEditDraft((p) => ({ ...p, lat: v }));
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="edit-lng">Lng (optional)</label>
                        <Input
                          id="edit-lng"
                          className="max-w-[220px]"
                          value={editDraft.lng}
                          onChange={(e) => {
                            const v = (e.target as HTMLInputElement | null)?.value ?? "";
                            setEditDraft((p) => ({ ...p, lng: v }));
                          }}
                        />
                      </div>
                    </div>
                  </form>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Assigned driver</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !selectedId}
                      onClick={() => setDriverDraftId("")}
                    >
                      Unassign
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <select
                      className="h-9 w-full rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={driverDraftId}
                      disabled={busy || !selectedId}
                      onChange={(e) => {
                        const next = e.currentTarget.value || null;
                        setDriverDraftId(next ? String(next) : "");
                      }}
                    >
                      <option value="">Unassigned</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          #{shortId(d.id)} {fullName(d)}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button type="button" disabled={busy || !selectedId} onClick={saveDriverAssignment}>
                        {busy ? "Saving…" : "Save"}
                      </Button>
                    </div>

                    <div className="h-[260px] overflow-hidden rounded-md border border-border/60 bg-background/20">
                      <div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
                        Map placeholder (tracking coming soon)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                  <div className="text-sm font-semibold tracking-tight">Current load</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {currentLoad
                      ? `${String(currentLoad.pickup ?? "—")} → ${String(currentLoad.dropoff ?? "—")}`
                      : "No load assigned"}
                  </div>
                  {currentLoad ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Status: {String(currentLoad.status ?? "planned").replace("_", " ")}
                      {" · "}Revenue {money(currentLoad.revenueUsd)}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || !overview?.truck || !selectedId}
                        onClick={() => {
                          setLoadStatus(null);
                          setLoadOpen(true);
                        }}
                      >
                        + Load
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Recent events</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !overview?.truck}
                      onClick={() => {
                        setEventStatus(null);
                        setEventOpen(true);
                      }}
                    >
                      + Event
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(overview?.routeEvents ?? []).slice(0, 6).map((e: any) => (
                      <div key={String(e.id ?? e._id)} className="rounded-md border border-border/60 bg-background/30 p-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <div className="font-semibold">{String(e.name ?? "note").toUpperCase()}</div>
                          <div>{e.at ? String(e.at).slice(0, 16).replace("T", " ") : ""}</div>
                        </div>
                        <div className="mt-1 text-sm">{String(e.message ?? "")}</div>
                      </div>
                    ))}
                    {(overview?.routeEvents ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">No events yet.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Fuel</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !overview?.truck}
                      onClick={() => {
                        setFuelStatus(null);
                        setFuelOpen(true);
                      }}
                    >
                      + Fuel
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Logs: {(overview?.fuelLogs ?? []).length}</div>
                  <div className="mt-3 grid gap-2">
                    {(overview?.fuelLogs ?? []).slice(0, 4).map((l: any) => (
                      <div key={String(l.id ?? l._id)} className="rounded-md border border-border/60 bg-background/30 p-2 text-xs">
                        {l.at ? String(l.at).slice(0, 10) : ""} · {Number(l.gallons ?? 0)} gal · {money(l.costUsd)}
                      </div>
                    ))}
                    {(overview?.fuelLogs ?? []).length === 0 ? (
                      <div className="text-xs text-muted-foreground">No fuel logs yet.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Maintenance</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !overview?.truck}
                      onClick={() => {
                        setMaintenanceStatus(null);
                        setMaintenanceOpen(true);
                      }}
                    >
                      + Maintenance
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Logs: {(overview?.maintenanceLogs ?? []).length}</div>
                  <div className="mt-3 grid gap-2">
                    {(overview?.maintenanceLogs ?? []).slice(0, 4).map((l: any) => (
                      <div key={String(l.id ?? l._id)} className="rounded-md border border-border/60 bg-background/30 p-2 text-xs">
                        {l.at ? String(l.at).slice(0, 10) : ""} · {String(l.kind ?? "")} · {money(l.costUsd)}
                      </div>
                    ))}
                    {(overview?.maintenanceLogs ?? []).length === 0 ? (
                      <div className="text-xs text-muted-foreground">No maintenance logs yet.</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Button type="submit" form="truck-edit-form" disabled={busy || !overview?.truck}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant={deleteConfirm ? "destructive" : "outline"}
                  disabled={busy || !overview?.truck}
                  onClick={() => {
                    if (!deleteConfirm) {
                      setDeleteConfirm(true);
                      setStatus("Click Delete again to confirm.");
                      return;
                    }
                    void deleteTruck();
                  }}
                >
                  {deleteConfirm ? "Confirm delete" : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setLoadOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Create load</div>
                  <div className="mt-1 text-sm text-muted-foreground">For {truckName}.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLoadOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={createLoad} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="load-status">Status</label>
                  <select
                    id="load-status"
                    name="status"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    defaultValue="planned"
                  >
                    <option value="planned">Planned</option>
                    <option value="in_transit">In transit</option>
                    <option value="delayed">Delayed</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="load-pickup">Pickup</label>
                  <Input id="load-pickup" name="pickup" placeholder="Houston, TX" required />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="load-dropoff">Dropoff</label>
                  <Input id="load-dropoff" name="dropoff" placeholder="San Antonio, TX" required />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="load-etaHours">ETA (hours)</label>
                    <Input id="load-etaHours" name="etaHours" type="number" min={0} defaultValue={0} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="load-revenueUsd">Revenue ($)</label>
                    <Input id="load-revenueUsd" name="revenueUsd" type="number" min={0} defaultValue={0} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="load-truckId">Assign truck</label>
                  <select
                    id="load-truckId"
                    name="truckId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    value={selectedId ?? ""}
                    disabled
                  >
                    {(rows ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        #{shortId(t.id)} {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" disabled={busy || !selectedId}>
                  {busy ? "Creating…" : "Create load"}
                </Button>
                {loadStatus ? <div className="text-sm text-muted-foreground">{loadStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {noticeOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setNoticeOpen(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-background/70 px-6 py-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="text-sm font-semibold tracking-tight">Done</div>
            <div className="mt-2 text-sm text-muted-foreground">{notice ?? ""}</div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setNoticeOpen(false)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Create truck</div>
                  <div className="mt-1 text-sm text-muted-foreground">Add a fleet unit.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)} aria-label="Close">
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={createTruck} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="name">Unit name</label>
                  <Input id="name" name="name" placeholder="TM-101" required />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    defaultValue="idle"
                  >
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="fuelPct">Fuel %</label>
                  <Input id="fuelPct" name="fuelPct" type="number" min={0} max={100} defaultValue={50} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="lat">Lat (optional)</label>
                    <Input id="lat" name="lat" type="number" step="any" />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="lng">Lng (optional)</label>
                    <Input id="lng" name="lng" type="number" step="any" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="driverUserId">Assign driver (optional)</label>
                  <select
                    id="driverUserId"
                    name="driverUserId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    defaultValue=""
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{shortId(d.id)} {fullName(d)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create truck"}</Button>
                {createStatus ? (
                  <div className="text-sm text-muted-foreground">{createStatus}</div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {fuelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setFuelOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Log fuel</div>
                  <div className="mt-1 text-sm text-muted-foreground">For {truckName}.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFuelOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="px-6 py-5">
              <form onSubmit={createFuelLog} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="fuel-at">At (optional)</label>
                  <Input id="fuel-at" name="at" placeholder="2025-12-24T03:55:00Z" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="fuel-odometer">Odometer (optional)</label>
                    <Input id="fuel-odometer" name="odometer" type="number" min={0} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="fuel-gallons">Gallons</label>
                    <Input id="fuel-gallons" name="gallons" type="number" min={0} step="any" defaultValue={0} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="fuel-costUsd">Cost ($)</label>
                  <Input id="fuel-costUsd" name="costUsd" type="number" min={0} step="any" defaultValue={0} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="fuel-notes">Notes</label>
                  <Textarea id="fuel-notes" name="notes" />
                </div>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save fuel log"}</Button>
                {fuelStatus ? <div className="text-sm text-muted-foreground">{fuelStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {maintenanceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setMaintenanceOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Log maintenance</div>
                  <div className="mt-1 text-sm text-muted-foreground">For {truckName}.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMaintenanceOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="px-6 py-5">
              <form onSubmit={createMaintenanceLog} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="maint-at">At (optional)</label>
                  <Input id="maint-at" name="at" placeholder="2025-12-24T03:55:00Z" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="maint-kind">Type</label>
                  <Input id="maint-kind" name="kind" placeholder="Oil change" required />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="maint-costUsd">Cost ($)</label>
                  <Input id="maint-costUsd" name="costUsd" type="number" min={0} step="any" defaultValue={0} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="maint-notes">Notes</label>
                  <Textarea id="maint-notes" name="notes" />
                </div>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save maintenance"}</Button>
                {maintenanceStatus ? <div className="text-sm text-muted-foreground">{maintenanceStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {eventOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setEventOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Add event</div>
                  <div className="mt-1 text-sm text-muted-foreground">For {truckName}.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEventOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="px-6 py-5">
              <form onSubmit={createRouteEvent} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="evt-at">At (optional)</label>
                  <Input id="evt-at" name="at" placeholder="2025-12-24T03:55:00Z" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="evt-name">Type</label>
                  <select
                    id="evt-name"
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
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="evt-message">Message</label>
                  <Textarea id="evt-message" name="message" required />
                </div>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save event"}</Button>
                {eventStatus ? <div className="text-sm text-muted-foreground">{eventStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
