"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for every /admin/* route segment.
 *
 * Before this existed, any server-component error in one admin tab (e.g. a
 * transient MongoNetworkError while loading lead-engine) bubbled to the ROOT
 * app/error.tsx, replacing the entire admin — sidebar, login, everything.
 * With this boundary the admin layout stays mounted: one broken tab renders
 * this card while every other tab keeps working.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[admin] route error:", error);
  }, [error]);

  const isDbError = /mongo|connection|topology|server selection|etimedout|econnreset/i.test(
    error?.message || ""
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12">
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-400">
          This tab hit an error
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {isDbError
            ? "Couldn't reach the database"
            : "Something went wrong loading this page"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isDbError
            ? "The database connection dropped for a moment. This is usually transient — try again and it should load."
            : "The rest of the admin is unaffected — use the sidebar to keep working, or retry this tab."}
        </p>
        {error?.digest && (
          <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">
            Error digest: {error.digest}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">Admin home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
