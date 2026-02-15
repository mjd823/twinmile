"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logoutAction, meAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

type MeResponse = {
  loggedIn: boolean;
  role: "admin" | "driver" | null;
  portalHref: string | null;
};

export function SiteHeader() {
  const pathname = usePathname();
  const [me, setMe] = React.useState<MeResponse>({
    loggedIn: false,
    role: null,
    portalHref: null,
  });

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);

  const mobileRef = React.useRef<HTMLDivElement | null>(null);
  const accountRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        if (ac.signal.aborted) return;
        const data = (await meAction()) as MeResponse;
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
      ? "/admin/settings"
      : me.role === "driver"
        ? "/driver/settings/password"
        : null;

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMobileOpen(false);
      setAccountOpen(false);
    }

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (!target) return;

      if (mobileRef.current && mobileRef.current.contains(target)) return;
      if (accountRef.current && accountRef.current.contains(target)) return;

      setMobileOpen(false);
      setAccountOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

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
            className="h-auto w-36 sm:w-44 md:w-[220px]"
          />
          <span className="sr-only">Twin Mile Logistics</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link 
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/services" && "text-foreground font-medium"
            )} 
            href="/services"
          >
            Services
          </Link>
          <Link 
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/service-areas" && "text-foreground font-medium"
            )} 
            href="/service-areas"
          >
            Areas
          </Link>
          <Link 
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/industries" && "text-foreground font-medium"
            )} 
            href="/industries"
          >
            Industries
          </Link>
          <Link 
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/blog" && "text-foreground font-medium"
            )} 
            href="/blog"
          >
            Blog
          </Link>
          <Link 
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/about" && "text-foreground font-medium"
            )} 
            href="/about"
          >
            About
          </Link>
          <Link 
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/contact" && "text-foreground font-medium"
            )} 
            href="/contact"
          >
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button 
            asChild 
            size="sm" 
            className={cn(
              "h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm",
              pathname === "/get-a-quote" && "bg-primary/90 ring-2 ring-primary/50"
            )}
          >
            <Link href="/get-a-quote">Get a Quote</Link>
          </Button>
          <Button 
            asChild 
            variant="outline" 
            size="sm" 
            className={cn(
              "h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm",
              pathname === "/drive-with-us" && "bg-accent border-primary/50 text-foreground"
            )}
          >
            <Link href="/drive-with-us">Drive With Us</Link>
          </Button>

          <div ref={mobileRef} className="relative md:hidden">
            <button
              type="button"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background/60 text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-expanded={mobileOpen}
              aria-label="Open menu"
              onClick={() => {
                setMobileOpen((v) => !v);
                setAccountOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {mobileOpen ? (
              <div className="fixed inset-x-3 top-[72px] z-50 max-h-[calc(100vh-88px)] overflow-auto rounded-xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur md:hidden">
                <div className="grid gap-1 p-3 text-sm">
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/services"
                    onClick={() => setMobileOpen(false)}
                  >
                    Services
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/service-areas"
                    onClick={() => setMobileOpen(false)}
                  >
                    Areas
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/industries"
                    onClick={() => setMobileOpen(false)}
                  >
                    Industries
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/blog"
                    onClick={() => setMobileOpen(false)}
                  >
                    Blog
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/about"
                    onClick={() => setMobileOpen(false)}
                  >
                    About
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    href="/contact"
                    onClick={() => setMobileOpen(false)}
                  >
                    Contact
                  </Link>
                </div>
                <div className="border-t border-border/60 p-3">
                  {!portalHref ? (
                    <Button asChild variant="outline" className="mt-2 w-full">
                      <Link href="/driver/login" onClick={() => setMobileOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                  ) : null}
                  {portalHref ? (
                    <div className="mt-2 grid gap-2">
                      <Button asChild variant="outline" className="w-full">
                        <Link href={portalHref} onClick={() => setMobileOpen(false)}>
                          Dashboard
                        </Link>
                      </Button>
                      <form action={logoutAction}>
                        <Button variant="outline" className="w-full" type="submit">
                          Sign out
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {portalHref ? (
            <div ref={accountRef} className="relative hidden sm:block">
              <button
                type="button"
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background/60 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-expanded={accountOpen}
                onClick={() => {
                  setAccountOpen((v) => !v);
                  setMobileOpen(false);
                }}
              >
                Account
              </button>
              {accountOpen ? (
                <div className="absolute right-0 mt-2 max-h-[75vh] w-56 overflow-auto rounded-lg border border-border/60 bg-popover shadow-xl">
                  <div className="grid gap-1 p-2 text-sm">
                    <Link
                      className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      href={portalHref}
                      onClick={() => setAccountOpen(false)}
                    >
                      Dashboard
                    </Link>
                  </div>
                  <div className="border-t border-border/60 p-2">
                    <form action={logoutAction}>
                      <Button variant="outline" className="w-full" type="submit">
                        Sign out
                      </Button>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {!portalHref ? (
            <div className="relative hidden sm:block" ref={accountRef}>
              <Button 
                variant="outline" 
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
              >
                Sign in
              </Button>
              {accountOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border/60 bg-popover shadow-xl">
                  <div className="grid gap-1 p-2 text-sm">
                    <Link
                      className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      href="/driver/login"
                      onClick={() => setAccountOpen(false)}
                    >
                      Driver Sign in
                    </Link>
                    <Link
                      className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      href="/admin/login"
                      onClick={() => setAccountOpen(false)}
                    >
                      Admin Sign in
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
