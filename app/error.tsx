"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-2xl">
            <div className="text-sm font-medium text-muted-foreground">Something broke</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              We hit an error
            </h1>
            <p className="mt-4 text-muted-foreground">
              Please try again. If it keeps happening, contact us.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button type="button" onClick={reset}>
                Try again
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Go home</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
