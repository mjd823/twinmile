"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { convertDriverLeadAction, convertQuoteLeadAction, updateLeadAction } from "@/app/actions/admin";

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
};

type DriverLeadRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  truckType: string;
  status: LeadStatus;
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
    }
  | {
      kind: "drivers";
      id: string;
      typeLabel: "Driver app";
      name: string;
      email: string;
      detail: string;
      status: LeadStatus;
    };

export function AdminInbox({
  quoteLeads,
  driverLeads,
}: {
  quoteLeads: QuoteLeadRow[];
  driverLeads: DriverLeadRow[];
}) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<{ kind: "quotes" | "drivers"; id: string } | null>(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [statusDraft, setStatusDraft] = React.useState<LeadStatus>("new");

  const rows = React.useMemo<InboxItem[]>(() => {
    const q: InboxItem[] = quoteLeads.map((l) => ({
      kind: "quotes",
      id: l.id,
      typeLabel: "Quote lead",
      name: l.name || "—",
      email: l.email || "—",
      detail: `${l.company || "—"} • ${l.pickupLocation || ""}${l.dropoffLocation ? ` → ${l.dropoffLocation}` : ""}`.trim(),
      status: l.status,
    }));

    const d: InboxItem[] = driverLeads.map((l) => ({
      kind: "drivers",
      id: l.id,
      typeLabel: "Driver app",
      name: l.fullName || "—",
      email: l.email || "—",
      detail: `${l.truckType || "—"}`,
      status: l.status,
    }));

    return [...q, ...d];
  }, [quoteLeads, driverLeads]);

  const selectedItem = React.useMemo(() => {
    if (!selected) return null;
    return rows.find((r) => r.kind === selected.kind && r.id === selected.id) ?? null;
  }, [rows, selected]);

  const selectedQuote = React.useMemo(() => {
    if (!selected || selected.kind !== "quotes") return null;
    return quoteLeads.find((l) => l.id === selected.id) ?? null;
  }, [quoteLeads, selected]);

  const selectedDriver = React.useMemo(() => {
    if (!selected || selected.kind !== "drivers") return null;
    return driverLeads.find((l) => l.id === selected.id) ?? null;
  }, [driverLeads, selected]);

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
        <div className="h-9" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="hidden grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold md:grid">
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-3">Details</div>
          <div className="col-span-1">Stage</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No leads yet.</div>
        ) : (
          rows.map((r) => (
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

                <Button
                  type="button"
                  disabled={selectedBusy || statusDraft === "converted"}
                  onClick={() => (selected.kind === "quotes" ? convertQuote(selectedItem.id) : convertDriver(selectedItem.id))}
                >
                  Convert
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
