"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
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
          <Link className="transition-colors hover:text-foreground" href="/drive-with-us">
            Drive With Us
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
                <Link className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/drive-with-us">
                  Drive With Us
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
              </div>
            </div>
          </details>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/drive-with-us">Drive With Us</Link>
          </Button>
          <Button asChild>
            <Link href="/get-a-quote">Get a Quote</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
