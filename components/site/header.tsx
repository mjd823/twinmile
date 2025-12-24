"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

type MeResponse = {
  loggedIn: boolean;
  role: "admin" | "driver" | null;
  portalHref: string | null;
};

export function SiteHeader() {
  const [me, setMe] = React.useState<MeResponse>({
    loggedIn: false,
    role: null,
    portalHref: null,
  });

  React.useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as MeResponse;
        setMe({
          loggedIn: Boolean(data?.loggedIn && data?.portalHref),
          role: data?.role ?? null,
          portalHref: data?.portalHref ?? null,
        });
      } catch {
        // ignore
      }
    }

    load();
    return () => ac.abort();
  }, []);

  const portalHref = me.loggedIn ? me.portalHref : null;
  const accountSettingsHref =
    me.role === "admin"
      ? "/admin/settings/password"
      : me.role === "driver"
        ? "/driver/settings/password"
        : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/55">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Twin Mile Logistics"
            width={220}
            height={48}
            priority
          />
          <span className="sr-only">Twin Mile Logistics</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link className="transition-colors hover:text-foreground" href="/services">
            Services
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/service-areas">
            Areas
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/industries">
            Industries
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/blog">
            Blog
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/about">
            About
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/contact">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <details className="relative md:hidden">
            <summary className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border/60 bg-background/60 text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <span className="sr-only">Open menu</span>
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </summary>
            <div className="absolute right-0 mt-3 w-[min(92vw,360px)] overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
              <div className="grid gap-1 p-2 text-sm">
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/services">
                  Services
                </Link>
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/service-areas">
                  Areas
                </Link>
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/industries">
                  Industries
                </Link>
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/blog">
                  Blog
                </Link>
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/about">
                  About
                </Link>
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/contact">
                  Contact
                </Link>
              </div>
              <div className="border-t border-border/60 p-2">
                <Button asChild className="w-full">
                  <Link href="/get-a-quote">Get a Quote</Link>
                </Button>
                <Button asChild variant="outline" className="mt-2 w-full">
                  <Link href="/drive-with-us">Drive With Us</Link>
                </Button>
                {!portalHref ? (
                  <Button asChild variant="outline" className="mt-2 w-full">
                    <Link href="/driver/login">Sign in</Link>
                  </Button>
                ) : null}
                {portalHref ? (
                  <div className="mt-2 grid gap-2">
                    <Button asChild variant="outline" className="w-full">
                      <Link href={portalHref}>Dashboard</Link>
                    </Button>
                    {accountSettingsHref ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={accountSettingsHref}>Account settings</Link>
                      </Button>
                    ) : null}
                    <form action="/api/auth/logout" method="post">
                      <Button variant="outline" className="w-full" type="submit">
                        Sign out
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </details>
          {portalHref ? (
            <details className="relative hidden sm:block">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center rounded-md border border-border/60 bg-background/60 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                Account
              </summary>
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
                <div className="grid gap-1 p-2 text-sm">
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href={portalHref}
                  >
                    Dashboard
                  </Link>
                  {accountSettingsHref ? (
                    <Link
                      className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      href={accountSettingsHref}
                    >
                      Account settings
                    </Link>
                  ) : null}
                </div>
                <div className="border-t border-border/60 p-2">
                  <form action="/api/auth/logout" method="post">
                    <Button variant="outline" className="w-full" type="submit">
                      Sign out
                    </Button>
                  </form>
                </div>
              </div>
            </details>
          ) : (
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/drive-with-us">Drive With Us</Link>
            </Button>
          )}
          {!portalHref ? (
            <details className="relative hidden sm:block">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center rounded-md border border-border/60 bg-background/60 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                Sign in
              </summary>
              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
                <div className="grid gap-1 p-2 text-sm">
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/driver/login"
                  >
                    Driver Sign In
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/admin/login"
                  >
                    Admin Sign In
                  </Link>
                </div>
              </div>
            </details>
          ) : null}
          {!portalHref ? (
            <Button asChild>
              <Link href="/get-a-quote">Get a Quote</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
