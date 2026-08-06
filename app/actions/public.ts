"use server";

import { QuoteLeadSchema, DriverLeadSchema } from "@/lib/leads";
import clientPromise from "@/lib/mongodb";
import { rateLimit } from "@/lib/security/rate-limit";

import { getClientIpFromHeaders } from "@/app/actions/_request";
import {
  notifyNewQuoteLead,
  notifyNewDriverLead,
  sendQuoteLeadConfirmation,
  sendDriverLeadConfirmation,
} from "@/lib/email";

/**
 * Next business day, same clock time. Weekend submissions must not schedule a
 * "one business day" follow-up onto a Saturday — the email promises a business
 * day and the queue has to mean it.
 */
function nextBusinessDay(from: Date): Date {
  const d = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export async function submitQuoteLeadAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ip = await getClientIpFromHeaders();
    const rl = await rateLimit({ key: `lead:quote:ip:${ip}`, limit: 8, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) return { ok: false, error: "Too many submissions. Please try again later." };

    if (!clientPromise) {
      console.error("[submitQuoteLeadAction] Database connection not available - clientPromise is null");
      return { ok: false, error: "Database is not configured. Please contact support." };
    }

    const parsed = QuoteLeadSchema.safeParse(input);
    if (!parsed.success) {
      console.error("[submitQuoteLeadAction] Schema validation failed:", parsed.error.flatten());
      return { ok: false, error: "Please check the form fields and try again." };
    }

    if (parsed.data.hp && parsed.data.hp.trim().length > 0) {
      console.log("[submitQuoteLeadAction] Honeypot triggered - possible bot submission");
      return { ok: true };
    }

    console.log("[submitQuoteLeadAction] Connecting to database...");
    const client = await clientPromise;
    const db = client.db();
    console.log("[submitQuoteLeadAction] Database connected, inserting lead...");

    // nextFollowUpAt is set, not null. The only shipper lead in company history
    // was inserted with nextFollowUpAt:null and then sat untouched for 91 days —
    // a follow-up date that is always null is a queue that is always empty.
    const now = new Date();
    const followUpAt = nextBusinessDay(now);

    const insertResult = await db.collection("leads_quotes").insertOne({
      ...parsed.data,
      hp: undefined,
      status: "new",
      notes: [],
      nextFollowUpAt: followUpAt,
      ownerUserId: null,
      convertedAt: null,
      conversion: null,
      createdAt: now,
      source: "web",
    });
    console.log("[submitQuoteLeadAction] Lead inserted successfully:", insertResult.insertedId);

    // Queue the follow-up the confirmation email promises. leadType "quote"
    // resolves to leads_quotes via lib/outreach-lead-resolver.ts and is picked up
    // by /api/cron/process-outreach — which IS gated on OUTREACH_AUTOMATION, and
    // that is correct for a sequence. The instant confirmation below is not
    // gated, because a receipt for something the shipper just did himself is
    // transactional, not outreach.
    //
    // Template is quote_followup, not quote_initial: quote_initial says the same
    // thing as the confirmation that goes out seconds from now, so queueing it
    // would mail the shipper the same paragraph twice.
    await db.collection("outreach_tasks").insertOne({
      leadId: insertResult.insertedId,
      leadType: "quote",
      leadCollection: "leads_quotes",
      leadEmail: parsed.data.email,
      leadName: parsed.data.name,
      template: "quote_followup",
      channel: "email",
      priority: "high",
      scheduledAt: followUpAt,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      personalization: { name: parsed.data.name },
      createdAt: now,
    });

    // AWAITED. These are server actions on Vercel, where the lambda is frozen the
    // moment the response returns — a fire-and-forget send here is killed
    // mid-flight, which is the exact bug fixed in /api/onboarding/complete.
    // sendEmail() never throws and returns a boolean, so awaiting cannot fail the
    // submission, and the lead is already inserted above regardless.
    await Promise.all([
      notifyNewQuoteLead(parsed.data).catch((err) => console.error("[submitQuoteLeadAction] Email notification failed:", err)),
      sendQuoteLeadConfirmation(parsed.data).catch((err) => console.error("[submitQuoteLeadAction] Confirmation email failed:", err)),
    ]);

    return { ok: true };
  } catch (error) {
    console.error("[submitQuoteLeadAction] Unexpected error:", error);
    return { ok: false, error: "Something went wrong. Please try again or contact support." };
  }
}

export async function submitDriverApplicationAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ip = await getClientIpFromHeaders();
    const rl = await rateLimit({ key: `lead:driver:ip:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) return { ok: false, error: "Too many submissions. Please try again later." };

    if (!clientPromise) {
      console.error("[submitDriverApplicationAction] Database connection not available - clientPromise is null");
      return { ok: false, error: "Database is not configured. Please contact support." };
    }

    const parsed = DriverLeadSchema.safeParse(input);
    if (!parsed.success) {
      console.error("[submitDriverApplicationAction] Schema validation failed:", parsed.error.flatten());
      return { ok: false, error: "Please check the form fields and try again." };
    }

    if (parsed.data.hp && parsed.data.hp.trim().length > 0) {
      console.log("[submitDriverApplicationAction] Honeypot triggered - possible bot submission");
      return { ok: true };
    }

    console.log("[submitDriverApplicationAction] Connecting to database...");
    const client = await clientPromise;
    const db = client.db();
    console.log("[submitDriverApplicationAction] Database connected, inserting driver application...");

    // Score the lead based on experience and truck type
    const experience = parseInt(parsed.data.yearsExperience || '0', 10);
    let aiScore = 50; // Base score
    if (experience >= 5) aiScore += 25;
    else if (experience >= 3) aiScore += 18;
    else if (experience >= 2) aiScore += 12;
    if (parsed.data.truckType) {
      const truck = parsed.data.truckType.toLowerCase();
      if (truck.includes('power') || truck.includes('semi') || truck.includes('tractor')) aiScore += 15;
      else if (truck.includes('hotshot') || truck.includes('flatbed')) aiScore += 12;
    }
    if (parsed.data.preferredRoutes && parsed.data.preferredRoutes.length > 0) aiScore += 10;
    if (parsed.data.startDate && parsed.data.startDate.length > 0) aiScore += 5; // Ready to start soon
    aiScore = Math.min(100, aiScore);

    const qualifiedStatus = aiScore >= 75 ? 'qualified' : 'new';

    const insertResult = await db.collection("leads_drivers").insertOne({
      ...parsed.data,
      hp: undefined,
      status: qualifiedStatus,
      aiScore,
      notes: [],
      nextFollowUpAt: null,
      ownerUserId: null,
      convertedAt: null,
      conversion: null,
      createdAt: new Date(),
      source: "web",
    });
    console.log("[submitDriverApplicationAction] Driver application inserted successfully:", insertResult.insertedId);

    // AWAITED for the same reason as the quote handler above: on Vercel the
    // lambda freezes when the response returns, so an un-awaited send is killed
    // mid-flight. The application is already inserted, and sendEmail() swallows
    // its own failures, so this can only cost latency.
    await Promise.all([
      notifyNewDriverLead(parsed.data).catch((err) => console.error("[submitDriverApplicationAction] Email notification failed:", err)),
      sendDriverLeadConfirmation(parsed.data).catch((err) => console.error("[submitDriverApplicationAction] Confirmation email failed:", err)),
    ]);

    return { ok: true };
  } catch (error) {
    console.error("[submitDriverApplicationAction] Unexpected error:", error);
    return { ok: false, error: "Something went wrong. Please try again or contact support." };
  }
}
