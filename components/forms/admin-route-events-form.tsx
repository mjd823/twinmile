"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRouteEventAction, deleteRouteEventAction, updateRouteEventAction } from "@/app/actions/admin";

type TruckOption = { id: string; name: string };

type LoadOption = { id: string; label: string };

type RouteEventRow = {
  id: string;
  at: string;
  name: string;
  message: string;
  truckId?: string;
  loadId?: string;
};

export function AdminRouteEventsForm({
  trucks,
  loads,
  routeEvents,
}: {
  trucks: TruckOption[];
  loads: LoadOption[];
  routeEvents: RouteEventRow[];
}) {
  const [rows, setRows] = React.useState<RouteEventRow[]>(routeEvents);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState({
    at: "",
    name: "note",
    message: "",
    truckId: "",
    loadId: "",
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({
    at: "",
    name: "note",
    message: "",
    truckId: "",
    loadId: "",
  });

  React.useEffect(() => {
    setRows(routeEvents);
  }, [routeEvents]);

  React.useEffect(() => {
    if (!createOpen) {
      setCreateStatus(null);
      setDraft({ at: "", name: "note", message: "", truckId: "", loadId: "" });
    }
  }, [createOpen]);

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
      at: String(selectedRow.at ?? ""),
      name: String(selectedRow.name ?? "note"),
      message: String(selectedRow.message ?? ""),
      truckId: String(selectedRow.truckId ?? ""),
      loadId: String(selectedRow.loadId ?? ""),
    });
  }, [editOpen, selectedRow]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const payload = {
      at: String(draft.at ?? "") || undefined,
      name: String(draft.name ?? "note"),
      message: String(draft.message ?? ""),
      truckId: String(draft.truckId ?? "") || undefined,
      loadId: String(draft.loadId ?? "") || undefined,
    };

    try {
      const data = await createRouteEventAction(payload);
      if (!data.ok) {
        setCreateStatus(data.error ?? "Unable to create event.");
        return;
      }

      const nextRow: RouteEventRow = {
        id: String((data as any)?.routeEventId ?? ""),
        at: payload.at ? String(payload.at) : "",
        name: payload.name,
        message: payload.message,
        truckId: payload.truckId ? String(payload.truckId) : "",
        loadId: payload.loadId ? String(payload.loadId) : "",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
      }

      setCreateOpen(false);
    } catch {
      setCreateStatus("Unable to create event.");
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
      at: String(editDraft.at ?? "") || undefined,
      name: String(editDraft.name ?? "note"),
      message: String(editDraft.message ?? ""),
      truckId: String(editDraft.truckId ?? "") || undefined,
      loadId: String(editDraft.loadId ?? "") || undefined,
    };

    try {
      const data = await updateRouteEventAction(selectedId, payload);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to save event.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                at: payload.at ? String(payload.at) : "",
                name: payload.name,
                message: payload.message,
                truckId: payload.truckId ? String(payload.truckId) : "",
                loadId: payload.loadId ? String(payload.loadId) : "",
              }
            : r
        )
      );

      setEditOpen(false);
    } catch {
      setEditStatus("Unable to save event.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const data = await deleteRouteEventAction(selectedId);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to delete event.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setEditOpen(false);
    } catch {
      setEditStatus("Unable to delete event.");
    } finally {
      setBusy(false);
    }
  }

  function truckName(truckId?: string) {
    if (!truckId) return "—";
    return trucks.find((t) => t.id === truckId)?.name ?? "—";
  }

  function loadLabel(loadId?: string) {
    if (!loadId) return "—";
    return loads.find((l) => l.id === loadId)?.label ?? "—";
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
          + Add event
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Truck</div>
          <div className="col-span-3">Load</div>
          <div className="col-span-4">Message</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No events yet.</div>
        ) : (
          rows.map((e) => (
            <button
              key={e.id}
              type="button"
              className="grid w-full grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
              onClick={() => {
                setSelectedId(e.id);
                setEditStatus(null);
                setEditOpen(true);
              }}
            >
              <div className="col-span-2 text-muted-foreground">{e.name}</div>
              <div className="col-span-3 text-muted-foreground">{truckName(e.truckId)}</div>
              <div className="col-span-3 text-muted-foreground">{loadLabel(e.loadId)}</div>
              <div className="col-span-4 font-medium">{e.message}</div>
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
                  <div className="text-lg font-semibold tracking-tight">Create route event</div>
                  <div className="mt-1 text-sm text-muted-foreground">Add notes/status changes to the ops timeline.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onCreate} className="grid gap-4">
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
                    <label className="text-sm font-medium" htmlFor="create-name">Type</label>
                    <select
                      id="create-name"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={draft.name}
                      onChange={(e) => setDraft((p) => ({ ...p, name: e.currentTarget.value }))}
                    >
                      <option value="note">Note</option>
                      <option value="status">Status</option>
                      <option value="dispatch">Dispatch</option>
                      <option value="delay">Delay</option>
                      <option value="fuel">Fuel</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-truckId">Truck (optional)</label>
                    <select
                      id="create-truckId"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={draft.truckId}
                      onChange={(e) => setDraft((p) => ({ ...p, truckId: e.currentTarget.value }))}
                    >
                      <option value="">Unassigned</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-loadId">Load (optional)</label>
                    <select
                      id="create-loadId"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={draft.loadId}
                      onChange={(e) => setDraft((p) => ({ ...p, loadId: e.currentTarget.value }))}
                    >
                      <option value="">Unassigned</option>
                      {loads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-message">Message</label>
                  <Textarea
                    id="create-message"
                    value={draft.message}
                    onChange={(e) => setDraft((p) => ({ ...p, message: e.target.value }))}
                    required
                  />
                </div>

                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save event"}
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
                  <div className="text-lg font-semibold tracking-tight">Route event</div>
                  <div className="mt-1 text-sm text-muted-foreground">Edit or delete this event.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onSave} className="grid gap-4">
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
                    <label className="text-sm font-medium" htmlFor="edit-name">Type</label>
                    <select
                      id="edit-name"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((p) => ({ ...p, name: e.currentTarget.value }))}
                    >
                      <option value="note">Note</option>
                      <option value="status">Status</option>
                      <option value="dispatch">Dispatch</option>
                      <option value="delay">Delay</option>
                      <option value="fuel">Fuel</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-truckId">Truck (optional)</label>
                    <select
                      id="edit-truckId"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={editDraft.truckId}
                      onChange={(e) => setEditDraft((p) => ({ ...p, truckId: e.currentTarget.value }))}
                    >
                      <option value="">Unassigned</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-loadId">Load (optional)</label>
                    <select
                      id="edit-loadId"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={editDraft.loadId}
                      onChange={(e) => setEditDraft((p) => ({ ...p, loadId: e.currentTarget.value }))}
                    >
                      <option value="">Unassigned</option>
                      {loads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-message">Message</label>
                  <Textarea
                    id="edit-message"
                    value={editDraft.message}
                    onChange={(e) => setEditDraft((p) => ({ ...p, message: e.target.value }))}
                    required
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
