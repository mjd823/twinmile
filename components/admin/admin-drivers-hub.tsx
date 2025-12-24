"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DriverListItem = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isOwnerOperator?: boolean;
  assignedTruckName?: string;
};

function fullName(d: { firstName?: string; lastName?: string; email: string }) {
  const name = `${String(d.firstName ?? "").trim()} ${String(d.lastName ?? "").trim()}`.trim();
  return name || d.email;
}

function shortId(id: string) {
  const s = String(id ?? "");
  return s.length >= 6 ? s.slice(-6) : s;
}

type Overview = {
  ok: boolean;
  driver: any;
  truck: any | null;
  currentLoad: any | null;
  fuelLogs: any[];
  maintenanceLogs: any[];
  routeEvents: any[];
};

function money(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "$0";
  return `$${Math.round(v).toLocaleString()}`;
}

export function AdminDriversHub({ drivers }: { drivers: DriverListItem[] }) {
  const router = useRouter();

  const [rows, setRows] = React.useState<DriverListItem[]>(drivers);
  const [selectedId, setSelectedId] = React.useState<string | null>(drivers[0]?.id ?? null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);

  const [editDraft, setEditDraft] = React.useState({ firstName: "", lastName: "", isOwnerOperator: false });
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(drivers);
  }, [drivers]);

  React.useEffect(() => {
    if (!rows.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && rows.some((r) => r.id === selectedId)) return;
    setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  React.useEffect(() => {
    if (!selectedId) return;
    const ac = new AbortController();

    async function load() {
      setStatus(null);
      setOverview(null);
      try {
        const res = await fetch(`/api/admin/drivers/${selectedId}/overview`, {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          setStatus(data?.error ?? "Unable to load driver.");
          return;
        }
        setOverview(data as Overview);
      } catch {
        // ignore
      }
    }

    load();
    return () => ac.abort();
  }, [selectedId]);

  React.useEffect(() => {
    setDeleteOpen(false);
  }, [selectedId]);

  React.useEffect(() => {
    if (!profileOpen) {
      setDeleteOpen(false);
    }
  }, [profileOpen]);

  React.useEffect(() => {
    const d = overview?.driver;
    if (!d) return;
    setEditDraft({
      firstName: String(d.firstName ?? ""),
      lastName: String(d.lastName ?? ""),
      isOwnerOperator: Boolean(d.isOwnerOperator),
    });
    setSaveStatus(null);
  }, [overview?.driver]);

  async function saveProfile() {
    if (!selectedId) return;
    setBusy(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/admin/drivers/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: editDraft.firstName,
          lastName: editDraft.lastName,
          isOwnerOperator: editDraft.isOwnerOperator,
        }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setSaveStatus(data?.error ?? "Unable to save driver profile.");
        return;
      }
      setSaveStatus("Saved.");

      setRows((prev) =>
        prev.map((d) =>
          d.id === selectedId
            ? {
                ...d,
                firstName: editDraft.firstName,
                lastName: editDraft.lastName,
                isOwnerOperator: editDraft.isOwnerOperator,
              }
            : d
        )
      );

      router.refresh();

      const o = await fetch(`/api/admin/drivers/${selectedId}/overview`, { method: "GET", cache: "no-store" });
      const odata = (await o.json().catch(() => null)) as any;
      if (o.ok) setOverview(odata as Overview);
    } catch {
      setSaveStatus("Unable to save driver profile.");
    } finally {
      setBusy(false);
    }
  }

  async function createDriver(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);
    setBusy(true);

    const formData = new FormData(e.currentTarget);
    const rawTempPassword = String(formData.get("tempPassword") ?? "").trim();
    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      tempPassword: rawTempPassword || undefined,
    };

    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setCreateStatus(data?.error ?? "Unable to create driver.");
        return;
      }
      if (data?.tempPassword) {
        setCreateStatus(`Driver created. Temporary password: ${String(data.tempPassword)} (copy + send). Reload to see list updates.`);
      } else {
        setCreateStatus("Driver created. Reload the page to see it in the list.");
      }
      e.currentTarget.reset();
      setCreateOpen(false);

      const nextRow: DriverListItem = {
        id: String(data?.driverId ?? ""),
        email: String(data?.email ?? payload.email),
        firstName: String(payload.firstName ?? ""),
        lastName: String(payload.lastName ?? ""),
        isOwnerOperator: false,
        assignedTruckName: "—",
      };

      if (nextRow.id) {
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
      }

      router.refresh();
    } catch {
      setCreateStatus("Unable to create driver.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!selectedId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/drivers/${selectedId}/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to reset password.");
        return;
      }
      setStatus(`Temporary password: ${data.tempPassword} (copy + send)`);
    } catch {
      setStatus("Unable to reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDriver() {
    if (!selectedId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/drivers/${selectedId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to delete driver.");
        return;
      }
      setStatus("Driver deleted. Reload the page to see list updates.");
      setDeleteOpen(false);

      setRows((prev) => prev.filter((d) => d.id !== selectedId));

      router.refresh();
    } catch {
      setStatus("Unable to delete driver.");
    } finally {
      setBusy(false);
    }
  }

  const truckName = overview?.truck?.name ? String(overview.truck.name) : "Unassigned";
  const fuelPct = Number(overview?.truck?.fuelPct ?? 0);
  const ownerOp = Boolean(overview?.driver?.isOwnerOperator);
  const driverDisplayName = overview?.driver
    ? `${String(overview.driver.firstName ?? "").trim()} ${String(overview.driver.lastName ?? "").trim()}`.trim() ||
      String(overview.driver.email ?? "—")
    : "—";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-tight">Drivers</div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCreateStatus(null);
            setCreateOpen(true);
          }}
        >
          + Add driver
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
          <div className="col-span-5">Driver</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-5">Assigned truck</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No drivers yet.</div>
        ) : (
          rows.map((d) => (
            <button
              key={d.id}
              type="button"
              className="grid w-full grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
              onClick={() => {
                setSelectedId(d.id);
                setProfileOpen(true);
              }}
            >
              <div className="col-span-5 font-medium">{fullName(d)} <span className="text-xs text-muted-foreground">#{shortId(d.id)}</span></div>
              <div className="col-span-2 text-muted-foreground">{d.isOwnerOperator ? "Owner-op" : "Company"}</div>
              <div className="col-span-5 text-muted-foreground">{d.assignedTruckName || "—"}</div>
            </button>
          ))
        )}
      </div>

      {profileOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setProfileOpen(false)}
          />
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Driver profile</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">
                    {driverDisplayName} {selectedId ? <span className="text-xs text-muted-foreground">#{shortId(selectedId)}</span> : null}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Truck: {truckName}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={Number.isFinite(fuelPct) && fuelPct < 15 ? "destructive" : "outline"}>
                    Truck fuel {Number.isFinite(fuelPct) ? fuelPct : 0}%
                  </Badge>
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setProfileOpen(false)} aria-label="Close">
                    ✕
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              {status ? (
                <div className="mt-4 rounded-md border border-border/60 bg-background/30 p-3 text-sm text-muted-foreground">
                  {status}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Driver details</div>
                    <Badge variant="outline">{ownerOp ? "Owner-op" : "Company"}</Badge>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="edit-firstName">First name</label>
                        <Input
                          id="edit-firstName"
                          value={editDraft.firstName}
                          onChange={(e) => {
                            const v = (e.target as HTMLInputElement | null)?.value ?? "";
                            setEditDraft((p) => ({ ...p, firstName: v }));
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="edit-lastName">Last name</label>
                        <Input
                          id="edit-lastName"
                          value={editDraft.lastName}
                          onChange={(e) => {
                            const v = (e.target as HTMLInputElement | null)?.value ?? "";
                            setEditDraft((p) => ({ ...p, lastName: v }));
                          }}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={editDraft.isOwnerOperator}
                        onChange={(e) => {
                          const checked = (e.target as HTMLInputElement | null)?.checked ?? false;
                          setEditDraft((p) => ({ ...p, isOwnerOperator: checked }));
                        }}
                      />
                      Owner-operator
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" disabled={busy || !selectedId} onClick={saveProfile}>
                        {busy ? "Saving…" : "Save"}
                      </Button>
                      {saveStatus ? <div className="text-sm text-muted-foreground">{saveStatus}</div> : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">Current load</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {overview?.currentLoad
                      ? `${String(overview.currentLoad.pickup ?? "—")} → ${String(overview.currentLoad.dropoff ?? "—")}`
                      : "No load assigned"}
                  </div>
                  {overview?.currentLoad ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Status: {String(overview.currentLoad.status ?? "planned").replace("_", " ")}
                      {" · "}Revenue {money(overview.currentLoad.revenueUsd)}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">Recent events</div>
                  <div className="mt-3 grid gap-2">
                    {(overview?.routeEvents ?? []).slice(0, 6).map((e: any) => (
                      <div key={String(e.id ?? e._id)} className="rounded-md border border-border/60 bg-background/30 p-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <div className="font-semibold">{String(e.name ?? "note").toUpperCase()}</div>
                          <div>{e.at ? String(e.at).slice(0, 16).replace("T", " ") : ""}</div>
                        </div>
                        <div className="mt-1 text-sm">{String(e.message ?? "")}</div>
                      </div>
                    ))}
                    {(overview?.routeEvents ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">No events yet.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/20 p-4 lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-tight">Account actions</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={busy || !selectedId} onClick={resetPassword}>
                        {busy ? "Resetting…" : "Reset password"}
                      </Button>
                      <Button type="button" variant="destructive" size="sm" disabled={busy || !selectedId} onClick={() => setDeleteOpen(true)}>
                        Delete driver
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Reset issues a new temporary password and forces a password change on next login.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-background/20 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setDeleteOpen(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="text-lg font-semibold tracking-tight">Delete driver?</div>
              <div className="mt-1 text-sm text-muted-foreground">
                This will unassign any trucks and sign the driver out.
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" disabled={busy || !selectedId} onClick={() => void deleteDriver()}>
                  {busy ? "Deleting…" : "Confirm delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                  <div className="text-lg font-semibold tracking-tight">Create driver</div>
                  <div className="mt-1 text-sm text-muted-foreground">Drivers sign in at /driver/login.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form onSubmit={createDriver} className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="firstName">First name</label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="lastName">Last name</label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="email">Driver email</label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="tempPassword">Temporary password</label>
                  <Input id="tempPassword" name="tempPassword" type="password" placeholder="Leave blank to auto-generate" />
                </div>
                <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create driver"}</Button>
                {createStatus ? <div className="text-sm text-muted-foreground">{createStatus}</div> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
