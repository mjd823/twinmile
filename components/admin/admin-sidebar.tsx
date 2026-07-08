"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  BarChart3,
  Truck,
  Package,
  Users,
  FileText,
  ClipboardCheck,
  Zap,
  Wrench,
  Calendar,
  UserCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Activity,
  TrendingUp,
  Clock,
  Shield,
  Send,
  Megaphone,
} from "lucide-react";

const navigation = [
  { name: "Lead Engine", href: "/admin/lead-engine", icon: Zap },
  { name: "Pipeline Flow", href: "/admin/pipeline", icon: TrendingUp },
  { name: "Outreach", href: "/admin/outreach", icon: Send },
  { name: "Social Posts", href: "/admin/social", icon: Megaphone },
  { name: "Automation Center", href: "/admin/automation", icon: Activity },
  { name: "AI Agents", href: "/admin/agents", icon: Users },
  { name: "Timesheet", href: "/admin/timesheet", icon: Clock },
  { name: "Supervisor", href: "/admin/supervisor", icon: Shield },
  { name: "Calendar", href: "/admin/calendar", icon: Calendar },
  { name: "Inbox", href: "/admin/inbox", icon: Inbox },
  { name: "Operations", href: "/admin", icon: BarChart3 },
  { name: "Fleet", href: "/admin/fleet", icon: Truck },
  { name: "Loads", href: "/admin/loads", icon: Package },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Contracts", href: "/admin/contracts", icon: FileText },
  { name: "Lease Agreements", href: "/admin/lease-agreements", icon: ClipboardCheck },
  { name: "Fuel", href: "/admin/fuel", icon: Zap },
  { name: "Maintenance", href: "/admin/maintenance", icon: Wrench },
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Drivers", href: "/admin/drivers", icon: UserCheck },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

interface AdminSidebarProps {
  className?: string;
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0 overflow-hidden rounded-r-lg border border-border/60 bg-card/60 backdrop-blur transition-all duration-300 md:block",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="border-b border-border/60 p-3">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
              Admin
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <nav className="p-2">
        <div className="grid gap-1 text-sm">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-primary font-medium",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

interface AdminMobileNavProps {
  className?: string;
}

export function AdminMobileNav({ className }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn("md:hidden", className)}>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 h-9 w-9 p-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile navigation overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-4 top-4 z-50 rounded-lg border border-border/60 bg-card/90 p-4 shadow-lg backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-muted-foreground">Admin</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </Button>
            </div>
            <nav className="grid gap-1 text-sm">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      isActive && "bg-accent text-primary font-medium"
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
