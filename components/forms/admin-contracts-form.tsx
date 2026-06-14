"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createContractAction, deleteContractAction, updateContractAction } from "@/app/actions/admin";

type CustomerOption = { id: string; name: string };

type ContractRow = {
  id: string;
  customerId: string;
  name: string;
  rateType: string;
  rateUsd: number;
  notes?: string;
};

export function AdminContractsForm({
  customers,
  contracts,
  customerMap,
}: {
  customers: CustomerOption[];
  contracts: ContractRow[];
  customerMap?: Map<string, string>;
}) {
  const [rows, setRows] = React.useState<ContractRow[]>(contracts);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState({
    customerId: customers[0]?.id ?? "",
    name: "",
    rateType: "flat",
    rateUsd: 0,
    notes: "",
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({
    customerId: customers[0]?.id ?? "",
    name: "",
    rateType: "flat",
    rateUsd: 0,
    notes: "",
  });

  React.useEffect(() => {
    setRows(contracts);
  }, [contracts]);

  React.useEffect(() => {
    if (!createOpen) {
      setCreateStatus(null);
      setDraft({
        customerId: customers[0]?.id ?? "",
        name: "",
        rateType: "flat",
        rateUsd: 0,
        notes: "",
      });
    }
  }, [createOpen, customers]);

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
      customerId: String(selectedRow.customerId ?? customers[0]?.id ?? ""),
      name: String(selectedRow.name ?? ""),
      rateType: String(selectedRow.rateType ?? "flat"),
      rateUsd: Number(selectedRow.rateUsd ?? 0),
      notes: String(selectedRow.notes ?? ""),
    });
  }, [editOpen, selectedRow, customers]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const payload = {
      customerId: String(draft.customerId ?? ""),
      name: String(draft.name ?? ""),
      rateType: String(draft.rateType ?? "flat"),
      rateUsd: Number(draft.rateUsd ?? 0),
      notes: String(draft.notes ?? "") || undefined,
    };

    try {
      const data = await createContractAction(payload);
      if (!data.ok) {
        setCreateStatus(data.error ?? "Unable to create contract.");
        return;
      }

      const nextRow: ContractRow = {
        id: String((data as any)?.contractId ?? ""),
        customerId: payload.customerId,
        name: payload.name,
        rateType: payload.rateType,
        rateUsd: Number(payload.rateUsd ?? 0),
        notes: payload.notes ? String(payload.notes) : "",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
      }

      setCreateOpen(false);
    } catch {
      setCreateStatus("Unable to create contract.");
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
      customerId: String(editDraft.customerId ?? ""),
      name: String(editDraft.name ?? ""),
      rateType: String(editDraft.rateType ?? "flat"),
      rateUsd: Number(editDraft.rateUsd ?? 0),
      notes: String(editDraft.notes ?? "") || "",
    };

    try {
      const data = await updateContractAction(selectedId, payload);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to save contract.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                customerId: payload.customerId,
                name: payload.name,
                rateType: payload.rateType,
                rateUsd: payload.rateUsd,
                notes: payload.notes,
              }
            : r
        )
      );

      setEditOpen(false);
    } catch {
      setEditStatus("Unable to save contract.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const data = await deleteContractAction(selectedId);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to delete contract.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setEditOpen(false);
    } catch {
      setEditStatus("Unable to delete contract.");
    } finally {
      setBusy(false);
    }
  }

  function customerName(customerId: string) {
    if (customerMap && customerMap.has(customerId)) {
      return customerMap.get(customerId) ?? "—";
    }
    return customers.find((c) => c.id === customerId)?.name ?? "—";
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
          + Add contract
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-4">Customer</div>
          <div className="col-span-4">Contract</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Rate</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No contracts yet.</div>
        ) : (
          rows.map((c) => (
            <button
              key={c.id}
              type="button"
              className="grid w-full grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
              onClick={() => {
                setSelectedId(c.id);
                setEditStatus(null);
                setEditOpen(true);
              }}
            >
              <div className="col-span-4 font-medium">{customerName(c.customerId)}</div>
              <div className="col-span-4 text-muted-foreground">{c.name}</div>
              <div className="col-span-2 text-muted-foreground">{c.rateType.replace("_", " ")}</div>
              <div className="col-span-2 text-muted-foreground">${Math.round(c.rateUsd).toLocaleString()}</div>
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
                  <div className="text-lg font-semibold tracking-tight">Create contract</div>
                  <div className="mt-1 text-sm text-muted-foreground">Create a pricing reference for a customer.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onCreate} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-customerId">Customer</label>
                  <select
                    id="create-customerId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    value={draft.customerId}
                    onChange={(e) => setDraft((p) => ({ ...p, customerId: e.currentTarget.value }))}
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-name">Contract name</label>
                  <Input
                    id="create-name"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-rateType">Rate type</label>
                    <select
                      id="create-rateType"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={draft.rateType}
                      onChange={(e) => setDraft((p) => ({ ...p, rateType: e.currentTarget.value }))}
                    >
                      <option value="flat">Flat</option>
                      <option value="per_mile">Per mile</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-rateUsd">Rate ($)</label>
                    <Input
                      id="create-rateUsd"
                      type="number"
                      min={0}
                      value={draft.rateUsd}
                      onChange={(e) => setDraft((p) => ({ ...p, rateUsd: Number(e.target.value ?? 0) }))}
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
                  {busy ? "Creating…" : "Create contract"}
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
                  <div className="text-lg font-semibold tracking-tight">Contract</div>
                  <div className="mt-1 text-sm text-muted-foreground">Edit or delete this contract.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onSave} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-contract-customerId">Customer</label>
                  <select
                    id="edit-contract-customerId"
                    className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                    value={editDraft.customerId}
                    onChange={(e) => setEditDraft((p) => ({ ...p, customerId: e.currentTarget.value }))}
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-contract-name">Contract name</label>
                  <Input
                    id="edit-contract-name"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-contract-rateType">Rate type</label>
                    <select
                      id="edit-contract-rateType"
                      className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      value={editDraft.rateType}
                      onChange={(e) => setEditDraft((p) => ({ ...p, rateType: e.currentTarget.value }))}
                    >
                      <option value="flat">Flat</option>
                      <option value="per_mile">Per mile</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-contract-rateUsd">Rate ($)</label>
                    <Input
                      id="edit-contract-rateUsd"
                      type="number"
                      min={0}
                      value={editDraft.rateUsd}
                      onChange={(e) => setEditDraft((p) => ({ ...p, rateUsd: Number(e.target.value ?? 0) }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-contract-notes">Notes</label>
                  <Textarea
                    id="edit-contract-notes"
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
