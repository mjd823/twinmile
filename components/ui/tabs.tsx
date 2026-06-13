"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    orientation?: "horizontal" | "vertical";
  }
>(({ className, defaultValue, value, onValueChange, orientation = "horizontal", children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-4", className)}
    data-orientation={orientation}
    {...props}
  >
    {children}
  </div>
));
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & {
    "aria-label"?: string;
  }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    role="tablist"
    aria-label={props["aria-label"]}
  >
    {children}
  </div>
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ElementRef<"button">,
  React.ComponentPropsWithoutRef<"button"> & {
    value: string;
    disabled?: boolean;
    "data-state"?: string;
  }
>(({ className, value, disabled, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    role="tab"
    aria-selected={props["data-state"] === "active"}
    data-state={props["data-state"]}
    data-value={value}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & {
    value: string;
    forceMount?: boolean;
    "data-state"?: string;
  }
>(({ className, value, forceMount, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    role="tabpanel"
    data-state={props["data-state"]}
    data-value={value}
    {...props}
  >
    {forceMount || props["data-state"] === "active" ? children : null}
  </div>
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };