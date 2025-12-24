"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DriverRow = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

function fullName(d: { firstName?: string; lastName?: string; email: string }) {
  const name = `${String(d.firstName ?? "").trim()} ${String(d.lastName ?? "").trim()}`.trim();
  return name || d.email;
}

export function AdminDriversForm({ drivers }: { drivers: DriverRow[] }) {
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);
  const [resetStatus, setResetStatus] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateStatus(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight">Drivers</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Create driver logins and reset passwords.
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => {
          setCreateStatus(null);
          setCreateOpen(true);
        }}>
          + Add driver
        </Button>
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
                  <div className="text-lg font-semibold tracking-tight">Create driver</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Drivers sign in at /driver/login.
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="px-6 py-5">
              <form
                onSubmit={async (e) => {
                  await onCreate(e);
                  setCreateOpen(false);
                }}
                className="grid gap-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="firstName">
                      First name
                    </label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="lastName">
                      Last name
                    </label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
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
                  <Input
                    id="tempPassword"
                    name="tempPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit">Create driver</Button>
                {createStatus ? (
                  <div className="text-sm text-muted-foreground">{createStatus}</div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

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
                <div className="col-span-8 font-medium">{fullName(d)}</div>
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
