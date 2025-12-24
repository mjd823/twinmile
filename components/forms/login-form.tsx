"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "error"; message: string };

export function LoginForm({
  role,
  redirectTo,
}: {
  role: "admin" | "driver";
  redirectTo: string;
}) {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role,
    };

    setStatus({ state: "submitting" });

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setStatus({ state: "error", message: "Invalid login." });
      return;
    }

    window.location.href = redirectTo;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <Button type="submit" disabled={status.state === "submitting"}>
        {status.state === "submitting" ? "Signing in…" : "Sign in"}
      </Button>

      {status.state === "error" ? (
        <div className="text-sm text-destructive">{status.message}</div>
      ) : null}
    </form>
  );
}
