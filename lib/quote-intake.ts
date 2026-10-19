import { createHash, randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { buildQuoteOwnerEmail, sendQuoteOwnerEmail } from "@/lib/email";
import type { QuoteLeadInput } from "@/lib/leads";

type Kind = "owner" | "gvai" | "followup";
type Job = { status: "pending" | "processing" | "accepted" | "attention"; payload: unknown; attempts: number; nextAttemptAt: Date; owner?: string; leaseUntil?: Date; firstAttemptAt?: Date; providerId?: string; reason?: string };
type QuoteRecord = { _id: ObjectId; fingerprint: string; createdAt: Date; nextFollowUpAt: Date; quoteDelivery: Record<Kind, Job>; followupEnabled: boolean; name: string; email: string };
type SendResult = { ok: boolean; providerId?: string; reason?: string; permanent?: boolean };
export interface QuoteDeliveryProviders {
  configured(kind: "owner" | "gvai"): boolean;
  send(kind: "owner" | "gvai", payload: unknown, key: string): Promise<SendResult>;
}

export const quoteDeliveryProviders: QuoteDeliveryProviders = {
  configured: kind => kind === "owner" ? !!process.env.RESEND_API_KEY : /^[a-f0-9]{64}$/.test(process.env.GVAI_INTAKE_KEY || ""),
  async send(kind, payload, key) {
    if (kind === "owner") return sendQuoteOwnerEmail(payload as ReturnType<typeof buildQuoteOwnerEmail>, key);
    const response = await fetch("https://gvaipowered.com/api/client-intake/twinmile", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GVAI_INTAKE_KEY}` },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    return response.ok && body?.captured === true && typeof body.leadId === "string"
      ? { ok: true, providerId: body.leadId }
      : { ok: false, permanent: response.status === 400 || response.status === 409, reason: `gvai-http-${response.status}` };
  },
};

function nextBusinessDay(from: Date) {
  const date = new Date(from.getTime() + 86_400_000);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** Both public entry points persist identical immutable delivery intents first. */
export async function saveQuoteIntake(db: Db, input: QuoteLeadInput, followupEnabled: boolean, now = new Date()) {
  const { submissionId, hp: ignored, notes, ...fields } = input;
  void ignored;
  const id = new ObjectId(createHash("sha256").update(submissionId || randomUUID()).digest("hex").slice(0, 24));
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...fields, notes: notes || "" })).digest("hex");
  const pending = (payload: unknown): Job => ({ status: "pending", payload, attempts: 0, nextAttemptAt: now });
  const summary = [`Freight quote: ${input.serviceType}`, `Pickup: ${input.pickupLocation}`, `Drop-off: ${input.dropoffLocation}`, `Preferred date: ${input.pickupDate || "Not specified"}`, notes || ""].filter(Boolean).join("\n");
  const nextFollowUpAt = nextBusinessDay(now);
  const inserted = await db.collection("leads_quotes").updateOne({ _id: id }, { $setOnInsert: {
    ...fields, _id: id, fingerprint, customerNotes: notes || "", status: "new", notes: [],
    nextFollowUpAt, ownerUserId: null, convertedAt: null, conversion: null, createdAt: now, source: "web", followupEnabled,
    quoteDelivery: {
      owner: pending(buildQuoteOwnerEmail(input)),
      gvai: pending({ eventId: `quote:${id}`, name: input.name, company: input.company || "", email: input.email, phone: input.phone, summary }),
      followup: followupEnabled ? pending({}) : { ...pending({}), status: "accepted" },
    },
  } }, { upsert: true });
  const saved = await db.collection<QuoteRecord>("leads_quotes").findOne({ _id: id });
  if (!saved || saved.fingerprint !== fingerprint) throw new Error("Submission details changed; submit a new request");
  return { id, created: !!inserted.upsertedCount };
}

/** No old quotes without intents are replayed. Owner receipts mean accepted, not delivered. */
export async function drainQuoteIntake(db: Db, options: { quoteId?: ObjectId; limit?: number; providers?: QuoteDeliveryProviders; now?: () => Date } = {}) {
  const service = options.providers || quoteDeliveryProviders;
  const now = options.now || (() => new Date());
  const quotes = db.collection<QuoteRecord>("leads_quotes");
  const deadline = Date.now() + 35_000;
  const counts = { claimed: 0, accepted: 0, pending: 0, attention: 0 };
  // One turn per destination per round prevents a busy owner queue starving GVAI.
  const kinds = ["followup", "owner", "gvai"] as const;
  const exhausted = new Set<Kind>();
  while (counts.claimed < Math.min(options.limit || 4, 4) && exhausted.size < kinds.length && Date.now() < deadline) {
    for (const kind of kinds) {
      if (exhausted.has(kind) || counts.claimed >= Math.min(options.limit || 4, 4) || Date.now() >= deadline) continue;
      const field = `quoteDelivery.${kind}`;
      const time = now();
      const owner = randomUUID();
      const doc = await quotes.findOneAndUpdate({ ...(options.quoteId ? { _id: options.quoteId } : {}), $or: [
        { [`${field}.status`]: "pending", [`${field}.nextAttemptAt`]: { $lte: time } },
        { [`${field}.status`]: "processing", [`${field}.leaseUntil`]: { $lte: time } },
      ] }, { $set: { [`${field}.status`]: "processing", [`${field}.owner`]: owner, [`${field}.leaseUntil`]: new Date(time.getTime() + 90_000) }, $inc: { [`${field}.attempts`]: 1 } }, { sort: { createdAt: 1 }, returnDocument: "after", maxTimeMS: 2000 });
      if (!doc) { exhausted.add(kind); continue; }
      counts.claimed++;
      const job = doc.quoteDelivery[kind];
      const owned = () => ({ _id: doc._id, [`${field}.owner`]: owner, [`${field}.status`]: "processing", [`${field}.leaseUntil`]: { $gt: now() } });
      let result: SendResult;
      try {
        if (kind === "followup") {
          const taskId = new ObjectId(createHash("sha256").update(`quote-followup:${doc._id}`).digest("hex").slice(0, 24));
          await db.collection("outreach_tasks").updateOne({ _id: taskId }, { $setOnInsert: {
            leadId: doc._id, leadType: "quote", leadCollection: "leads_quotes", leadEmail: doc.email, leadName: doc.name,
            template: "quote_followup", channel: "email", priority: "high", scheduledAt: doc.nextFollowUpAt,
            status: "pending", attempts: 0, maxAttempts: 3, personalization: { name: doc.name }, createdAt: doc.createdAt,
          } }, { upsert: true });
          result = { ok: true };
        } else if (!service.configured(kind)) result = { ok: false, reason: `${kind}-not-configured` };
        else if (kind === "owner" && job.firstAttemptAt && time.getTime() - job.firstAttemptAt.getTime() >= 23 * 60 * 60_000) {
          result = { ok: false, permanent: true, reason: "Provider deduplication window expired; review before another send" };
        } else {
          if (!job.firstAttemptAt) {
            const stamped = await quotes.updateOne(owned(), { $set: { [`${field}.firstAttemptAt`]: time } });
            if (!stamped.matchedCount) continue;
          }
          if (!await quotes.findOne(owned(), { maxTimeMS: 2000 })) continue;
          result = await service.send(kind, job.payload, `quote:${doc._id}:${kind}:v1`);
        }
      } catch { result = { ok: false, reason: "Acceptance unknown; same immutable request will be retried" }; }
      const status = result.ok ? "accepted" : result.permanent ? "attention" : "pending";
      const updated = await quotes.updateOne(owned(), { $set: {
        [`${field}.status`]: status, [`${field}.reason`]: result.reason || "",
        [`${field}.nextAttemptAt`]: new Date(now().getTime() + Math.min(6 * 60 * 60_000, 60_000 * 2 ** Math.min(job.attempts, 8))),
        ...(result.providerId ? { [`${field}.providerId`]: result.providerId } : {}),
      }, $unset: { [`${field}.leaseUntil`]: "" } });
      if (updated.matchedCount) counts[status]++;
    }
  }
  return counts;
}

export async function quoteIntakeHealth(db: Db) {
  const quotes = db.collection("leads_quotes");
  const pending = await quotes.countDocuments({ $or: ["owner", "gvai", "followup"].map(kind => ({ [`quoteDelivery.${kind}.status`]: { $in: ["pending", "processing"] } })) });
  const attention = await quotes.countDocuments({ $or: ["owner", "gvai", "followup"].map(kind => ({ [`quoteDelivery.${kind}.status`]: "attention" })) });
  return { pending, attention };
}
