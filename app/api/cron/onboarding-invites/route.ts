import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/cron/onboarding-invites
 *
 * Vercel cron port of scripts/auto-onboarding-invite.mjs (previously ran on the
 * owner's laptop agent system and stalled 2026-06-23).
 *
 * Finds qualified outbound prospects (status "reviewed" AND aiScore >= 75),
 * creates an onboarding session + outreach task for each, and flips the
 * prospect status to "onboarding_invited".
 *
 * Idempotency: an atomic findOneAndUpdate (status reviewed -> onboarding_invited)
 * is used as the claim BEFORE creating the session/task, so a prospect can only
 * ever be invited once even if this route runs concurrently with the legacy
 * laptop script.
 *
 * ALWAYS logs a run record to agent_activity (action: "auto_onboarding_invite")
 * -- including deferred, empty, and failed runs -- so the admin cron monitor
 * (app/api/admin/cron-monitor/route.ts) can detect stalls.
 *
 * Schedule (vercel.json): "0 14-23/2 * * *" UTC. Vercel crons run in UTC;
 * Chicago is UTC-5 (CDT) in July / UTC-6 (CST) in winter, so this lands inside
 * the 8am-8pm CT business window year-round. The route also re-checks
 * America/Chicago business hours itself and defers (with an activity log)
 * when invoked outside 8am-8pm CT.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 50;
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, same as legacy script
const BUSINESS_HOURS_START = 8; // 8am CT
const BUSINESS_HOURS_END = 20; // 8pm CT (exclusive)

function getChicagoHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false,
  }).format(date);
  return parseInt(hour, 10) % 24; // hour12:false can yield "24" at midnight
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  const now = new Date();
  let invited = 0;
  let skipped = 0;
  let deferred = 0;
  const errors: string[] = [];
  const invitedProspects: { name: string; email: string; priority: string }[] = [];

  try {
    const client = await clientPromise;
    const db = client.db();

    // Business-hours gate (America/Chicago). Log the deferred run so the cron
    // monitor still sees a heartbeat -- silent stalls are what went unnoticed
    // for 2 weeks on the laptop cron.
    const chicagoHour = getChicagoHour(now);
    if (chicagoHour < BUSINESS_HOURS_START || chicagoHour >= BUSINESS_HOURS_END) {
      await db.collection("agent_activity").insertOne({
        agent: {
          name: "Auto Onboarding Processor",
          role: "Onboarding",
          department: "Operations",
        },
        action: "auto_onboarding_invite",
        result: {
          deferred: true,
          reason: `Outside business hours (America/Chicago hour=${chicagoHour})`,
          qualifiedProspects: 0,
          sessionsCreated: 0,
          tasksCreated: 0,
          skipped: 0,
        },
        success: true,
        createdAt: now,
        timestamp: now,
      });
      return NextResponse.json({
        ok: true,
        deferred: true,
        reason: "Outside business hours (8am-8pm America/Chicago)",
        report: { invited: 0, skipped: 0, deferred: 0 },
      });
    }

    // Step 1: Qualified prospects -- same criteria as the legacy script,
    // ordered by priorityScore first (new-authority / insurance-lapse boosts
    // from /api/cron/prospect-priorities) so the hottest channels get
    // invited before the plain census pool. Docs without a priorityScore
    // sort after boosted ones in a descending sort.
    const prospects = await db
      .collection("outbound_prospects")
      .find({ status: "reviewed", aiScore: { $gte: 75 } })
      .sort({ priorityScore: -1, aiScore: -1 })
      .limit(MAX_PER_RUN)
      .toArray();

    for (const prospect of prospects) {
      const email: string | undefined = prospect.contact?.email;
      if (!email || email.trim() === "") {
        skipped++;
        continue;
      }

      // Step 2: Skip if an onboarding session already exists for this email.
      const existingSession = await db.collection("onboarding_sessions").findOne({
        email,
        leadType: "outbound_prospect",
      });
      if (existingSession) {
        skipped++;
        continue;
      }

      // Step 3: ATOMIC CLAIM -- flip status reviewed -> onboarding_invited
      // before creating anything. If another runner (e.g. the legacy laptop
      // cron) already claimed this prospect, we get null back and do nothing.
      const claim = await db.collection("outbound_prospects").findOneAndUpdate(
        { _id: prospect._id, status: "reviewed" },
        { $set: { status: "onboarding_invited", updatedAt: now } }
      );
      if (!claim) {
        deferred++;
        continue;
      }

      try {
        // Step 4a: Onboarding session -- same token/expiry scheme as legacy.
        const rawToken = crypto.randomUUID();
        const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);
        await db.collection("onboarding_sessions").insertOne({
          name: prospect.name,
          email,
          leadType: "outbound_prospect",
          status: "pending",
          rawToken,
          expiresAt,
          metadata: {
            aiScore: prospect.aiScore,
            source: prospect.source || "",
            phone: prospect.contact?.phone || "",
          },
          createdAt: now,
        });

        // Step 4b: Outreach task -- same template/shape as legacy. Picked up
        // by /api/cron/process-outreach.
        const state = prospect.location?.split(",")[1]?.trim() || "";
        const priority = prospect.aiScore >= 85 ? "urgent" : "high";
        await db.collection("outreach_tasks").insertOne({
          leadId: prospect._id,
          leadType: "outbound_prospect",
          leadEmail: email,
          leadName: prospect.name,
          template: "prospect_outreach",
          channel: "email",
          priority,
          scheduledAt: now,
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
          personalization: { name: prospect.name, state },
          createdAt: now,
        });

        invited++;
        invitedProspects.push({ name: prospect.name, email, priority });
      } catch (err) {
        // Claim succeeded but session/task creation failed. Roll the claim
        // back so the prospect is retried on the next run.
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${prospect.name}: ${message}`);
        try {
          await db.collection("outbound_prospects").updateOne(
            { _id: prospect._id, status: "onboarding_invited" },
            { $set: { status: "reviewed", updatedAt: new Date() } }
          );
        } catch {
          // leave claimed; surfaced via errors[] and agent_activity
        }
      }
    }

    // Step 5: ALWAYS log to agent_activity -- the missing logging on the
    // legacy cron is why the June 23 stall went unnoticed for two weeks.
    await db.collection("agent_activity").insertOne({
      agent: {
        name: "Auto Onboarding Processor",
        role: "Onboarding",
        department: "Operations",
      },
      action: "auto_onboarding_invite",
      result: {
        qualifiedProspects: prospects.length,
        sessionsCreated: invited,
        tasksCreated: invited,
        skipped,
        deferred,
        errors: errors.length ? errors : undefined,
        invitedProspects: invitedProspects.length ? invitedProspects : undefined,
        source: "vercel-cron",
      },
      success: errors.length === 0,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({
      ok: errors.length === 0,
      report: {
        qualifiedProspects: prospects.length,
        invited,
        skipped,
        deferred,
        errors,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/onboarding-invites] Fatal error:", error);

    // Best-effort failure log so the stall is visible in the cron monitor.
    try {
      const client = await clientPromise;
      await client
        .db()
        .collection("agent_activity")
        .insertOne({
          agent: {
            name: "Auto Onboarding Processor",
            role: "Onboarding",
            department: "Operations",
          },
          action: "auto_onboarding_invite",
          result: { error: message, invited, skipped, deferred },
          success: false,
          createdAt: new Date(),
          timestamp: new Date(),
        });
    } catch {
      // DB unreachable -- nothing more we can do here.
    }

    return NextResponse.json(
      { ok: false, error: message, report: { invited, skipped, deferred } },
      { status: 500 }
    );
  }
}
