#!/usr/bin/env node
/**
 * 2026-07 pipeline normalization migration (idempotent).
 *
 * Usage:
 *   node scripts/migrations/2026-07-normalize-pipeline.mjs            # DRY RUN (default)
 *   node scripts/migrations/2026-07-normalize-pipeline.mjs --apply    # execute
 *
 * Steps:
 *  1. createdAt/updatedAt/sentAt/scheduledAt/onboardingInvitedAt stored as ISO
 *     STRINGS -> BSON Dates. (BSON sorts Date > String, so .sort({createdAt:-1})
 *     hid the newest docs entirely — "newest first" was broken everywhere.)
 *  2. Status canonicalization: outbound_prospects "reviewed" -> "qualified"
 *     (the drain-through status nothing sets anymore).
 *  3. Invite backlinks: backfill onboardingInvitedAt + onboardingSessionId on
 *     invited prospects (join outreach_tasks / onboarding_sessions on email);
 *     create sessions for invited prospects that have none.
 *  4. Repair failed outreach_tasks whose leadId is a string where the prospect
 *     _id is an ObjectId (the 100 "Lead not found" failures). Tasks stay
 *     "failed" — outreach is paused; this is for joins/history only.
 *  5. Indexes for the newest-first + status queries.
 *  6. Verification: totals unchanged, newest-first sort returns a truly-newest
 *     doc, zero string createdAt remain; before/after stage distributions.
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { MongoClient, ObjectId } = require("mongodb");

const APPLY = process.argv.includes("--apply");
const MODE = APPLY ? "APPLY" : "DRY RUN";

function loadUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envPath = path.join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/MONGODB_URI="?([^"\r\n]+)"?/);
    if (m) return m[1];
  }
  throw new Error("MONGODB_URI not found (env or .env.local)");
}

const DATE_FIELDS = {
  outbound_prospects: ["createdAt", "updatedAt", "onboardingInvitedAt", "enrichedAt", "priorityUpdatedAt"],
  outreach_tasks: ["createdAt", "updatedAt", "sentAt", "scheduledAt"],
  onboarding_sessions: ["createdAt", "updatedAt", "expiresAt", "completedAt", "firstClickedAt"],
  leads_drivers: ["createdAt", "updatedAt"],
  leads_quotes: ["createdAt", "updatedAt"],
  agent_activity: ["createdAt", "timestamp"],
};

async function stageSnapshot(db) {
  const by = async (col, match = {}) => {
    const rows = await db.collection(col).aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ["$status", ""] }, count: { $sum: 1 } } },
    ]).toArray();
    return Object.fromEntries(rows.map((r) => [String(r._id || "(missing)"), r.count]));
  };
  const pBy = await by("outbound_prospects");
  const dBy = await by("leads_drivers", { isArchived: { $ne: true } });
  const engaged = await db.collection("onboarding_sessions").countDocuments({
    $or: [
      { firstClickedAt: { $exists: true } },
      { currentStep: { $gt: 1 } },
      { status: { $in: ["started", "documents_submitted", "completed"] } },
    ],
  });
  const qualifiedReached = await db.collection("outbound_prospects").countDocuments({
    $or: [
      { aiScore: { $gte: 75 } },
      { status: { $in: ["qualified", "reviewed", "onboarding_invited", "onboarding", "ready_to_dispatch", "converted"] } },
    ],
  });
  const sum = (m, keys) => keys.reduce((a, k) => a + (m[k] || 0), 0);
  const dQualPlus = sum(dBy, ["qualified", "contacted", "onboarding", "ready_to_dispatch", "converted"]);
  const pTotal = Object.values(pBy).reduce((a, b) => a + b, 0);
  const dTotal = Object.values(dBy).reduce((a, b) => a + b, 0);
  const invitedReached = sum(pBy, ["onboarding_invited", "onboarding", "ready_to_dispatch", "converted"]) + sum(dBy, ["onboarding", "ready_to_dispatch", "converted"]);
  const docs = await db.collection("onboarding_sessions").countDocuments({ status: { $in: ["documents_submitted", "completed"] } });
  const completed = await db.collection("onboarding_sessions").countDocuments({ status: "completed" });
  const hired = (pBy["converted"] || 0) + (dBy["converted"] || 0);
  return {
    prospectsByStatus: pBy,
    driverLeadsByStatus: dBy,
    funnelReached: {
      sourced: pTotal + dTotal,
      qualified: qualifiedReached + dQualPlus,
      invited: invitedReached,
      engaged,
      docs,
      completed,
      hired,
    },
  };
}

async function main() {
  const uri = loadUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const report = { mode: MODE, startedAt: new Date().toISOString(), steps: {} };

  console.log(`\n=== 2026-07 pipeline normalization — ${MODE} ===\n`);

  const totalsBefore = {};
  for (const col of Object.keys(DATE_FIELDS)) {
    totalsBefore[col] = await db.collection(col).countDocuments();
  }
  const before = await stageSnapshot(db);
  console.log("BEFORE stage snapshot:");
  console.log(JSON.stringify(before, null, 2));

  // ── Step 1: string dates -> BSON Dates ────────────────────────────────────
  report.steps.dateNormalization = {};
  for (const [col, fields] of Object.entries(DATE_FIELDS)) {
    for (const field of fields) {
      const count = await db.collection(col).countDocuments({ [field]: { $type: "string" } });
      if (count === 0) continue;
      report.steps.dateNormalization[`${col}.${field}`] = count;
      console.log(`Step 1: ${col}.${field} — ${count} string value(s) -> Date${APPLY ? "" : " (dry run)"}`);
      if (APPLY) {
        await db.collection(col).updateMany(
          { [field]: { $type: "string" } },
          [{ $set: { [field]: { $toDate: `$${field}` } } }]
        );
      }
    }
  }

  // ── Step 2: status canonicalization — reviewed -> qualified ──────────────
  const reviewedCount = await db.collection("outbound_prospects").countDocuments({ status: "reviewed" });
  report.steps.reviewedToQualified = reviewedCount;
  console.log(`Step 2: outbound_prospects status reviewed -> qualified: ${reviewedCount} doc(s)`);
  if (APPLY && reviewedCount > 0) {
    await db.collection("outbound_prospects").updateMany(
      { status: "reviewed" },
      { $set: { status: "qualified" }, $currentDate: { updatedAt: true } }
    );
  }

  // ── Step 3: invite backlinks + timestamps ─────────────────────────────────
  const invited = await db
    .collection("outbound_prospects")
    .find({ status: "onboarding_invited" })
    .project({ _id: 1, name: 1, contact: 1, updatedAt: 1, onboardingInvitedAt: 1, onboardingSessionId: 1, aiScore: 1, source: 1 })
    .toArray();

  // Join maps by lowercased email.
  const emails = invited.map((p) => String(p.contact?.email || "").toLowerCase()).filter(Boolean);
  const [tasks, sessions] = await Promise.all([
    db.collection("outreach_tasks")
      .find({ template: { $in: ["prospect_outreach", "onboarding_followup"] }, status: "sent" })
      .project({ leadEmail: 1, sentTo: 1, sentAt: 1 })
      .toArray(),
    db.collection("onboarding_sessions")
      .find({ leadType: "outbound_prospect" })
      .project({ email: 1, createdAt: 1 })
      .toArray(),
  ]);
  const taskByEmail = new Map();
  for (const t of tasks) {
    const key = String(t.sentTo || t.leadEmail || "").toLowerCase();
    if (!key) continue;
    const at = t.sentAt ? new Date(t.sentAt) : null;
    const prev = taskByEmail.get(key);
    if (at && (!prev || at < prev)) taskByEmail.set(key, at); // earliest send = invite moment
  }
  const sessionByEmail = new Map();
  for (const s of sessions) {
    const key = String(s.email || "").toLowerCase();
    if (key && !sessionByEmail.has(key)) sessionByEmail.set(key, s);
  }

  let backfilledInvitedAt = 0;
  let backfilledSessionId = 0;
  let sessionsCreated = 0;
  const noSession = [];
  const noEmail = [];

  for (const p of invited) {
    const email = String(p.contact?.email || "").toLowerCase();
    const updates = {};

    if (!p.onboardingInvitedAt) {
      const at =
        (email && taskByEmail.get(email)) ||
        (email && sessionByEmail.get(email)?.createdAt && new Date(sessionByEmail.get(email).createdAt)) ||
        (p.updatedAt ? new Date(p.updatedAt) : null);
      if (at && !Number.isNaN(at.getTime())) {
        updates.onboardingInvitedAt = at;
        backfilledInvitedAt++;
      }
    }

    const session = email ? sessionByEmail.get(email) : null;
    if (!p.onboardingSessionId && session) {
      updates.onboardingSessionId = session._id;
      backfilledSessionId++;
    }

    if (!session) {
      if (!email) {
        noEmail.push(p.name || String(p._id));
      } else {
        noSession.push({ name: p.name || String(p._id), email });
        // Create the missing session (same shape as onboarding-invites cron).
        if (APPLY) {
          const now = new Date();
          const rawToken = randomUUID();
          const ins = await db.collection("onboarding_sessions").insertOne({
            name: p.name,
            email: p.contact?.email,
            leadType: "outbound_prospect",
            status: "pending",
            rawToken,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            metadata: { aiScore: p.aiScore, source: p.source || "", phone: p.contact?.phone || "", backfilled: true },
            createdAt: now,
          });
          updates.onboardingSessionId = ins.insertedId;
          sessionsCreated++;
        }
      }
    }

    if (APPLY && Object.keys(updates).length > 0) {
      await db.collection("outbound_prospects").updateOne({ _id: p._id }, { $set: updates });
    }
  }
  report.steps.inviteBacklinks = {
    invitedTotal: invited.length,
    backfilledInvitedAt,
    backfilledSessionId,
    invitedWithoutSession: noSession.length,
    sessionsCreated,
    invitedWithoutEmail: noEmail,
  };
  console.log(`Step 3: invited=${invited.length}; onboardingInvitedAt backfilled=${backfilledInvitedAt}; onboardingSessionId backfilled=${backfilledSessionId}; missing sessions=${noSession.length} (created ${sessionsCreated}); no-email=${noEmail.length}`);
  if (noSession.length) console.log("  invited without session:", JSON.stringify(noSession));
  if (noEmail.length) console.log("  invited WITHOUT EMAIL (cannot create session):", JSON.stringify(noEmail));

  // ── Step 4: repair string leadId on failed "Lead not found" tasks ────────
  const failedTasks = await db
    .collection("outreach_tasks")
    .find({ status: "failed", error: /Lead not found/, leadId: { $type: "string" } })
    .project({ _id: 1, leadId: 1, leadEmail: 1 })
    .toArray();
  let repaired = 0;
  const orphaned = [];
  for (const t of failedTasks) {
    let fixed = false;
    if (ObjectId.isValid(t.leadId)) {
      const oid = new ObjectId(t.leadId);
      const prospect = await db.collection("outbound_prospects").findOne({ _id: oid }, { projection: { _id: 1 } });
      if (prospect) {
        if (APPLY) {
          // Status stays "failed" — outreach is paused; do NOT requeue.
          await db.collection("outreach_tasks").updateOne({ _id: t._id }, { $set: { leadId: oid } });
        }
        repaired++;
        fixed = true;
      }
    }
    if (!fixed) orphaned.push({ taskId: String(t._id), leadId: t.leadId, leadEmail: t.leadEmail || "" });
  }
  // Audit the remaining failed "Lead not found" tasks (non-string leadIds):
  // how many point at a prospect that genuinely no longer exists?
  const failedAll = await db
    .collection("outreach_tasks")
    .find({ status: "failed", error: /Lead not found/ })
    .project({ _id: 1, leadId: 1, leadEmail: 1 })
    .toArray();
  let joinable = 0;
  let trulyOrphaned = 0;
  for (const t of failedAll) {
    let id = t.leadId;
    if (typeof id === "string" && ObjectId.isValid(id)) id = new ObjectId(id);
    const found =
      (id instanceof ObjectId && (await db.collection("outbound_prospects").countDocuments({ _id: id }))) ||
      (t.leadEmail && (await db.collection("outbound_prospects").countDocuments({ "contact.email": t.leadEmail })));
    if (found) joinable++;
    else trulyOrphaned++;
  }
  report.steps.leadIdRepair = {
    failedLeadNotFoundTotal: failedAll.length,
    stringLeadIdCandidates: failedTasks.length,
    repaired,
    orphanedStringIds: orphaned,
    joinableAfterRepair: joinable,
    trulyOrphaned,
  };
  console.log(`Step 4: failed 'Lead not found' tasks total=${failedAll.length}; string leadId=${failedTasks.length}; repaired=${repaired}; joinable after repair=${joinable}; truly orphaned (no prospect by id or email)=${trulyOrphaned}`);
  if (orphaned.length) console.log("  orphaned string ids:", JSON.stringify(orphaned.slice(0, 20)));

  // ── Step 5: indexes ───────────────────────────────────────────────────────
  const INDEXES = [
    ["outbound_prospects", { status: 1 }],
    ["outbound_prospects", { aiScore: -1 }],
    ["outbound_prospects", { createdAt: -1 }],
    ["outbound_prospects", { priorityScore: -1, createdAt: -1 }],
    ["outreach_tasks", { status: 1, sentAt: -1 }],
    ["outreach_tasks", { createdAt: -1 }],
    ["onboarding_sessions", { email: 1 }],
    ["onboarding_sessions", { createdAt: -1 }],
    ["agent_activity", { createdAt: -1 }],
  ];
  if (APPLY) {
    for (const [col, spec] of INDEXES) {
      await db.collection(col).createIndex(spec);
    }
  }
  console.log(`Step 5: ${INDEXES.length} indexes ${APPLY ? "ensured" : "would be ensured (dry run)"}`);

  // ── Step 6: verification ──────────────────────────────────────────────────
  const totalsAfter = {};
  for (const col of Object.keys(DATE_FIELDS)) {
    totalsAfter[col] = await db.collection(col).countDocuments();
  }
  const totalsOk = Object.keys(totalsBefore).every((col) =>
    col === "onboarding_sessions"
      ? totalsAfter[col] === totalsBefore[col] + sessionsCreated
      : totalsAfter[col] === totalsBefore[col]
  );
  const stringCreatedLeft = await db.collection("outbound_prospects").countDocuments({ createdAt: { $type: "string" } });
  const newest = await db
    .collection("outbound_prospects")
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .project({ createdAt: 1 })
    .toArray();
  const after = await stageSnapshot(db);

  console.log("\nAFTER stage snapshot:");
  console.log(JSON.stringify(after, null, 2));
  console.log("\nVerification:");
  console.log(`  totals unchanged (sessions +${sessionsCreated} allowed): ${totalsOk} ${JSON.stringify({ before: totalsBefore, after: totalsAfter })}`);
  console.log(`  string createdAt remaining on outbound_prospects: ${stringCreatedLeft}`);
  console.log(`  newest prospect by plain sort({createdAt:-1}): ${newest[0]?.createdAt}`);

  if (APPLY) {
    if (!totalsOk) throw new Error("VERIFICATION FAILED: document totals changed unexpectedly");
    if (stringCreatedLeft > 0) throw new Error("VERIFICATION FAILED: string createdAt values remain");
  }

  report.before = before;
  report.after = after;
  report.finishedAt = new Date().toISOString();
  console.log(`\n=== ${MODE} complete ===`);
  await client.close();
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err);
  process.exit(1);
});
