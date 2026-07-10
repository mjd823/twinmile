"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import type { PipelineCounts } from "@/lib/pipeline-stages";

/**
 * THE pipeline funnel — the one shared rendering of getPipelineCounts().
 *
 * Every stage shows BOTH numbers, clearly named:
 *  - the bar (and big number) = "reached": everyone who ever reached-or-passed
 *    the stage. Monotonically shrinking — the funnel shape.
 *  - the chip under the bar = "here now": who is currently parked there.
 *
 * Mobile-first: single column, centered proportional bars, conversion %
 * between bars. Colors come from the canonical taxonomy hexes.
 */

function pct(n: number | null): string {
  if (n === null) return "";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function PipelineFunnel({ counts }: { counts: PipelineCounts }) {
  const max = Math.max(1, ...counts.stages.map((s) => s.reached));

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Recruiting funnel</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bars count everyone who <span className="font-medium text-foreground">reached</span> a
            stage (so they always shrink). Chips show who is{" "}
            <span className="font-medium text-foreground">here now</span>.
          </p>
        </div>
        {counts.hasAnomaly && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            count anomaly — see flagged stage
          </span>
        )}
      </div>

      <ol className="space-y-0">
        {counts.stages.map((stage, i) => {
          const width = stage.reached > 0 ? Math.max(9, (stage.reached / max) * 100) : 0;
          return (
            <li key={stage.key}>
              {i > 0 && (
                <div className="flex items-center justify-center gap-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  <svg width="10" height="12" viewBox="0 0 10 12" className="opacity-50" aria-hidden>
                    <path d="M5 0v9M1.5 6.5 5 10l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                  {stage.conversionFromPrev !== null && (
                    <span>{pct(stage.conversionFromPrev)} of {counts.stages[i - 1].shortLabel.toLowerCase()}</span>
                  )}
                </div>
              )}

              <div className="rounded-lg px-1 py-1.5">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium" style={{ color: stage.hex }}>
                      {stage.label}
                    </span>
                    <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                      {stage.description}
                    </span>
                    {stage.anomaly && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-500 align-middle">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        exceeds previous stage
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-lg font-bold tabular-nums leading-none">
                      {stage.reached.toLocaleString()}
                    </span>
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      reached
                    </span>
                  </div>
                </div>

                {/* Centered proportional bar — the funnel silhouette */}
                <div className="flex justify-center">
                  <div
                    className="h-6 rounded-md transition-all duration-500"
                    style={{
                      width: `${width}%`,
                      backgroundColor: stage.hex,
                      opacity: stage.reached === 0 ? 0.18 : 0.9,
                      minWidth: stage.reached === 0 ? "9%" : undefined,
                    }}
                    title={`${stage.label}: ${stage.reached.toLocaleString()} reached`}
                  />
                </div>

                <div className="mt-1 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: stage.hex }}
                    />
                    <span className="font-semibold tabular-nums text-foreground">
                      {stage.inStage.toLocaleString()}
                    </span>
                    {stage.inStageLabel} now
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Off-funnel side buckets — never drawn as funnel bars */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Off funnel</span>
        {counts.offFunnel.map((b) => (
          <span
            key={b.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[11px]"
            title={b.description}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.hex }} />
            <span className="font-semibold tabular-nums">{b.count.toLocaleString()}</span>
            <span className="text-muted-foreground">{b.label}</span>
          </span>
        ))}
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {counts.totals.prospects.toLocaleString()} prospects · {counts.totals.driverLeads.toLocaleString()} applications
        </span>
      </div>
    </div>
  );
}
