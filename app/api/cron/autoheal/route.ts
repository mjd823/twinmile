import { NextRequest, NextResponse } from "next/server";
import type { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { runAutoHeal } from "@/lib/autoheal";
import { openBlockers, resolveBlocker } from "@/lib/agent-coordination";
import { getOperatingPicture, type OperatingPicture } from "@/lib/business-context";

/**
 * GET /api/cron/autoheal
 *
 * The repair loop. Runs every hour, including nights and weekends — repairs are
 * data operations, not messages, so quiet hours do not apply to them. This is
 * the "keep working when nobody is watching" half of the system.
 *
 * Each pass:
 *   1. Runs every vetted repair whose precondition is met (lib/autoheal.ts
 *      measures, repairs, then re-measures to verify it actually helped).
 *   2. Re-checks open blockers and closes the ones whose condition has cleared,
 *      so a human doing their part is detected automatically rather than
 *      needing someone to remember to un-pause the system.
 *
 * ?dry=1 reports what would be repaired without touching anything.
 *
 * Deliberately NOT here: writing or deploying code. Every repair is a named,
 * reviewed, idempotent operation from the registry. When the real fix needs new
 * code, an agent opens a blocker describing it instead — the one category where
 * an autonomous mistake has unbounded blast radius.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Blockers whose clearing condition can be checked from live data. Anything
 * detectable belongs here — a blocker a human silently resolved should close
 * itself, not sit open forever making the board look worse than reality.
 */
async function reconcileBlockers(db: Db, picture: OperatingPicture): Promise<string[]> {
  const closed: string[] = [];
  const open = await openBlockers(db);
  const openKeys = new Set(open.map((b) => b.key));

  const checks: { key: string; cleared: boolean; note: string }[] = [
    {
      key: "outreach_paused",
      cleared: picture.outreach.automationMode === "live",
      note: "OUTREACH_AUTOMATION is now live",
    },
    {
      key: "sending_identity_is_robot",
      cleared:
        !/^(no-?reply|alerts?|notifications?|do-?not-?reply)@/i.test(
          (picture.outreach.sendingIdentity.from.match(/<([^>]+)>/)?.[1] ||
            picture.outreach.sendingIdentity.from)
        ),
      note: "From address is no longer a robot mailbox",
    },
    {
      key: "orphaned_outreach_tasks",
      cleared: picture.outreach.orphanedTasks === 0,
      note: "no orphaned outreach tasks remain",
    },
    {
      key: "onboarding_completion_not_recorded",
      cleared: !picture.onboarding.completionRecordingBroken,
      note: "onboarding completions are being recorded",
    },
  ];

  for (const c of checks) {
    if (openKeys.has(c.key) && c.cleared) {
      if (await resolveBlocker(db, c.key, c.note)) closed.push(c.key);
    }
  }
  return closed;
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const now = new Date();

  try {
    const client = await clientPromise;
    const db = client.db();

    const results = await runAutoHeal(db, { dryRun });
    const picture = await getOperatingPicture(db);
    const blockersClosed = dryRun ? [] : await reconcileBlockers(db, picture);

    const repaired = results.filter((r) => r.ran && r.verified);
    const failed = results.filter((r) => r.ran && !r.verified);

    const summary = dryRun
      ? `Dry run: ${results.filter((r) => r.skipped === "dry run").length} repair(s) available.`
      : repaired.length || blockersClosed.length
        ? `Repaired ${repaired.length} condition(s); closed ${blockersClosed.length} blocker(s).`
        : "Nothing to repair — system clean.";

    await db.collection("agent_activity").insertOne({
      action: "autoheal",
      agent: { name: "AI Supervisor", role: "Reliability", department: "Platform" },
      activity: summary,
      result: {
        summary,
        dryRun,
        results,
        blockersClosed,
        openBlockers: picture.blockers.length,
        source: "vercel-cron",
      },
      success: failed.length === 0,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, dryRun, summary, results, blockersClosed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/autoheal] Fatal error:", error);
    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "autoheal",
        agent: { name: "AI Supervisor", role: "Reliability", department: "Platform" },
        activity: `Auto-heal failed: ${message}`,
        success: false,
        createdAt: now,
        timestamp: now,
      });
    } catch {
      // DB unreachable — the error response is the signal.
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
