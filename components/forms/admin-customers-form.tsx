"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerAction, deleteCustomerAction, updateCustomerAction } from "@/app/actions/admin";

type CustomerRow = {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
};

export function AdminCustomersForm({ customers }: { customers: CustomerRow[] }) {
  const [rows, setRows] = React.useState<CustomerRow[]>(customers);
  const [busy, setBusy] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });

  React.useEffect(() => {
    setRows(customers);
  }, [customers]);

  React.useEffect(() => {
    if (!createOpen) {
      setCreateStatus(null);
      setDraft({ name: "", contactEmail: "", contactPhone: "", notes: "" });
    }
  }, [createOpen]);

  React.useEffect(() => {
    if (!editOpen) {
      setEditStatus(null);
      setSelectedId(null);
      setEditDraft({ name: "", contactEmail: "", contactPhone: "", notes: "" });
    }
  }, [editOpen]);

  const selectedRow = React.useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

  React.useEffect(() => {
    if (!editOpen || !selectedRow) return;
    setEditDraft({
      name: String(selectedRow.name ?? ""),
      contactEmail: String(selectedRow.contactEmail ?? ""),
      contactPhone: String(selectedRow.contactPhone ?? ""),
      notes: String(selectedRow.notes ?? ""),
    });
  }, [editOpen, selectedRow]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const payload = {
      name: String(draft.name ?? ""),
      contactEmail: String(draft.contactEmail ?? "") || undefined,
      contactPhone: String(draft.contactPhone ?? "") || undefined,
      notes: String(draft.notes ?? "") || undefined,
    };

    try {
      const data = await createCustomerAction(payload);
      if (!data.ok) {
        setCreateStatus(data.error ?? "Unable to create customer.");
        return;
      }

      const nextRow: CustomerRow = {
        id: String((data as any)?.customerId ?? ""),
        name: String(payload.name ?? ""),
        contactEmail: payload.contactEmail ? String(payload.contactEmail) : "",
        contactPhone: payload.contactPhone ? String(payload.contactPhone) : "",
        notes: payload.notes ? String(payload.notes) : "",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
      }

      setCreateOpen(false);
    } catch {
      setCreateStatus("Unable to create customer.");
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
      name: String(editDraft.name ?? ""),
      contactEmail: String(editDraft.contactEmail ?? "") || "",
      contactPhone: String(editDraft.contactPhone ?? "") || "",
      notes: String(editDraft.notes ?? "") || "",
    };

    try {
      const data = await updateCustomerAction(selectedId, payload);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to save customer.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                name: payload.name,
                contactEmail: payload.contactEmail,
                contactPhone: payload.contactPhone,
                notes: payload.notes,
              }
            : r
        )
      );

      setEditOpen(false);
    } catch {
      setEditStatus("Unable to save customer.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setEditStatus(null);
    setBusy(true);
    try {
      const data = await deleteCustomerAction(selectedId);
      if (!data.ok) {
        setEditStatus(data.error ?? "Unable to delete customer.");
        return;
      }

      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setEditOpen(false);
    } catch {
      setEditStatus("Unable to delete customer.");
    } finally {
      setBusy(false);
    }
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
          + Add customer
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-5">Name</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-3">Phone</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No customers yet.</div>
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
              <div className="col-span-5 font-medium">{c.name}</div>
              <div className="col-span-4 text-muted-foreground">{c.contactEmail || "—"}</div>
              <div className="col-span-3 text-muted-foreground">{c.contactPhone || "—"}</div>
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
                  <div className="text-lg font-semibold tracking-tight">Create customer</div>
                  <div className="mt-1 text-sm text-muted-foreground">Add a customer record.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onCreate} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-name">
                    Customer name
                  </label>
                  <Input
                    id="create-name"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-contact-email">
                      Contact email
                    </label>
                    <Input
                      id="create-contact-email"
                      type="email"
                      value={draft.contactEmail}
                      onChange={(e) => setDraft((p) => ({ ...p, contactEmail: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="create-contact-phone">
                      Contact phone
                    </label>
                    <Input
                      id="create-contact-phone"
                      value={draft.contactPhone}
                      onChange={(e) => setDraft((p) => ({ ...p, contactPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="create-notes">
                    Notes
                  </label>
                  <Textarea
                    id="create-notes"
                    value={draft.notes}
                    onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                <Button type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create customer"}
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
                  <div className="text-lg font-semibold tracking-tight">Customer</div>
                  <div className="mt-1 text-sm text-muted-foreground">Edit or delete this customer.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={onSave} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-customer-name">Customer name</label>
                  <Input
                    id="edit-customer-name"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-customer-email">Contact email</label>
                    <Input
                      id="edit-customer-email"
                      type="email"
                      value={editDraft.contactEmail}
                      onChange={(e) => setEditDraft((p) => ({ ...p, contactEmail: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="edit-customer-phone">Contact phone</label>
                    <Input
                      id="edit-customer-phone"
                      value={editDraft.contactPhone}
                      onChange={(e) => setEditDraft((p) => ({ ...p, contactPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="edit-customer-notes">Notes</label>
                  <Textarea
                    id="edit-customer-notes"
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
