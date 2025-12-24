"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export function AdminInbox({
  quoteLeads,
  driverLeads,
}: {
  quoteLeads: QuoteLeadRow[];
  driverLeads: DriverLeadRow[];
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function updateLead(
    kind: "quotes" | "drivers",
    id: string,
    payload: { status?: LeadStatus; note?: string }
  ) {
    setMessage(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/leads/${kind}/${id}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setMessage(data?.error ?? "Unable to update lead.");
        return;
      }
      setMessage("Lead updated. Reload the page to see changes.");
    } catch {
      setMessage("Unable to update lead.");
    } finally {
      setBusyId(null);
    }
  }

  async function convertQuote(id: string) {
    setMessage(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/leads/quotes/${id}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ createLoad: true, rateType: "flat", rateUsd: 0 }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setMessage(data?.error ?? "Unable to convert lead.");
        return;
      }
      setMessage(
        `Converted. Customer ${data.customerId}, Contract ${data.contractId}${data.loadId ? `, Load ${data.loadId}` : ""}. Reload.`
      );
    } catch {
      setMessage("Unable to convert lead.");
    } finally {
      setBusyId(null);
    }
  }

  async function convertDriver(id: string) {
    setMessage(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/leads/drivers/${id}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setMessage(data?.error ?? "Unable to convert lead.");
        return;
      }
      setMessage(
        `Driver user created: ${data.email}. Temp password: ${data.tempPassword} (copy and send). Reload.`
      );
    } catch {
      setMessage("Unable to convert lead.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-8">
      {message ? (
        <div className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Quote Leads</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Work the pipeline: qualify, convert to customer/contract/load.
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Company</div>
            <div className="col-span-3">Route</div>
            <div className="col-span-3">Pipeline</div>
          </div>
          {quoteLeads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No leads yet.</div>
          ) : (
            quoteLeads.map((l) => (
              <div key={l.id} className="border-b border-border/60 px-4 py-3">
                <div className="grid grid-cols-12 gap-2 text-sm">
                  <div className="col-span-3 font-medium">{l.name || "—"}</div>
                  <div className="col-span-3 text-muted-foreground">{l.company || "—"}</div>
                  <div className="col-span-3 text-muted-foreground">
                    {l.pickupLocation} → {l.dropoffLocation}
                  </div>
                  <div className="col-span-3 text-muted-foreground">{l.status}</div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <select
                      className="h-9 w-full rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      defaultValue={l.status}
                      disabled={busyId === l.id}
                      onChange={(e) => updateLead("quotes", l.id, { status: e.currentTarget.value as LeadStatus })}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="converted">Converted</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <div className="md:col-span-6">
                    <Input
                      placeholder="Add note and press Enter"
                      disabled={busyId === l.id}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const target = e.currentTarget;
                        const note = target.value.trim();
                        if (!note) return;
                        void updateLead("quotes", l.id, { note });
                        target.value = "";
                      }}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={busyId === l.id || l.status === "converted"}
                      onClick={() => convertQuote(l.id)}
                    >
                      Convert
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Driver Applications</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Qualify applicants and convert to real driver accounts.
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2">Truck</div>
            <div className="col-span-2">Stage</div>
          </div>
          {driverLeads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No applications yet.</div>
          ) : (
            driverLeads.map((l) => (
              <div key={l.id} className="border-b border-border/60 px-4 py-3">
                <div className="grid grid-cols-12 gap-2 text-sm">
                  <div className="col-span-4 font-medium">{l.fullName || "—"}</div>
                  <div className="col-span-4 text-muted-foreground">{l.email || "—"}</div>
                  <div className="col-span-2 text-muted-foreground">{l.truckType || "—"}</div>
                  <div className="col-span-2 text-muted-foreground">{l.status}</div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <select
                      className="h-9 w-full rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      defaultValue={l.status}
                      disabled={busyId === l.id}
                      onChange={(e) => updateLead("drivers", l.id, { status: e.currentTarget.value as LeadStatus })}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="converted">Converted</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <Input
                      placeholder="Add note and press Enter"
                      disabled={busyId === l.id}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const target = e.currentTarget;
                        const note = target.value.trim();
                        if (!note) return;
                        void updateLead("drivers", l.id, { note });
                        target.value = "";
                      }}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={busyId === l.id || l.status === "converted"}
                      onClick={() => convertDriver(l.id)}
                    >
                      Convert
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
