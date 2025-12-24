import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-2xl">
            <div className="text-sm font-medium text-muted-foreground">404</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Page not found
            </h1>
            <p className="mt-4 text-muted-foreground">
              The page you’re looking for doesn’t exist or has moved.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/">Go home</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/get-a-quote">Get a Quote</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
