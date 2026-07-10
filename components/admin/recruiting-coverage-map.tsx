"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { stageDef } from "@/lib/pipeline-stages";
import type { RecruitingCoverage, StateCoverage } from "@/lib/recruiting-coverage";

/**
 * Recruiting coverage map — a US state tile cartogram driven by REAL
 * prospect data (outbound_prospects locations). Replaces the old fake
 * "Map placeholder (Phase A)" whose truck dots were positioned by index
 * arithmetic.
 *
 * Fill = prospects per state on a single-hue sequential ramp (validated for
 * monotonic lightness + CVD separation on the dark surface). Every tile
 * carries its own label, so identity and value are never color-alone.
 */

// ── Tile cartogram layout (11 × 8, geography-preserving) ─────────────────────
const TILE_POS: Record<string, [col: number, row: number]> = {
  AK: [0, 0], ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], WI: [5, 2], MI: [7, 2], NY: [8, 2], MA: [9, 2], RI: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IL: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

// Sequential single-hue ramp (dark surface): monotonic lightness, CVD-safe.
const RAMP = ["#22374f", "#25527e", "#1f76c1", "#2496f9", "#70c6ff"];
/** Light text on the darker steps, dark text on the brighter ones. */
const RAMP_TEXT = ["#e6edf5", "#e6edf5", "#f4f8fc", "#06121d", "#06121d"];

function rampIndex(count: number, max: number): number {
  if (count <= 0 || max <= 0) return -1;
  const t = count / max;
  if (t <= 0.2) return 0;
  if (t <= 0.4) return 1;
  if (t <= 0.6) return 2;
  if (t <= 0.8) return 3;
  return 4;
}

export function RecruitingCoverageMap({ coverage }: { coverage: RecruitingCoverage }) {
  const byState = React.useMemo(
    () => new Map(coverage.states.map((s) => [s.state, s])),
    [coverage.states]
  );
  const max = coverage.states.length > 0 ? coverage.states[0].total : 0;
  const [selected, setSelected] = React.useState<string | null>(
    coverage.states.length > 0 ? coverage.states[0].state : null
  );
  const sel: StateCoverage | null = selected ? byState.get(selected) ?? null : null;

  // Legend bin edges for the current max (shown as real counts, not %).
  const edges = [1, 0.2, 0.4, 0.6, 0.8].map((t, i) =>
    i === 0 ? 1 : Math.floor(max * t) + 1
  );

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-4">
        <div>
          <div className="text-sm font-semibold tracking-tight">Where your prospects are</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {coverage.totals.prospects.toLocaleString()} real FMCSA prospects across{" "}
            {coverage.totals.statesCovered} states — tap a state for the breakdown
          </p>
        </div>
        {/* Legend — sequential ramp with real count ranges */}
        <div className="flex items-center gap-1" aria-hidden>
          <span className="mr-1 text-[10px] text-muted-foreground">fewer</span>
          {RAMP.map((hex, i) => (
            <span
              key={i}
              className="h-3 w-5 rounded-sm"
              style={{ backgroundColor: hex }}
              title={`${edges[i]}+ prospects`}
            />
          ))}
          <span className="ml-1 text-[10px] text-muted-foreground">more</span>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: "repeat(11, minmax(0, 1fr))" }}
          role="listbox"
          aria-label="Prospects by state"
        >
          {Object.entries(TILE_POS).map(([abbr, [col, row]]) => {
            const data = byState.get(abbr);
            const count = data?.total ?? 0;
            const idx = rampIndex(count, max);
            const isSelected = selected === abbr;
            return (
              <button
                key={abbr}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => setSelected(abbr)}
                title={`${abbr}: ${count.toLocaleString()} prospect${count === 1 ? "" : "s"}`}
                className={cn(
                  "flex aspect-square min-w-0 flex-col items-center justify-center rounded-[4px] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  idx < 0 && "border border-border/40 bg-transparent",
                  isSelected && "ring-2 ring-ring scale-[1.06] z-10"
                )}
                style={{
                  gridColumn: col + 1,
                  gridRow: row + 1,
                  ...(idx >= 0 ? { backgroundColor: RAMP[idx] } : {}),
                }}
              >
                <span
                  className="text-[9px] font-semibold leading-none sm:text-[11px]"
                  style={{ color: idx >= 0 ? RAMP_TEXT[idx] : "hsl(var(--muted-foreground))" }}
                >
                  {abbr}
                </span>
                {count > 0 && (
                  <span
                    className="hidden text-[9px] leading-tight tabular-nums sm:block"
                    style={{ color: RAMP_TEXT[idx] }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail panel for the selected state */}
        <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
          {sel ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-sm font-semibold">
                {sel.state} — {sel.total.toLocaleString()} prospect{sel.total === 1 ? "" : "s"}
              </span>
              <StagePill hex={stageDef("sourced").hex} label={stageDef("sourced").shortLabel} value={sel.sourced} />
              <StagePill hex={stageDef("qualified").hex} label={stageDef("qualified").shortLabel} value={sel.qualified} />
              <StagePill hex={stageDef("invited").hex} label={stageDef("invited").shortLabel} value={sel.invited} />
              {/* engagedPlus counts prospect statuses only (replied and past);
                  clicked-link engagement lives in onboarding_sessions without a
                  state, so hide the zero to avoid a fake "0 engaged" reading. */}
              {sel.engagedPlus > 0 && (
                <StagePill hex={stageDef("engaged").hex} label={`${stageDef("engaged").shortLabel}+`} value={sel.engagedPlus} />
              )}
              {sel.rejected > 0 && <StagePill hex="#ef4444" label="Rejected" value={sel.rejected} />}
            </div>
          ) : selected ? (
            <p className="text-xs text-muted-foreground">
              {selected}: no prospects yet — Sofia hasn&apos;t sampled this state.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Tap a state to see its breakdown.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StagePill({ hex, label, value }: { hex: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hex }} />
      <span className="font-semibold tabular-nums text-foreground">{value.toLocaleString()}</span>
      {label}
    </span>
  );
}
