"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createMaintenanceLogAction, deleteMaintenanceLogAction, updateMaintenanceLogAction } from "@/app/actions/admin";

type TruckOption = { id: string; name: string };

type MaintenanceLogRow = {
  id: string;
  truckId: string;
  at: string;
  kind: string;
  costUsd: number;
  notes?: string;
};

export function AdminMaintenanceForm({
  trucks,
  maintenanceLogs,
}: {
  trucks: TruckOption[];
  maintenanceLogs: MaintenanceLogRow[];
}) {
  const [rows, setRows] = React.useState<MaintenanceLogRow[]>(maintenanceLogs);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState({
    truckId: trucks[0]?.id ?? "",
    at: "",
    kind: "",
    costUsd: 0,
    notes: "",
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({
    truckId: trucks[0]?.id ?? "",
    at: "",
    kind: "",
    costUsd: 0,
    notes: "",
  });

  React.useEffect(() => {
    setRows(maintenanceLogs);
  }, [maintenanceLogs]);

  React.useEffect(() => {
    if (!createOpen) {
      setCreateStatus(null);
      setDraft({
        truckId: trucks[0]?.id ?? "",
        at: "",
        kind: "",
        costUsd: 0,
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
      kind: String(selectedRow.kind ?? ""),
      costUsd: Number(selectedRow.costUsd ?? 0),
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
      kind: String(draft.kind ?? ""),
      costUsd: Number(draft.costUsd ?? 0),
      notes: String(draft.notes ?? "") || undefined,
    };

    try {
      const data = await createMaintenanceLogAction(payload);
      if (!data.ok) {
        setCreateStatus(data.error ?? "Unable to log maintenance.");
        return;
      }

      const nextRow: MaintenanceLogRow = {
        id: String((data as any)?.maintenanceLogId ?? ""),
        truckId: payload.truckId,
        at: payload.at ? String(payload.at) : "",
        kind: payload.kind,
        costUsd: Number(payload.costUsd ?? 0),
        notes: payload.notes ? String(payload.notes) : "",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
      }

      setCreateOpen(false);
    } catch {
      setCreateStatus("Unable to log maintenance.");
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
      kind: String(editDraft.kind ?? ""),
      costUsd: Number(editDraft.costUsd ?? 0),
      notes: String(editDraft.notes ?? "") || undefined,
    };

    try {
      const data = await updateMaintenanceLogAction(selectedId, payload);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to save maintenance log.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                truckId: payload.truckId,
                at: payload.at ? String(payload.at) : "",
                kind: payload.kind,
                costUsd: Number(payload.costUsd ?? 0),
                notes: payload.notes ? String(payload.notes) : "",
              }
            : r
        )
      );

      setEditOpen(false);
    } catch {
      setEditStatus("Unable to save maintenance log.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const data = await deleteMaintenanceLogAction(selectedId);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to delete maintenance log.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setEditOpen(false);
    } catch {
      setEditStatus("Unable to delete maintenance log.");
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
          + Add maintenance log
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-4">Truck</div>
          <div className="col-span-4">Type</div>
          <div className="col-span-2">Cost</div>
          <div className="col-span-2">At</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No maintenance logs yet.</div>
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
              <div className="col-span-4 text-muted-foreground">{l.kind}</div>
              <div className="col-span-2 text-muted-foreground">${Math.round(l.costUsd).toLocaleString()}</div>
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
                  <div className="text-lg font-semibold tracking-tight">Log maintenance</div>
                  <div className="mt-1 text-sm text-muted-foreground">Record a maintenance event.</div>
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
                  <label className="text-sm font-medium" htmlFor="create-kind">Type</label>
                  <Input
                    id="create-kind"
                    placeholder="Oil change"
                    value={draft.kind}
                    onChange={(e) => setDraft((p) => ({ ...p, kind: e.target.value }))}
                    required
                  />
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
                  {busy ? "Saving…" : "Save maintenance"}
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
                  <div className="text-lg font-semibold tracking-tight">Maintenance log</div>
                  <div className="mt-1 text-sm text-muted-foreground">Edit or delete this maintenance log.</div>
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
                  <label className="text-sm font-medium" htmlFor="edit-kind">Type</label>
                  <Input
                    id="edit-kind"
                    placeholder="Oil change"
                    value={editDraft.kind}
                    onChange={(e) => setEditDraft((p) => ({ ...p, kind: e.target.value }))}
                    required
                  />
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
