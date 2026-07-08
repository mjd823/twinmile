"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  PhoneOff,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Mobile-first daily call sheet — MJ or a partner dials from a phone.
 * Big tel: buttons, collapsible honest script, one-tap Mark Called /
 * Mark DNC. Compliance header is always visible.
 */

interface SheetItem {
  prospectId: string;
  dotNumber: string;
  name: string;
  company: string;
  phone: string;
  phoneDial: string;
  city: string;
  state: string;
  truckInfo: string;
  sourceTag: string;
  priorityScore: number;
  aiScore: number;
  callWindow: string;
  script: string;
  status: "pending" | "called" | "dnc";
  calledAt?: string | null;
}

interface Sheet {
  date: string;
  complianceHeader: string;
  items: SheetItem[];
}

const SOURCE_LABELS: Record<string, string> = {
  "fmcsa-new-authority": "New authority",
  "fmcsa-insurance-lapse": "Insurance lapse",
  "fmcsa-census": "Census",
};

const SOURCE_BADGE_CLASS: Record<string, string> = {
  "fmcsa-new-authority": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "fmcsa-insurance-lapse": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "fmcsa-census": "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CallSheetClient() {
  const [sheets, setSheets] = React.useState<Sheet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [openScript, setOpenScript] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const loadSheets = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/call-sheet?limit=7", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load call sheets (${res.status})`);
      const data = await res.json();
      setSheets(Array.isArray(data.sheets) ? data.sheets : []);
      setError(null);
    } catch (err) {
      console.error("Error loading call sheets:", err);
      setError("Could not load call sheets.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  const today = todayUtc();
  const sheet = sheets.find((s) => s.date === today) || sheets[0] || null;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/call-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      await loadSheets();
    } catch (err) {
      console.error("Error generating call sheet:", err);
      setError("Failed to generate the call sheet.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (item: SheetItem, action: "called" | "dnc") => {
    if (!sheet) return;
    if (
      action === "dnc" &&
      !confirm(`Mark ${item.company || item.name} as Do-Not-Call? This is permanent.`)
    ) {
      return;
    }
    const key = `${sheet.date}-${item.prospectId}-${action}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/call-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: sheet.date, prospectId: item.prospectId, action }),
      });
      if (!res.ok) throw new Error(`Action failed (${res.status})`);
      setSheets((prev) =>
        prev.map((s) =>
          s.date !== sheet.date
            ? s
            : {
                ...s,
                items: s.items.map((i) =>
                  i.prospectId === item.prospectId
                    ? { ...i, status: action === "dnc" ? "dnc" : "called" }
                    : i
                ),
              }
        )
      );
    } catch (err) {
      console.error("Call sheet action failed:", err);
      setError("Action failed — try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const pending = sheet?.items.filter((i) => i.status === "pending") ?? [];
  const done = sheet?.items.filter((i) => i.status !== "pending") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Phone className="h-5 w-5 text-primary" />
            Daily Call Sheet
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sheet ? `${sheet.date} — ${pending.length} to call, ${done.length} done` : "Phone-only prospects, prioritized daily at 13:30 UTC."}
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : "Generate today's sheet"}
        </Button>
      </div>

      {/* Compliance header — always visible */}
      <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-400">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {sheet?.complianceHeader ||
            "HUMAN DIALS ONLY — no autodialer, no AI voice. Honor “take me off” immediately with Mark DNC."}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading call sheet…</p>
      ) : !sheet ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No call sheet yet. Generate today&apos;s sheet to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...pending, ...done].map((item) => {
            const scriptKey = `${sheet.date}-${item.prospectId}`;
            const scriptOpen = openScript === scriptKey;
            const isDone = item.status !== "pending";
            return (
              <Card
                key={scriptKey}
                className={isDone ? "opacity-60" : undefined}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {item.company || item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          item.dotNumber ? `DOT ${item.dotNumber}` : null,
                          [item.city, item.state].filter(Boolean).join(", ") || null,
                          item.truckInfo,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={SOURCE_BADGE_CLASS[item.sourceTag] || ""}
                    >
                      {SOURCE_LABELS[item.sourceTag] || item.sourceTag}
                    </Badge>
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {item.callWindow}
                  </p>

                  {item.status === "dnc" ? (
                    <p className="text-sm font-medium text-red-400">
                      Do-Not-Call — never contact again
                    </p>
                  ) : item.status === "called" ? (
                    <p className="text-sm font-medium text-emerald-400">Called</p>
                  ) : (
                    <>
                      {/* Big dial button — mobile-first */}
                      <Button asChild className="h-12 w-full text-base">
                        <a href={`tel:${item.phoneDial}`}>
                          <Phone className="mr-2 h-5 w-5" />
                          Call {item.phone}
                        </a>
                      </Button>

                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium"
                        onClick={() => setOpenScript(scriptOpen ? null : scriptKey)}
                      >
                        Call script
                        {scriptOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {scriptOpen && (
                        <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-relaxed">
                          {item.script}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="h-11"
                          disabled={busyKey !== null}
                          onClick={() => handleAction(item, "called")}
                        >
                          <Check className="mr-1.5 h-4 w-4 text-emerald-500" />
                          Mark called
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 border-red-500/40 text-red-400 hover:bg-red-500/10"
                          disabled={busyKey !== null}
                          onClick={() => handleAction(item, "dnc")}
                        >
                          <PhoneOff className="mr-1.5 h-4 w-4" />
                          Mark DNC
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {sheet.items.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No phone-only prospects available today.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
