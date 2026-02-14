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
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimit({ key: `lead:quote:ip:${ip}`, limit: 8, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return { ok: false, error: "Too many submissions. Please try again later." };

  if (!clientPromise) return { ok: false, error: "Database is not configured." };

  const parsed = QuoteLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form fields and try again." };
  }

  if (parsed.data.hp && parsed.data.hp.trim().length > 0) {
    return { ok: true };
  }

  const client = await clientPromise;
  const db = client.db();

  await db.collection("leads_quotes").insertOne({
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

  notifyNewQuoteLead(parsed.data).catch(() => {});
  sendQuoteLeadConfirmation(parsed.data).catch(() => {});

  return { ok: true };
}

export async function submitDriverApplicationAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimit({ key: `lead:driver:ip:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return { ok: false, error: "Too many submissions. Please try again later." };

  if (!clientPromise) return { ok: false, error: "Database is not configured." };

  const parsed = DriverLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form fields and try again." };
  }

  if (parsed.data.hp && parsed.data.hp.trim().length > 0) {
    return { ok: true };
  }

  const client = await clientPromise;
  const db = client.db();

  await db.collection("leads_drivers").insertOne({
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

  notifyNewDriverLead(parsed.data).catch(() => {});
  sendDriverLeadConfirmation(parsed.data).catch(() => {});

  return { ok: true };
}
