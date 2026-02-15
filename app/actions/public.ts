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

    const insertResult = await db.collection("leads_quotes").insertOne({
      ...parsed.data,
      hp: undefined,
      status: "new",
      notes: [],
      nextFollowUpAt: null,
      ownerUserId: null,
      convertedAt: null,
      conversion: null,
      createdAt: new Date(),
      source: "web",
    });
    console.log("[submitQuoteLeadAction] Lead inserted successfully:", insertResult.insertedId);

    notifyNewQuoteLead(parsed.data).catch((err) => console.error("[submitQuoteLeadAction] Email notification failed:", err));
    sendQuoteLeadConfirmation(parsed.data).catch((err) => console.error("[submitQuoteLeadAction] Confirmation email failed:", err));

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

    const insertResult = await db.collection("leads_drivers").insertOne({
      ...parsed.data,
      hp: undefined,
      status: "new",
      notes: [],
      nextFollowUpAt: null,
      ownerUserId: null,
      convertedAt: null,
      conversion: null,
      createdAt: new Date(),
      source: "web",
    });
    console.log("[submitDriverApplicationAction] Driver application inserted successfully:", insertResult.insertedId);

    notifyNewDriverLead(parsed.data).catch((err) => console.error("[submitDriverApplicationAction] Email notification failed:", err));
    sendDriverLeadConfirmation(parsed.data).catch((err) => console.error("[submitDriverApplicationAction] Confirmation email failed:", err));

    return { ok: true };
  } catch (error) {
    console.error("[submitDriverApplicationAction] Unexpected error:", error);
    return { ok: false, error: "Something went wrong. Please try again or contact support." };
  }
}
