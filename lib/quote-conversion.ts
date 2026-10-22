import { z } from "zod";
import { createHash } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";

export const ConvertQuoteLeadSchema = z.object({
  createLoad: z.boolean().default(true),
  contractName: z.string().min(1).max(140).optional(),
  rateType: z.enum(["flat", "per_mile", "hourly"]),
  rateUsd: z.number().finite().positive().max(100000000),
  agreedRateReviewed: z.literal(true),
});

export class QuoteConversionConflict extends Error {}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const durable = { readPreference: "primary", readConcern: { level: "majority" }, writeConcern: { w: "majority" } } as const;
const sourceKeys = ["company", "name", "email", "phone", "pickupLocation", "dropoffLocation", "status"] as const;
const snapshot = (lead: Document) => sourceKeys.map(key => lead[key] ?? null);
const sourceGuard = (lead: Document) => Object.fromEntries(sourceKeys.map(key => [key,
  lead[key] === undefined ? { $exists: false } : lead[key]]));
type Intent = { version: 1; fingerprint: string; source: unknown[]; terms: z.infer<typeof ConvertQuoteLeadSchema>;
  actor: string; createdAt: Date; customerId: string; contractId: string; loadId: string | null;
  customer: Document; contract: Document; load: Document | null };

/** No external effects. A permanent quote-local claim plus insert-only stable IDs
 * reconcile partial/unknown writes without replacing records an owner has edited. */
export async function convertQuoteOnce(db: Db, leadId: string, input: unknown, actor: string) {
  const terms = ConvertQuoteLeadSchema.parse(input);
  if (!/^[0-9a-fA-F]{24}$/.test(leadId) || !actor) throw new QuoteConversionConflict("Invalid conversion authority.");
  const id = new ObjectId(leadId), quotes = db.collection("leads_quotes", durable);
  let lead = await quotes.findOne({ _id: id });
  if (!lead) throw new QuoteConversionConflict("Lead not found.");
  const termsHash = hash(terms);
  if (!lead.conversionIntent) {
    if (lead.convertedAt) throw new QuoteConversionConflict("Lead already converted.");
    const now = new Date();
    const stableId = (kind: string) => hash(["quote-conversion:v1", id.toHexString(), kind]).slice(0, 24);
    const customerId = stableId("customer"), contractId = stableId("contract");
    const loadId = terms.createLoad ? stableId("load") : null;
    const pickup = String(lead.pickupLocation ?? "").trim(), dropoff = String(lead.dropoffLocation ?? "").trim();
    const common = { quoteConversionLeadId: id.toHexString(), quoteConversionFingerprint: termsHash,
      createdAt: now, updatedAt: now };
    const intent: Intent = { version: 1, fingerprint: termsHash, source: snapshot(lead), terms, actor, createdAt: now,
      customerId, contractId, loadId,
      customer: { ...common, name: String(lead.company ?? "").trim() || String(lead.name ?? "").trim() || "Web Lead",
        contactEmail: lead.email || undefined, contactPhone: lead.phone || undefined, notes: "Created from quote lead." },
      contract: { ...common, customerId, name: terms.contractName ?? (pickup && dropoff ? `Quote: ${pickup} → ${dropoff}` : `Quote Lead ${id}`),
        rateType: terms.rateType, rateUsd: terms.rateUsd, notes: "Created from quote lead." },
      load: loadId ? { ...common, status: "planned", pickup, dropoff, etaHours: 0, revenueUsd: terms.rateUsd,
        truckId: null, customerId, contractId } : null };
    await quotes.updateOne({ _id: id, conversionIntent: { $exists: false }, convertedAt: null, ...sourceGuard(lead) },
      { $set: { conversionIntent: intent } });
    lead = await quotes.findOne({ _id: id });
  }
  const intent = lead?.conversionIntent as Intent | undefined;
  if (!lead || !intent || intent.version !== 1 || intent.fingerprint !== termsHash || hash(intent.terms) !== termsHash)
    throw new QuoteConversionConflict("Conversion terms changed; review the existing conversion.");
  const result = { customerId: intent.customerId, contractId: intent.contractId, loadId: intent.loadId };
  const completed = (row: Document) => row.convertedAt && hash(row.conversion) === hash(result);
  if (completed(lead)) return result;
  if (lead.convertedAt || hash(snapshot(lead)) !== hash(intent.source))
    throw new QuoteConversionConflict("Quote changed during conversion; review before continuing.");
  for (const [name, recordId, doc] of [["customers", intent.customerId, intent.customer],
    ["contracts", intent.contractId, intent.contract], ["loads", intent.loadId, intent.load]] as const) {
    if (!recordId || !doc) continue;
    const fresh = await quotes.findOne({ _id: id });
    if (!fresh || (fresh.convertedAt && !completed(fresh)) || (!fresh.convertedAt && hash(snapshot(fresh)) !== hash(intent.source)))
      throw new QuoteConversionConflict("Quote changed during conversion; review before continuing.");
    const col = db.collection(name, durable), recordKey = new ObjectId(recordId);
    try { await col.updateOne({ _id: recordKey }, { $setOnInsert: doc }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
    const saved = await col.findOne({ _id: recordKey });
    if (!saved || saved.quoteConversionLeadId !== id.toHexString() || saved.quoteConversionFingerprint !== termsHash)
      throw new QuoteConversionConflict("Conversion record requires review.");
  }
  await quotes.updateOne({ _id: id, "conversionIntent.fingerprint": termsHash, convertedAt: null, ...sourceGuard(lead) }, {
    $set: { status: "converted", convertedAt: new Date(), conversion: result, ownerUserId: intent.actor },
    $push: { notes: { at: new Date(), actorUserId: intent.actor, message: "Converted to customer/contract" + (intent.loadId ? " + load" : "") } },
  } as Document);
  const saved = await quotes.findOne({ _id: id });
  if (!saved || !completed(saved)) throw new QuoteConversionConflict("Conversion completion uncertain; retry the same reviewed terms.");
  return result;
}
