"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createFuelLogAction, deleteFuelLogAction, updateFuelLogAction } from "@/app/actions/admin";

type TruckOption = { id: string; name: string };

type FuelLogRow = {
  id: string;
  truckId: string;
  at: string;
  gallons: number;
  costUsd: number;
  odometer: number | null;
  notes?: string;
};

export function AdminFuelForm({
  trucks,
  fuelLogs,
}: {
  trucks: TruckOption[];
  fuelLogs: FuelLogRow[];
}) {
  const [rows, setRows] = React.useState<FuelLogRow[]>(fuelLogs);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState({
    truckId: trucks[0]?.id ?? "",
    at: "",
    gallons: 0,
    costUsd: 0,
    odometer: "",
    notes: "",
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({
    truckId: trucks[0]?.id ?? "",
    at: "",
    gallons: 0,
    costUsd: 0,
    odometer: "",
    notes: "",
  });

  React.useEffect(() => {
    setRows(fuelLogs);
  }, [fuelLogs]);

  React.useEffect(() => {
    if (!createOpen) {
      setCreateStatus(null);
      setDraft({
        truckId: trucks[0]?.id ?? "",
        at: "",
        gallons: 0,
        costUsd: 0,
        odometer: "",
        notes: "",
      });
    }
  }, [createOpen, trucks]);

  React.useEffect(() => {
    if (!editOpen) {
      setEditStatus(null);
      setSelectedId(null);
    }
  }, [editOpen]);

  const selectedRow = React.useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

  React.useEffect(() => {
    if (!editOpen || !selectedRow) return;
    setEditDraft({
      truckId: String(selectedRow.truckId ?? trucks[0]?.id ?? ""),
      at: String(selectedRow.at ?? ""),
      gallons: Number(selectedRow.gallons ?? 0),
      costUsd: Number(selectedRow.costUsd ?? 0),
      odometer: selectedRow.odometer === null || selectedRow.odometer === undefined ? "" : String(selectedRow.odometer),
      notes: String(selectedRow.notes ?? ""),
    });
  }, [editOpen, selectedRow, trucks]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const payload = {
      truckId: String(draft.truckId ?? ""),
      at: String(draft.at ?? "") || undefined,
      gallons: Number(draft.gallons ?? 0),
      costUsd: Number(draft.costUsd ?? 0),
      odometer: draft.odometer ? Number(draft.odometer) : undefined,
      notes: String(draft.notes ?? "") || undefined,
    };

    try {
      const data = await createFuelLogAction(payload);
      if (!data.ok) {
        setCreateStatus(data.error ?? "Unable to log fuel.");
        return;
      }

      const nextRow: FuelLogRow = {
        id: String((data as any)?.fuelLogId ?? ""),
        truckId: payload.truckId,
        at: payload.at ? String(payload.at) : "",
        gallons: Number(payload.gallons ?? 0),
        costUsd: Number(payload.costUsd ?? 0),
        odometer: payload.odometer === undefined ? null : Number(payload.odometer),
        notes: payload.notes ? String(payload.notes) : "",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
      }

      setCreateOpen(false);
    } catch {
      setCreateStatus("Unable to log fuel.");
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);

    const payload = {
      truckId: String(editDraft.truckId ?? ""),
      at: String(editDraft.at ?? "") || undefined,
      gallons: Number(editDraft.gallons ?? 0),
      costUsd: Number(editDraft.costUsd ?? 0),
      odometer: editDraft.odometer ? Number(editDraft.odometer) : undefined,
      notes: String(editDraft.notes ?? "") || undefined,
    };

    try {
      const data = await updateFuelLogAction(selectedId, payload);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to save fuel log.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                truckId: payload.truckId,
                at: payload.at ? String(payload.at) : "",
                gallons: Number(payload.gallons ?? 0),
                costUsd: Number(payload.costUsd ?? 0),
                odometer: payload.odometer === undefined ? null : Number(payload.odometer),
                notes: payload.notes ? String(payload.notes) : "",
              }
            : r
        )
      );

      setEditOpen(false);
    } catch {
      setEditStatus("Unable to save fuel log.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const data = await deleteFuelLogAction(selectedId);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to delete fuel log.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setEditOpen(false);
    } catch {
      setEditStatus("Unable to delete fuel log.");
    } finally {
      setBusy(false);
    }
  }

  function truckName(truckId: string) {
    return trucks.find((t) => t.id === truckId)?.name ?? "—";
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCreateStatus(null);
            setCreateOpen(true);
          }}
        >
          + Add fuel log
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-4">Truck</div>
          <div className="col-span-3">Gallons</div>
          <div className="col-span-3">Cost</div>
          <div className="col-span-2">At</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No fuel logs yet.</div>
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
              <div className="col-span-4 font-medium">{truckName(l.truckId)}</div>
              <div className="col-span-3 text-muted-foreground">{l.gallons}</div>
              <div className="col-span-3 text-muted-foreground">${Math.round(l.costUsd).toLocaleString()}</div>
              <div className="col-span-2 text-muted-foreground">{l.at ? l.at.slice(0, 10) : ""}</div>
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
                  <div className="text-lg font-semibold tracking-tight">Log fuel</div>
                  <div className="mt-1 text-sm text-muted-foreground">Record a fuel purchase/refuel.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onCreate} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-truckId">Truck</label>
                  <select
                    id="create-truckId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    value={draft.truckId}
                    onChange={(e) => setDraft((p) => ({ ...p, truckId: e.currentTarget.value }))}
                    required
                  >
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-at">At (optional)</label>
                    <Input
                      id="create-at"
                      placeholder="2025-12-24T03:55:00Z"
                      value={draft.at}
                      onChange={(e) => setDraft((p) => ({ ...p, at: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-odometer">Odometer (optional)</label>
                    <Input
                      id="create-odometer"
                      type="number"
                      min={0}
                      value={draft.odometer}
                      onChange={(e) => setDraft((p) => ({ ...p, odometer: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-gallons">Gallons</label>
                    <Input
                      id="create-gallons"
                      type="number"
                      min={0}
                      step="any"
                      value={draft.gallons}
                      onChange={(e) => setDraft((p) => ({ ...p, gallons: Number(e.target.value ?? 0) }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-costUsd">Cost ($)</label>
                    <Input
                      id="create-costUsd"
                      type="number"
                      min={0}
                      step="any"
                      value={draft.costUsd}
                      onChange={(e) => setDraft((p) => ({ ...p, costUsd: Number(e.target.value ?? 0) }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-notes">Notes</label>
                  <Textarea
                    id="create-notes"
                    value={draft.notes}
                    onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save fuel log"}
                </Button>
                {createStatus ? <div className="text-sm text-muted-foreground">{createStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen && selectedRow ? (
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
                  <div className="text-lg font-semibold tracking-tight">Fuel log</div>
                  <div className="mt-1 text-sm text-muted-foreground">Edit or delete this fuel log.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onSave} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-truckId">Truck</label>
                  <select
                    id="edit-truckId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    value={editDraft.truckId}
                    onChange={(e) => setEditDraft((p) => ({ ...p, truckId: e.currentTarget.value }))}
                    required
                  >
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-at">At (optional)</label>
                    <Input
                      id="edit-at"
                      placeholder="2025-12-24T03:55:00Z"
                      value={editDraft.at}
                      onChange={(e) => setEditDraft((p) => ({ ...p, at: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-odometer">Odometer (optional)</label>
                    <Input
                      id="edit-odometer"
                      type="number"
                      min={0}
                      value={editDraft.odometer}
                      onChange={(e) => setEditDraft((p) => ({ ...p, odometer: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-gallons">Gallons</label>
                    <Input
                      id="edit-gallons"
                      type="number"
                      min={0}
                      step="any"
                      value={editDraft.gallons}
                      onChange={(e) => setEditDraft((p) => ({ ...p, gallons: Number(e.target.value ?? 0) }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-costUsd">Cost ($)</label>
                    <Input
                      id="edit-costUsd"
                      type="number"
                      min={0}
                      step="any"
                      value={editDraft.costUsd}
                      onChange={(e) => setEditDraft((p) => ({ ...p, costUsd: Number(e.target.value ?? 0) }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-notes">Notes</label>
                  <Textarea
                    id="edit-notes"
                    value={editDraft.notes}
                    onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="destructive" disabled={busy} onClick={onDelete}>
                    {busy ? "Working…" : "Delete"}
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                  </Button>
                </div>
                {editStatus ? <div className="text-sm text-muted-foreground">{editStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
