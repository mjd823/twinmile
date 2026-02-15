"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/app/actions/auth";

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
  const [showPassword, setShowPassword] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role,
    };

    setStatus({ state: "submitting" });

    const result = await loginAction(payload);
    if (!result.ok) {
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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
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
