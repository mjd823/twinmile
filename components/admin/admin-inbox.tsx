"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  convertDriverLeadAction,
  convertQuoteLeadAction,
  deleteLeadAction,
  restoreLeadAction,
  updateLeadAction,
} from "@/app/actions/admin";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

type QuoteLeadRow = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  status: LeadStatus;
  createdAt: string;
};

type DriverLeadRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  truckType: string;
  status: LeadStatus;
  createdAt: string;
};

type InboxItem =
  | {
      kind: "quotes";
      id: string;
      typeLabel: "Quote lead";
      name: string;
      email: string;
      detail: string;
      status: LeadStatus;
      createdAt: string;
    }
  | {
      kind: "drivers";
      id: string;
      typeLabel: "Driver app";
      name: string;
      email: string;
      detail: string;
      status: LeadStatus;
      createdAt: string;
    };

type TypeFilter = "all" | "quotes" | "drivers";
type StageFilter = "all" | LeadStatus;
type SortMode = "newest" | "oldest" | "stage_priority";
type ViewMode = "active" | "archived";

export function AdminInbox({
  quoteLeads,
  driverLeads,
  archivedQuoteLeads,
  archivedDriverLeads,
}: {
  quoteLeads: QuoteLeadRow[];
  driverLeads: DriverLeadRow[];
  archivedQuoteLeads: QuoteLeadRow[];
  archivedDriverLeads: DriverLeadRow[];
}) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<{ kind: "quotes" | "drivers"; id: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<{ kind: "quotes" | "drivers"; id: string; name: string } | null>(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [statusDraft, setStatusDraft] = React.useState<LeadStatus>("new");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [stageFilter, setStageFilter] = React.useState<StageFilter>("all");
  const [sortMode, setSortMode] = React.useState<SortMode>("newest");
  const [viewMode, setViewMode] = React.useState<ViewMode>("active");

  const sourceQuoteLeads = viewMode === "active" ? quoteLeads : archivedQuoteLeads;
  const sourceDriverLeads = viewMode === "active" ? driverLeads : archivedDriverLeads;

  const rows = React.useMemo<InboxItem[]>(() => {
    const q: InboxItem[] = sourceQuoteLeads.map((l) => ({
      kind: "quotes",
      id: l.id,
      typeLabel: "Quote lead",
      name: l.name || "—",
      email: l.email || "—",
      detail: `${l.company || "—"} • ${l.pickupLocation || ""}${l.dropoffLocation ? ` → ${l.dropoffLocation}` : ""}`.trim(),
      status: l.status,
      createdAt: l.createdAt,
    }));

    const d: InboxItem[] = sourceDriverLeads.map((l) => ({
      kind: "drivers",
      id: l.id,
      typeLabel: "Driver app",
      name: l.fullName || "—",
      email: l.email || "—",
      detail: `${l.truckType || "—"}`,
      status: l.status,
      createdAt: l.createdAt,
    }));

    return [...q, ...d];
  }, [sourceDriverLeads, sourceQuoteLeads]);

  const selectedItem = React.useMemo(() => {
    if (!selected) return null;
    return rows.find((r) => r.kind === selected.kind && r.id === selected.id) ?? null;
  }, [rows, selected]);

  const metrics = React.useMemo(() => {
    const base = { all: rows.length, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
    for (const r of rows) base[r.status] += 1;
    return base;
  }, [rows]);

  const visibleRows = React.useMemo(() => {
    const stagePriority: Record<LeadStatus, number> = {
      qualified: 0,
      new: 1,
      contacted: 2,
      converted: 3,
      lost: 4,
    };

    const toTs = (iso: string) => {
      const n = Date.parse(iso);
      return Number.isNaN(n) ? 0 : n;
    };

    const filtered = rows.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (stageFilter !== "all" && r.status !== stageFilter) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTs = toTs(a.createdAt);
      const bTs = toTs(b.createdAt);

      if (sortMode === "oldest") return aTs - bTs;
      if (sortMode === "stage_priority") {
        const pri = stagePriority[a.status] - stagePriority[b.status];
        if (pri !== 0) return pri;
        return bTs - aTs;
      }

      return bTs - aTs;
    });

    return sorted;
  }, [rows, sortMode, stageFilter, typeFilter]);

  const selectedQuote = React.useMemo(() => {
    if (!selected || selected.kind !== "quotes") return null;
    return sourceQuoteLeads.find((l) => l.id === selected.id) ?? null;
  }, [selected, sourceQuoteLeads]);

  const selectedDriver = React.useMemo(() => {
    if (!selected || selected.kind !== "drivers") return null;
    return sourceDriverLeads.find((l) => l.id === selected.id) ?? null;
  }, [selected, sourceDriverLeads]);

  const selectedBusy = React.useMemo(() => {
    if (!selectedItem || !selected) return false;
    return busyKey === `${selected.kind}:${selectedItem.id}`;
  }, [busyKey, selected, selectedItem]);

  React.useEffect(() => {
    if (!selectedItem || !selected) return;
    setNoteDraft("");
    setStatusDraft(selectedItem.status);
  }, [selectedItem, selected]);

  async function updateLead(
    kind: "quotes" | "drivers",
    id: string,
    payload: { status?: LeadStatus; note?: string }
  ) {
    setMessage(null);
    setBusyKey(`${kind}:${id}`);
    try {
      const result = await updateLeadAction(kind, id, payload);
      if (!result.ok) {
        setMessage(result.error ?? "Unable to update lead.");
        return false;
      }
      setMessage("Lead updated. Reload the page to see changes.");
      return true;
    } catch {
      setMessage("Unable to update lead.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function restoreLead(kind: "quotes" | "drivers", id: string) {
    setMessage(null);
    setBusyKey(`${kind}:${id}`);
    try {
      const result = await restoreLeadAction(kind, id);
      if (!result.ok) {
        setMessage(result.error ?? "Unable to restore lead.");
        return;
      }

      setSelected(null);
      setMessage("Lead restored to active inbox. Refreshing...");
      window.location.reload();
    } catch {
      setMessage("Unable to restore lead.");
    } finally {
      setBusyKey(null);
    }
  }

  async function convertQuote(id: string) {
    setMessage(null);
    setBusyKey(`quotes:${id}`);
    try {
      const data = await convertQuoteLeadAction(id, { createLoad: true, rateType: "flat", rateUsd: 0 });
      if (!data.ok) {
        setMessage(data.error ?? "Unable to convert lead.");
        return;
      }
      setMessage(
        `Converted. Customer ${data.customerId}, Contract ${data.contractId}${data.loadId ? `, Load ${data.loadId}` : ""}. Reload.`
      );
    } catch {
      setMessage("Unable to convert lead.");
    } finally {
      setBusyKey(null);
    }
  }

  async function convertDriver(id: string) {
    setMessage(null);
    setBusyKey(`drivers:${id}`);
    try {
      const data = await convertDriverLeadAction(id, {});
      if (!data.ok) {
        setMessage(data.error ?? "Unable to convert lead.");
        return;
      }
      setMessage(
        `Driver user created: ${data.email}. Temp password: ${data.tempPassword} (copy and send). Reload.`
      );
    } catch {
      setMessage("Unable to convert lead.");
    } finally {
      setBusyKey(null);
    }
  }

  function closeModal() {
    setSelected(null);
  }

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    setSelected(null);
    setArchiveTarget(null);
  }

  async function archiveLead(kind: "quotes" | "drivers", id: string) {
    setMessage(null);
    setBusyKey(`${kind}:${id}`);
    try {
      const result = await deleteLeadAction(kind, id);
      if (!result.ok) {
        setMessage(result.error ?? "Unable to archive lead.");
        return;
      }

      setArchiveTarget(null);
      setSelected(null);
      setMessage("Lead archived. Refreshing inbox...");
      window.location.reload();
    } catch {
      setMessage("Unable to archive lead.");
    } finally {
      setBusyKey(null);
    }
  }

  function typePill(kind: "quotes" | "drivers", label: string) {
    const cls =
      kind === "quotes"
        ? "inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
        : "inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300";
    return <span className={cls}>{label}</span>;
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border/70 bg-background/50 p-1 shadow-sm shadow-black/10">
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "active" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchView("active")}
          >
            Active inbox
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "archived" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchView("archived")}
          >
            Archived
          </button>
        </div>
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Type
            <select
              className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm text-foreground shadow-sm shadow-black/10"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.currentTarget.value as TypeFilter)}
            >
              <option value="all">All leads</option>
              <option value="quotes">Quote leads</option>
              <option value="drivers">Driver applications</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Stage
            <select
              className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm text-foreground shadow-sm shadow-black/10"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.currentTarget.value as StageFilter)}
            >
              <option value="all">All stages</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Sort
            <select
              className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm text-foreground shadow-sm shadow-black/10"
              value={sortMode}
              onChange={(e) => setSortMode(e.currentTarget.value as SortMode)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="stage_priority">Stage priority</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-lg font-semibold">{metrics.all}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">New</div>
          <div className="mt-1 text-lg font-semibold">{metrics.new}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Contacted</div>
          <div className="mt-1 text-lg font-semibold">{metrics.contacted}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Qualified</div>
          <div className="mt-1 text-lg font-semibold">{metrics.qualified}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Converted</div>
          <div className="mt-1 text-lg font-semibold">{metrics.converted}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Lost</div>
          <div className="mt-1 text-lg font-semibold">{metrics.lost}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="hidden grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold md:grid">
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-3">Details</div>
          <div className="col-span-1">Stage</div>
        </div>

        {visibleRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No leads found for current filters.</div>
        ) : (
          visibleRows.map((r) => (
            <button
              key={`${r.kind}:${r.id}`}
              type="button"
              className="w-full border-b border-border/60 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
              onClick={() => setSelected({ kind: r.kind, id: r.id })}
            >
              <div className="hidden grid-cols-12 gap-2 md:grid">
                <div className="col-span-2">{typePill(r.kind, r.typeLabel)}</div>
                <div className="col-span-3 font-medium">{r.name}</div>
                <div className="col-span-3 text-muted-foreground">{r.email}</div>
                <div className="col-span-3 text-muted-foreground">{r.detail || "—"}</div>
                <div className="col-span-1 text-muted-foreground">{r.status}</div>
              </div>
              <div className="grid gap-1 md:hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.name}</span>
                  {typePill(r.kind, r.typeLabel)}
                </div>
                <div className="text-muted-foreground">{r.email}</div>
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{r.detail || "—"}</span>
                  <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-xs">{r.status}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedItem && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">{selectedItem.typeLabel}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedItem.name} • {selectedItem.email}
                  </div>
                  {viewMode === "archived" ? (
                    <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Archived lead</div>
                  ) : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="grid gap-4">
                {selected.kind === "quotes" && selectedQuote ? (
                  <div className="grid gap-2 rounded-lg border border-border/60 bg-card/40 p-4 text-sm">
                    <div className="font-medium">Quote details</div>
                    <div className="text-muted-foreground">Company: {selectedQuote.company || "—"}</div>
                    <div className="text-muted-foreground">Phone: {selectedQuote.phone || "—"}</div>
                    <div className="text-muted-foreground">Pickup: {selectedQuote.pickupLocation || "—"}</div>
                    <div className="text-muted-foreground">Dropoff: {selectedQuote.dropoffLocation || "—"}</div>
                  </div>
                ) : null}

                {selected.kind === "drivers" && selectedDriver ? (
                  <div className="grid gap-2 rounded-lg border border-border/60 bg-card/40 p-4 text-sm">
                    <div className="font-medium">Driver application</div>
                    <div className="text-muted-foreground">Phone: {selectedDriver.phone || "—"}</div>
                    <div className="text-muted-foreground">Truck type: {selectedDriver.truckType || "—"}</div>
                  </div>
                ) : null}

                {viewMode === "active" ? (
                  <>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="lead-status">Stage</label>
                      <select
                        id="lead-status"
                        className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                        value={statusDraft}
                        disabled={selectedBusy}
                        onChange={(e) => {
                          const next = e.currentTarget.value as LeadStatus;
                          setStatusDraft(next);
                          void updateLead(selected.kind, selectedItem.id, { status: next });
                        }}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium" htmlFor="lead-note">Add note</label>
                      <Input
                        id="lead-note"
                        placeholder="Type a note and press Enter"
                        disabled={selectedBusy}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const note = noteDraft.trim();
                          if (!note) return;
                          if (selectedBusy) return;
                          void (async () => {
                            const ok = await updateLead(selected.kind, selectedItem.id, { note });
                            if (ok) setNoteDraft("");
                          })();
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="flex-1 min-w-40"
                        disabled={selectedBusy || statusDraft === "converted"}
                        onClick={() => (selected.kind === "quotes" ? convertQuote(selectedItem.id) : convertDriver(selectedItem.id))}
                      >
                        Convert
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        disabled={selectedBusy}
                        onClick={() => setArchiveTarget({ kind: selected.kind, id: selectedItem.id, name: selectedItem.name })}
                      >
                        Archive lead
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-w-40"
                      disabled={selectedBusy}
                      onClick={() => void restoreLead(selected.kind, selectedItem.id)}
                    >
                      Restore to active inbox
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {archiveTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/25 backdrop-blur-md"
            aria-label="Close archive confirmation"
            onClick={() => setArchiveTarget(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-background/60 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="text-sm font-semibold uppercase tracking-wide text-red-300">Archive lead</div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">Remove from active inbox?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will archive the {archiveTarget.kind === "quotes" ? "quote lead" : "driver application"} for {archiveTarget.name}.
              Archived leads are hidden from the inbox list.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setArchiveTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-500"
                disabled={busyKey === `${archiveTarget.kind}:${archiveTarget.id}`}
                onClick={() => void archiveLead(archiveTarget.kind, archiveTarget.id)}
              >
                Archive
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
