"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDriverProfileAction, updateDriverProfileAction } from "@/app/actions/driver";

type Status =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "saving" }
  | { state: "success" }
  | { state: "error"; message: string };

type Profile = {
  firstName: string;
  lastName: string;
  isOwnerOperator: boolean;
  email: string;
};

export function DriverProfileForm() {
  const [status, setStatus] = React.useState<Status>({ state: "loading" });
  const [profile, setProfile] = React.useState<Profile | null>(null);

  React.useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        if (ac.signal.aborted) return;
        const result = await getDriverProfileAction();
        if (!result.ok) {
          setStatus({ state: "error", message: result.error ?? "Unable to load profile." });
          return;
        }
        setProfile({
          email: String(result.profile.email ?? ""),
          firstName: String(result.profile.firstName ?? ""),
          lastName: String(result.profile.lastName ?? ""),
          isOwnerOperator: Boolean(result.profile.isOwnerOperator),
        });
        setStatus({ state: "idle" });
      } catch {
        setStatus({ state: "error", message: "Unable to load profile." });
      }
    }

    load();
    return () => ac.abort();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;

    setStatus({ state: "saving" });

    const result = await updateDriverProfileAction({
      firstName: profile.firstName,
      lastName: profile.lastName,
      isOwnerOperator: profile.isOwnerOperator,
    });
    if (!result.ok) {
      setStatus({ state: "error", message: result.error || "Unable to save profile." });
      return;
    }

    setStatus({ state: "success" });
    setTimeout(() => setStatus({ state: "idle" }), 1200);
  }

  if (status.state === "loading") {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (status.state === "error") {
    return <div className="text-sm text-destructive">{status.message}</div>;
  }

  if (!profile) {
    return <div className="text-sm text-muted-foreground">No profile found.</div>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="firstName">First name</label>
          <Input
            id="firstName"
            value={profile.firstName}
            onChange={(e) => setProfile((p) => (p ? { ...p, firstName: e.currentTarget.value } : p))}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="lastName">Last name</label>
          <Input
            id="lastName"
            value={profile.lastName}
            onChange={(e) => setProfile((p) => (p ? { ...p, lastName: e.currentTarget.value } : p))}
            required
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={profile.isOwnerOperator}
          onChange={(e) => setProfile((p) => (p ? { ...p, isOwnerOperator: e.currentTarget.checked } : p))}
        />
        Owner-operator
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={status.state === "saving"}>
          {status.state === "saving" ? "Saving…" : "Save"}
        </Button>
        <Button asChild type="button" variant="outline">
          <a href="/driver/settings/password">Change password</a>
        </Button>
      </div>

      {status.state === "success" ? (
        <div className="text-sm text-muted-foreground">Profile updated.</div>
      ) : null}

      {status.state === "idle" ? (
        <div className="text-xs text-muted-foreground">Email is used for login and can’t be changed here.</div>
      ) : null}
    </form>
  );
}
