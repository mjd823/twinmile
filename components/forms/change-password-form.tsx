"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/app/actions/auth";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

export function ChangePasswordForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload = {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
    };

    setStatus({ state: "submitting" });

    const result = await changePasswordAction(payload);
    if (!result.ok) {
      setStatus({ state: "error", message: result.error || "Unable to change password." });
      return;
    }

    setStatus({ state: "success" });
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="currentPassword">
          Current password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="newPassword">
          New password
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <Button type="submit" disabled={status.state === "submitting"}>
        {status.state === "submitting" ? "Saving…" : "Update password"}
      </Button>

      {status.state === "success" ? (
        <div className="text-sm text-muted-foreground">Password updated.</div>
      ) : null}

      {status.state === "error" ? (
        <div className="text-sm text-destructive">{status.message}</div>
      ) : null}
    </form>
  );
}
