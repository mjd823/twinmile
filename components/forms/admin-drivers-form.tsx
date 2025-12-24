"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DriverRow = {
  id: string;
  email: string;
};

export function AdminDriversForm({ drivers }: { drivers: DriverRow[] }) {
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);
  const [resetStatus, setResetStatus] = React.useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      tempPassword: String(formData.get("tempPassword") ?? ""),
    };

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

    setCreateStatus(`Driver created: ${data.email}. Reload the page to see it in the list.`);
    e.currentTarget.reset();
  }

  async function resetPassword(driverId: string, email: string) {
    setResetStatus(null);

    const res = await fetch(`/api/admin/drivers/${driverId}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setResetStatus(data?.error ?? "Unable to reset password.");
      return;
    }

    setResetStatus(
      `Temporary password for ${email}: ${data.tempPassword} (copy and send to driver)`
    );
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Create driver account</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Create a driver login (email + temporary password). Drivers sign in at /driver/login.
        </div>

        <form onSubmit={onCreate} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="email">
              Driver email
            </label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="tempPassword">
              Temporary password
            </label>
            <Input id="tempPassword" name="tempPassword" type="password" required />
            <div className="text-xs text-muted-foreground">Minimum 12 characters.</div>
          </div>
          <Button type="submit">Create driver</Button>
          {createStatus ? (
            <div className="text-sm text-muted-foreground">{createStatus}</div>
          ) : null}
        </form>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6">
        <div className="text-lg font-semibold tracking-tight">Driver accounts</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Reset password to generate a new temporary password.
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold">
            <div className="col-span-8">Email</div>
            <div className="col-span-4">Actions</div>
          </div>
          {drivers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No drivers yet.</div>
          ) : (
            drivers.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-12 gap-2 border-b border-border/60 px-4 py-3 text-sm"
              >
                <div className="col-span-8 font-medium">{d.email}</div>
                <div className="col-span-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetPassword(d.id, d.email)}
                  >
                    Reset password
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {resetStatus ? (
          <div className="mt-4 text-sm text-muted-foreground">{resetStatus}</div>
        ) : null}
      </div>
    </div>
  );
}
