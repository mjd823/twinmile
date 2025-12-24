"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TruckOption = { id: string; name: string };

type LoadRow = {
  id: string;
  status: string;
  pickup: string;
  dropoff: string;
  etaHours: number;
  revenueUsd: number;
  truckId?: string;
};

function shortId(id: string) {
  const s = String(id ?? "");
  return s.length >= 6 ? s.slice(-6) : s;
}

function money(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "$0";
  return `$${Math.round(v).toLocaleString()}`;
}

function statusBadge(status: string) {
  const s = String(status ?? "planned");
  const label = s.replace("_", " ");
  const variant =
    s === "delayed"
      ? "destructive"
      : s === "in_transit"
        ? "default"
        : s === "planned"
          ? "secondary"
          : "outline";

  return (
    <Badge variant={variant as any}>
      {label}
    </Badge>
  );
}

export function AdminLoadsForm({
  loads,
  trucks,
  preselectedTruckId,
}: {
  loads: LoadRow[];
  trucks: TruckOption[];
  preselectedTruckId?: string;
}) {
  const router = useRouter();

  const [rows, setRows] = React.useState<LoadRow[]>(loads);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [notice, setNotice] = React.useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = React.useState(false);

  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);

  const [draft, setDraft] = React.useState({
    status: "planned",
    pickup: "",
    dropoff: "",
    etaHours: 0,
    revenueUsd: 0,
    truckId: "",
  });

  React.useEffect(() => {
    setRows(loads);
  }, [loads]);

  React.useEffect(() => {
    if (!selectedId) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setDraft({
      status: String(row.status ?? "planned"),
      pickup: String(row.pickup ?? ""),
      dropoff: String(row.dropoff ?? ""),
      etaHours: Number(row.etaHours ?? 0),
      revenueUsd: Number(row.revenueUsd ?? 0),
      truckId: row.truckId ? String(row.truckId) : "",
    });
  }, [rows, selectedId]);

  React.useEffect(() => {
    setDeleteConfirm(false);
    setCreateStatus(null);
    setEditStatus(null);
  }, [createOpen, editOpen, selectedId]);

  function showNotice(msg: string) {
    setNotice(msg);
    setNoticeOpen(true);
  }

  function truckLabel(truckId?: string) {
    const id = truckId ? String(truckId) : "";
    if (!id) return "Unassigned";
    const t = trucks.find((x) => String(x.id) === id);
    if (!t) return `#${shortId(id)} Truck`;
    return `#${shortId(id)} ${t.name}`;
  }

  async function refreshList() {
    try {
      const res = await fetch("/api/admin/loads", { method: "GET", cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok || !data?.ok || !Array.isArray(data.loads)) return;
      setRows(
        data.loads.map((l: any) => ({
          id: String(l.id ?? l._id ?? ""),
          status: String(l.status ?? "planned"),
          pickup: String(l.pickup ?? ""),
          dropoff: String(l.dropoff ?? ""),
          etaHours: Number(l.etaHours ?? 0),
          revenueUsd: Number(l.revenueUsd ?? 0),
          truckId: l.truckId ? String(l.truckId) : "",
        }))
      );
    } catch {
      // ignore
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      status: String(formData.get("status") ?? "planned"),
      pickup: String(formData.get("pickup") ?? ""),
      dropoff: String(formData.get("dropoff") ?? ""),
      etaHours: Number(formData.get("etaHours") ?? 0),
      revenueUsd: Number(formData.get("revenueUsd") ?? 0),
      truckId: String(formData.get("truckId") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/loads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setCreateStatus(data?.error ?? "Unable to create load.");
        return;
      }

      const nextRow: LoadRow = {
        id: String(data?.loadId ?? data?.id ?? ""),
        status: payload.status,
        pickup: payload.pickup,
        dropoff: payload.dropoff,
        etaHours: Number(payload.etaHours ?? 0),
        revenueUsd: Number(payload.revenueUsd ?? 0),
        truckId: payload.truckId ? String(payload.truckId) : "",
      };

      if (nextRow.id) setRows((prev) => [nextRow, ...prev]);
      router.refresh();
      void refreshList();
      showNotice("Load created.");
      e.currentTarget.reset();
      setCreateOpen(false);
    } catch {
      setCreateStatus("Unable to create load.");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const payload = {
        status: draft.status,
        pickup: draft.pickup,
        dropoff: draft.dropoff,
        etaHours: Number(draft.etaHours ?? 0),
        revenueUsd: Number(draft.revenueUsd ?? 0),
        truckId: draft.truckId || "",
      };

      const res = await fetch(`/api/admin/loads/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setEditStatus(data?.error ?? "Unable to save load.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                status: payload.status,
                pickup: payload.pickup,
                dropoff: payload.dropoff,
                etaHours: payload.etaHours,
                revenueUsd: payload.revenueUsd,
                truckId: payload.truckId ? String(payload.truckId) : "",
              }
            : r
        )
      );

      router.refresh();
      void refreshList();
      showNotice("Load saved.");
      setEditOpen(false);
    } catch {
      setEditStatus("Unable to save load.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/loads/${selectedId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setEditStatus(data?.error ?? "Unable to delete load.");
        return;
      }

      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      router.refresh();
      void refreshList();
      showNotice("Load deleted.");
      setEditOpen(false);
      setSelectedId(null);
    } catch {
      setEditStatus("Unable to delete load.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">Loads</div>
          <div className="mt-1 text-sm text-muted-foreground">Create and manage routes/contracts.</div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCreateStatus(null);
            setCreateOpen(true);
          }}
        >
          + Add load
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-2">Load</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-4">Route</div>
          <div className="col-span-2">Truck</div>
          <div className="col-span-1">ETA</div>
          <div className="col-span-1">Revenue</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No loads yet.</div>
        ) : (
          rows.map((l) => (
            <button
              key={l.id}
              type="button"
              className="grid w-full grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
              onClick={() => {
                setSelectedId(l.id);
                setEditStatus(null);
                setEditOpen(true);
              }}
            >
              <div className="col-span-2 font-medium">#{shortId(l.id)}</div>
              <div className="col-span-2">{statusBadge(l.status)}</div>
              <div className="col-span-4 font-medium">
                {String(l.pickup ?? "—")} → {String(l.dropoff ?? "—")}
              </div>
              <div className="col-span-2 text-muted-foreground">{truckLabel(l.truckId)}</div>
              <div className="col-span-1 text-muted-foreground">{Number(l.etaHours ?? 0)}h</div>
              <div className="col-span-1 text-muted-foreground">{money(l.revenueUsd)}</div>
            </button>
          ))
        )}
      </div>

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
                  <div className="text-lg font-semibold tracking-tight">Create load</div>
                  <div className="mt-1 text-sm text-muted-foreground">Add a route/contract to track in Operations.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onCreate} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-status">Status</label>
                  <select
                    id="create-status"
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
                  <label className="text-sm font-medium" htmlFor="create-pickup">Pickup</label>
                  <Input id="create-pickup" name="pickup" placeholder="Houston, TX" required />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-dropoff">Dropoff</label>
                  <Input id="create-dropoff" name="dropoff" placeholder="San Antonio, TX" required />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-etaHours">ETA (hours)</label>
                    <Input id="create-etaHours" name="etaHours" type="number" min={0} defaultValue={0} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-revenueUsd">Revenue ($)</label>
                    <Input id="create-revenueUsd" name="revenueUsd" type="number" min={0} defaultValue={0} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-truckId">Assign truck (optional)</label>
                  <select
                    id="create-truckId"
                    name="truckId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    defaultValue={String(preselectedTruckId ?? "")}
                  >
                    <option value="">Unassigned</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{shortId(t.id)} {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create load"}
                </Button>
                {createStatus ? <div className="text-sm text-muted-foreground">{createStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setEditOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Load</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">#{selectedId ? shortId(selectedId) : ""}</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-sm font-semibold tracking-tight">Details</div>

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-status">Status</label>
                    <select
                      id="edit-status"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={draft.status}
                      onChange={(e) => {
                        const v = (e.target as HTMLSelectElement | null)?.value ?? "planned";
                        setDraft((p) => ({ ...p, status: v }));
                      }}
                    >
                      <option value="planned">Planned</option>
                      <option value="in_transit">In transit</option>
                      <option value="delayed">Delayed</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-pickup">Pickup</label>
                    <Input
                      id="edit-pickup"
                      value={draft.pickup}
                      onChange={(e) => {
                        const v = (e.target as HTMLInputElement | null)?.value ?? "";
                        setDraft((p) => ({ ...p, pickup: v }));
                      }}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-dropoff">Dropoff</label>
                    <Input
                      id="edit-dropoff"
                      value={draft.dropoff}
                      onChange={(e) => {
                        const v = (e.target as HTMLInputElement | null)?.value ?? "";
                        setDraft((p) => ({ ...p, dropoff: v }));
                      }}
                      required
                    />
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="edit-etaHours">ETA (hours)</label>
                      <Input
                        id="edit-etaHours"
                        type="number"
                        min={0}
                        value={String(draft.etaHours)}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement | null)?.value ?? "0";
                          setDraft((p) => ({ ...p, etaHours: Number(v) }));
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="edit-revenueUsd">Revenue ($)</label>
                      <Input
                        id="edit-revenueUsd"
                        type="number"
                        min={0}
                        value={String(draft.revenueUsd)}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement | null)?.value ?? "0";
                          setDraft((p) => ({ ...p, revenueUsd: Number(v) }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-truckId">Assign truck</label>
                    <select
                      id="edit-truckId"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={draft.truckId}
                      onChange={(e) => {
                        const v = (e.target as HTMLSelectElement | null)?.value ?? "";
                        setDraft((p) => ({ ...p, truckId: v }));
                      }}
                    >
                      <option value="">Unassigned</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>
                          #{shortId(t.id)} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" disabled={busy || !selectedId} onClick={() => void onSave()}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant={deleteConfirm ? "destructive" : "outline"}
                  disabled={busy || !selectedId}
                  onClick={() => {
                    if (!deleteConfirm) {
                      setDeleteConfirm(true);
                      setEditStatus("Click Delete again to confirm.");
                      return;
                    }
                    void onDelete();
                  }}
                >
                  {deleteConfirm ? "Confirm delete" : "Delete"}
                </Button>
              </div>
              {editStatus ? <div className="mt-3 text-sm text-muted-foreground">{editStatus}</div> : null}
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
    </div>
  );
}
