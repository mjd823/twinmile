import Link from "next/link";
import Image from "next/image";
import { ContactLinks } from "@/components/site/contact-links";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border/60">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-[320px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Twin Mile LLC - Fast. Tough. Reliable. Freight Transportation and Logistics" width={200} height={44} />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Fast. Tough. Reliable. Logistics built for the urgent.
            </div>
            <div className="mt-4 text-sm text-muted-foreground">HQ: Houston, TX</div>
            <ContactLinks />
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:col-span-7 md:grid-cols-3">
            <div className="flex flex-col gap-2 text-sm">
              <div className="text-xs font-semibold tracking-wide text-foreground/80">Company</div>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/about">
                About
              </Link>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/services">
                Services
              </Link>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/contact">
                Contact
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="text-xs font-semibold tracking-wide text-foreground/80">Get Started</div>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/get-a-quote">
                Get a Quote
              </Link>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/drive-with-us">
                Drive With Us
              </Link>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/blog">
                Blog
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="text-xs font-semibold tracking-wide text-foreground/80">Legal</div>
              <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/privacy-policy">
                Privacy Policy
              </Link>
              <div className="text-muted-foreground">© {new Date().getFullYear()} Twin Mile LLC</div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          Nationwide logistics • Freight transportation • Hotshot • Last‑mile • Dispatching • Warehousing • 3PL
        </div>
      </div>
    </footer>
  );
}
