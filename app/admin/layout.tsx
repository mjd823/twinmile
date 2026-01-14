import Link from "next/link";

import { getAuthUser } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  const isAdmin = Boolean(user && user.role === "admin");

  if (!isAdmin) {
    return <div className="mx-auto w-full max-w-7xl px-5 py-6">{children}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6">
      <div className="mb-4 overflow-auto rounded-lg border border-border/60 bg-card/60 p-2 backdrop-blur md:hidden">
        <nav className="flex items-center gap-2 text-sm">
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin"
          >
            Operations
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/fleet"
          >
            Fleet
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/loads"
          >
            Loads
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/customers"
          >
            Customers
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/contracts"
          >
            Contracts
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/fuel"
          >
            Fuel
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/maintenance"
          >
            Maintenance
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/events"
          >
            Events
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/inbox"
          >
            Inbox
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/drivers"
          >
            Drivers
          </Link>
          <Link
            className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/settings"
          >
            Settings
          </Link>
        </nav>
      </div>

      <div className="flex gap-6">
      <aside className="sticky top-20 hidden h-[calc(100vh-6.5rem)] w-64 shrink-0 overflow-auto rounded-lg border border-border/60 bg-card/60 p-3 backdrop-blur md:block">
        <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
          Admin
        </div>
        <nav className="grid gap-1 text-sm">
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin"
          >
            Operations
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/fleet"
          >
            Fleet
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/loads"
          >
            Loads
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/customers"
          >
            Customers
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/contracts"
          >
            Contracts
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/fuel"
          >
            Fuel
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/maintenance"
          >
            Maintenance
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/events"
          >
            Events
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/inbox"
          >
            Inbox
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/drivers"
          >
            Drivers
          </Link>
          <Link
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href="/admin/settings"
          >
            Account Settings
          </Link>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
