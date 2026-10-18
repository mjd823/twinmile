"use server";

import { QuoteLeadSchema, DriverLeadSchema } from "@/lib/leads";
import clientPromise from "@/lib/mongodb";
import { rateLimit } from "@/lib/security/rate-limit";

import { getClientIpFromHeaders } from "@/app/actions/_request";
import {
  notifyNewDriverLead,
  sendQuoteLeadConfirmation,
  sendDriverLeadConfirmation,
} from "@/lib/email";
import { saveQuoteIntake, drainQuoteIntake } from "@/lib/quote-intake";

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

    const client = await clientPromise;
    const db = client.db();
    const saved = await saveQuoteIntake(db, parsed.data, true);
    // A persisted request must remain successful if an integration is down.
    // Only a newly-created form submission sends the existing customer receipt;
    // the recovery worker never sends customer confirmations or outreach.
    await Promise.all([
      drainQuoteIntake(db, { quoteId: saved.id }).catch(() => console.error("[submitQuoteLeadAction] Saved delivery will be retried")),
      saved.created ? sendQuoteLeadConfirmation(parsed.data).then(async accepted => {
        await db.collection("leads_quotes").updateOne({ _id: saved.id }, { $set: {
          customerConfirmation: { status: accepted ? "accepted" : "not-accepted", checkedAt: new Date() },
        } });
      }).catch(() => console.error("[submitQuoteLeadAction] Customer receipt outcome unavailable")) : Promise.resolve(),
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
