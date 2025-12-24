"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DriverOption = {
  id: string;
  email: string;
};

type TruckRow = {
  id: string;
  name: string;
  status: string;
  fuelPct: number;
  driverName?: string;
  driverUserId?: string;
};

export function AdminTrucksForm({
  trucks,
  drivers,
}: {
  trucks: TruckRow[];
  drivers: DriverOption[];
}) {
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [assignStatus, setAssignStatus] = React.useState<string | null>(null);
  const [assigningTruckId, setAssigningTruckId] = React.useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      status: String(formData.get("status") ?? "idle"),
      fuelPct: Number(formData.get("fuelPct") ?? 0),
      lat: formData.get("lat") ? Number(formData.get("lat")) : undefined,
      lng: formData.get("lng") ? Number(formData.get("lng")) : undefined,
      driverName: String(formData.get("driverName") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/admin/trucks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setStatus(data?.error ?? "Unable to create truck.");
        return;
      }

      setStatus("Truck created. Reload the page to see it in the list.");
      e.currentTarget.reset();
    } catch {
      setStatus("Unable to create truck.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Add truck</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Create a fleet unit for operations tracking.
        </div>

        <form onSubmit={onCreate} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="name">
              Unit name
            </label>
            <Input id="name" name="name" placeholder="TM-101" required />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="h-9 rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
              defaultValue="idle"
            >
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="fuelPct">
              Fuel %
            </label>
            <Input id="fuelPct" name="fuelPct" type="number" min={0} max={100} defaultValue={50} />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="lat">
                Lat (optional)
              </label>
              <Input id="lat" name="lat" type="number" step="any" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="lng">
                Lng (optional)
              </label>
              <Input id="lng" name="lng" type="number" step="any" />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="driverName">
              Driver name (optional)
            </label>
            <Input id="driverName" name="driverName" />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create truck"}
          </Button>
          {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Fleet</div>
        <div className="mt-2 text-sm text-muted-foreground">Current trucks in the system.</div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-5">Unit</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-2">Fuel</div>
            <div className="col-span-2">Driver</div>
          </div>
          {trucks.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No trucks yet.</div>
          ) : (
            trucks.map((t) => (
              <div key={t.id} className="border-b border-border/60 px-4 py-3 text-sm">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5 font-medium">{t.name}</div>
                  <div className="col-span-3 text-muted-foreground">{t.status}</div>
                  <div className="col-span-2 text-muted-foreground">{t.fuelPct}%</div>
                  <div className="col-span-2 text-muted-foreground">
                    {t.driverName || "—"}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-8">
                    <select
                      className="h-9 w-full rounded-md border border-border/70 bg-background/50 px-3 text-sm shadow-sm shadow-black/10 backdrop-blur"
                      defaultValue={t.driverUserId ?? ""}
                      onChange={async (e) => {
                        setAssignStatus(null);
                        setAssigningTruckId(t.id);
                        const next = e.currentTarget.value || null;

                        try {
                          const res = await fetch(
                            `/api/admin/trucks/${t.id}/assign-driver`,
                            {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ driverUserId: next }),
                            }
                          );
                          const data = (await res.json().catch(() => null)) as any;
                          if (!res.ok) {
                            setAssignStatus(data?.error ?? "Unable to assign driver.");
                            return;
                          }
                          setAssignStatus(
                            next ? "Driver assigned. Reload to see changes." : "Driver unassigned. Reload to see changes."
                          );
                        } catch {
                          setAssignStatus("Unable to assign driver.");
                        } finally {
                          setAssigningTruckId(null);
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={assigningTruckId === t.id}
                      onClick={async () => {
                        setAssignStatus(null);
                        setAssigningTruckId(t.id);
                        try {
                          const res = await fetch(
                            `/api/admin/trucks/${t.id}/assign-driver`,
                            {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ driverUserId: null }),
                            }
                          );
                          const data = (await res.json().catch(() => null)) as any;
                          if (!res.ok) {
                            setAssignStatus(data?.error ?? "Unable to unassign driver.");
                            return;
                          }
                          setAssignStatus("Driver unassigned. Reload to see changes.");
                        } catch {
                          setAssignStatus("Unable to unassign driver.");
                        } finally {
                          setAssigningTruckId(null);
                        }
                      }}
                    >
                      Unassign
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {assignStatus ? (
          <div className="mt-4 text-sm text-muted-foreground">{assignStatus}</div>
        ) : null}
      </div>
    </div>
  );
}
