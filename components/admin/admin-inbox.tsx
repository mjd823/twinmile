"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  convertDriverLeadAction,
  convertQuoteLeadAction,
  deleteLeadAction,
  updateLeadAction,
} from "@/app/actions/admin";

function formatLocalDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Always America/Chicago — the business clock.
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Pipeline-stage groups. Lead Engine stage tiles link here with ?stage=<key>;
 * each key maps to the raw statuses that belong to that stage so prospect
 * statuses (onboarding, reviewed, ready_to_dispatch, …) filter correctly.
 */
const STAGE_GROUPS: Record<string, string[]> = {
  new: ["new"],
  contacted: ["contacted"],
  qualified: ["qualified", "reviewed"],
  onboarding: ["onboarding", "onboarding_invited", "compliance_check"],
  negotiating: ["quoted", "negotiating"],
  ready: ["ready_to_dispatch"],
  converted: ["converted"],
  rejected: ["rejected", "lost"],
  lost: ["lost", "rejected"],
};

function stageMatches(stageKey: string, status: string): boolean {
  const group = STAGE_GROUPS[stageKey];
  return group ? group.includes(status) : status === stageKey;
}

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

type QuoteLeadRow = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType?: string;
  pickupDate?: string;
  notes?: string;
  status: LeadStatus;
  createdAt: string;
};

type DriverLeadRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  truckType: string;
  yearsExperience?: string;
  preferredRoutes?: string;
  startDate?: string;
  notes?: string;
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
      status: string;
      createdAt: string;
    }
  | {
      kind: "drivers";
      id: string;
      typeLabel: "Driver app";
      name: string;
      email: string;
      detail: string;
      status: string;
      createdAt: string;
    };

type TypeFilter = "all" | "quotes" | "drivers";
type StageFilter = string; // "all" or a STAGE_GROUPS key / raw status
type SortMode = "newest" | "oldest" | "stage_priority";

export function AdminInbox({
  quoteLeads,
  driverLeads,
  initialType = "all",
  initialStage = "all",
}: {
  quoteLeads: QuoteLeadRow[];
  driverLeads: DriverLeadRow[];
  initialType?: TypeFilter;
  initialStage?: string;
}) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<{ kind: "quotes" | "drivers"; id: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<{ kind: "quotes" | "drivers"; id: string; name: string } | null>(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [statusDraft, setStatusDraft] = React.useState<LeadStatus>("new");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(initialType);
  const [stageFilter, setStageFilter] = React.useState<StageFilter>(initialStage);
  const [sortMode, setSortMode] = React.useState<SortMode>("newest");
  const [searchQuery, setSearchQuery] = React.useState("");

  const rows = React.useMemo<InboxItem[]>(() => {
    const q: InboxItem[] = quoteLeads.map((l: QuoteLeadRow) => ({
      kind: "quotes",
      id: l.id,
      typeLabel: "Quote lead",
      name: l.name || "—",
      email: l.email || "—",
      detail: `${l.company || "—"} • ${l.pickupLocation || ""}${l.dropoffLocation ? ` → ${l.dropoffLocation}` : ""}`.trim(),
      status: l.status,
      createdAt: l.createdAt,
    }));

    const d: InboxItem[] = driverLeads.map((l: DriverLeadRow) => ({
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
  }, [quoteLeads, driverLeads]);

  const selectedItem = React.useMemo(() => {
    if (!selected) return null;
    return rows.find((r) => r.kind === selected.kind && r.id === selected.id) ?? null;
  }, [rows, selected]);

  const metrics = React.useMemo(() => {
    const base = { all: rows.length, new: 0, qualified: 0, onboarding: 0, ready: 0, converted: 0, rejected: 0 };
    for (const r of rows) {
      if (stageMatches("new", r.status)) base.new += 1;
      else if (stageMatches("qualified", r.status) || stageMatches("contacted", r.status)) base.qualified += 1;
      else if (stageMatches("onboarding", r.status) || stageMatches("negotiating", r.status)) base.onboarding += 1;
      else if (stageMatches("ready", r.status)) base.ready += 1;
      else if (stageMatches("converted", r.status)) base.converted += 1;
      else if (stageMatches("rejected", r.status)) base.rejected += 1;
    }
    return base;
  }, [rows]);

  const visibleRows = React.useMemo(() => {
    const stagePriority: Record<string, number> = {
      qualified: 0,
      reviewed: 0,
      new: 1,
      contacted: 2,
      onboarding: 2,
      ready_to_dispatch: 3,
      converted: 4,
      lost: 5,
      rejected: 5,
    };

    const toTs = (iso: string) => {
      const n = Date.parse(iso);
      return Number.isNaN(n) ? 0 : n;
    };

    const filtered = rows.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (stageFilter !== "all" && !stageMatches(stageFilter, r.status)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(query) ||
          r.email.toLowerCase().includes(query) ||
          r.detail.toLowerCase().includes(query) ||
          r.status.toLowerCase().includes(query)
        );
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTs = toTs(a.createdAt);
      const bTs = toTs(b.createdAt);

      if (sortMode === "oldest") return aTs - bTs;
      if (sortMode === "stage_priority") {
        const pri = (stagePriority[a.status] ?? 9) - (stagePriority[b.status] ?? 9);
        if (pri !== 0) return pri;
        return bTs - aTs;
      }

      return bTs - aTs;
    });

    return sorted;
  }, [rows, sortMode, stageFilter, typeFilter, searchQuery]);

  const selectedQuote = React.useMemo(() => {
    if (!selected || selected.kind !== "quotes") return null;
    return quoteLeads.find((l: QuoteLeadRow) => l.id === selected.id) ?? null;
  }, [selected, quoteLeads]);

  const selectedDriver = React.useMemo(() => {
    if (!selected || selected.kind !== "drivers") return null;
    return driverLeads.find((l: DriverLeadRow) => l.id === selected.id) ?? null;
  }, [selected, driverLeads]);

  const selectedBusy = React.useMemo(() => {
    if (!selectedItem || !selected) return false;
    return busyKey === `${selected.kind}:${selectedItem.id}`;
  }, [busyKey, selected, selectedItem]);

  React.useEffect(() => {
    if (!selectedItem || !selected) return;
    setNoteDraft("");
    setStatusDraft(selectedItem.status as LeadStatus);
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

  function closeModal() {
    setSelected(null);
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

    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div className="text-sm text-muted-foreground">
        Click headers to sort/filter • {visibleRows.length} of {rows.length} leads
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          className="h-9 w-48"
        />
      </div>
    </div>

    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {([
        ["all", "Total", metrics.all],
        ["new", "New", metrics.new],
        ["qualified", "Qualified", metrics.qualified],
        ["onboarding", "Onboarding", metrics.onboarding],
        ["converted", "Converted", metrics.converted],
        ["rejected", "Rejected / Lost", metrics.rejected],
      ] as const).map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          onClick={() => setStageFilter(key === "all" ? "all" : key)}
          className={`rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary/40 ${
            stageFilter === key || (key === "all" && stageFilter === "all")
              ? "border-primary/50 bg-primary/5"
              : "border-border/60 bg-card/50"
          }`}
        >
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{count}</div>
        </button>
      ))}
    </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="hidden grid-cols-13 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold md:grid">
          <button 
            className="col-span-2 flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent/50 transition-colors"
            onClick={() => {
              if (typeFilter === "all") {
                setTypeFilter("quotes");
              } else if (typeFilter === "quotes") {
                setTypeFilter("drivers");
              } else {
                setTypeFilter("all");
              }
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Type {typeFilter !== "all" && <span className="text-primary">({typeFilter === "quotes" ? "Quotes" : "Drivers"})</span>}
          </button>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-3">Details</div>
          <button 
            className="col-span-1 flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => {
              const cycle = ["all", "new", "qualified", "onboarding", "ready", "converted", "rejected"];
              const idx = cycle.indexOf(stageFilter);
              setStageFilter(cycle[(idx + 1) % cycle.length] ?? "all");
            }}
          >
            Stage {stageFilter !== "all" && `(${stageFilter.slice(0, 3).toUpperCase()})`}
          </button>
          <button 
            className="col-span-1 flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => {
              if (sortMode === "newest") {
                setSortMode("oldest");
              } else if (sortMode === "oldest") {
                setSortMode("stage_priority");
              } else {
                setSortMode("newest");
              }
            }}
          >
            Submitted {sortMode === "oldest" && "↑"}{sortMode === "newest" && "↓"}{sortMode === "stage_priority" && "⚡"}
          </button>
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
              <div className="hidden grid-cols-13 gap-2 md:grid">
                <div className="col-span-2">{typePill(r.kind, r.typeLabel)}</div>
                <div className="col-span-3 font-medium">{r.name}</div>
                <div className="col-span-3 text-muted-foreground">{r.email}</div>
                <div className="col-span-3 text-muted-foreground">{r.detail || "—"}</div>
                <div className="col-span-1 text-muted-foreground">{r.status}</div>
                <div className="col-span-1 text-muted-foreground">{formatLocalDate(r.createdAt)}</div>
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
                <div className="text-xs text-muted-foreground">{formatLocalDate(r.createdAt)}</div>
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
                  <div className="mt-1 text-xs text-muted-foreground">Submitted: {formatLocalDate(selectedItem.createdAt)}</div>
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
                    <div className="text-muted-foreground">Service type: {selectedQuote.serviceType || "—"}</div>
                    <div className="text-muted-foreground">Pickup date: {selectedQuote.pickupDate || "—"}</div>
                    <div className="text-muted-foreground">Pickup: {selectedQuote.pickupLocation || "—"}</div>
                    <div className="text-muted-foreground">Dropoff: {selectedQuote.dropoffLocation || "—"}</div>
                    {selectedQuote.notes ? (
                      <div className="mt-2 rounded border border-border/40 bg-background/40 p-2 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">Notes:</div>
                        <div className="mt-1 whitespace-pre-wrap">{selectedQuote.notes}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selected.kind === "drivers" && selectedDriver ? (
                  <div className="grid gap-2 rounded-lg border border-border/60 bg-card/40 p-4 text-sm">
                    <div className="font-medium">Driver application</div>
                    <div className="text-muted-foreground">Phone: {selectedDriver.phone || "—"}</div>
                    <div className="text-muted-foreground">Truck type: {selectedDriver.truckType || "—"}</div>
                    <div className="text-muted-foreground">Years experience: {selectedDriver.yearsExperience || "—"}</div>
                    <div className="text-muted-foreground">Preferred routes: {selectedDriver.preferredRoutes || "—"}</div>
                    <div className="text-muted-foreground">Start date: {selectedDriver.startDate || "—"}</div>
                    {selectedDriver.notes ? (
                      <div className="mt-2 rounded border border-border/40 bg-background/40 p-2 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">Notes:</div>
                        <div className="mt-1 whitespace-pre-wrap">{selectedDriver.notes}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
