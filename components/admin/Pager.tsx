import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared pager: always states the REAL total ("Showing 1–50 of 1,463 ·
 * newest first") and navigates via ?page= links — no silent truncation,
 * anywhere.
 */
export function Pager({
  page,
  pageCount,
  pageSize,
  total,
  makeHref,
  suffix = "newest first",
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** Build the href for a given page number (keeps other params). */
  makeHref: (page: number) => string;
  suffix?: string;
  className?: string;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <p className="text-xs tabular-nums text-muted-foreground">
        {total === 0
          ? "0 results"
          : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
        {suffix ? <span> · {suffix}</span> : null}
      </p>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <PagerLink href={makeHref(page - 1)} disabled={page <= 1} label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </PagerLink>
          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            page {page.toLocaleString()} / {pageCount.toLocaleString()}
          </span>
          <PagerLink href={makeHref(page + 1)} disabled={page >= pageCount} label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </PagerLink>
        </nav>
      )}
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/40 text-muted-foreground/30">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </Link>
  );
}
