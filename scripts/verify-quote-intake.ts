// Uses only a uniquely named disposable DB; provider sends are injected fakes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MongoClient, type Db } from 'mongodb';
import { saveQuoteIntake, drainQuoteIntake, quoteIntakeHealth, type QuoteDeliveryProviders } from '../lib/quote-intake';
import { QuoteLeadSchema } from '../lib/leads';

async function main() {
  const uri = process.env.QUOTE_VERIFY_URI;
  if (!uri) throw new Error('Run with node scripts/quote-local.mjs verify');
  for (const key of ['RESEND_API_KEY', 'GVAI_INTAKE_KEY', 'GROQ_API_KEY']) assert.ok(!process.env[key], 'Provider credentials must be absent');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
  const cleanupName = process.argv[2] === '--cleanup' ? process.argv[3] : null;
  const dbName = cleanupName || `qint_fixture_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  assert.match(dbName, /^qint_fixture_[a-f0-9]{20}$/);
  const db = client.db(dbName);
  async function cleanup() {
    assert.match(db.databaseName, /^qint_fixture_[a-f0-9]{20}$/);
    try {
      for (const collection of await db.listCollections({}, { nameOnly: true }).toArray()) await db.collection(collection.name).drop();
      console.log('Disposable fixture collections removed. No real provider sends.');
    } finally { await client.close(); }
  }
  if (cleanupName) { await cleanup(); return; }
  const { captureWebsiteIntake, WebsiteIntakeSchema } = await import(pathToFileURL(resolve('../gvai/gvai/lib/website-intake.ts')).href);
  const input = QuoteLeadSchema.parse({ submissionId: randomUUID(), name: 'Fixture Shipper', company: 'Example Company', email: 'fixture@example.com', phone: '+12025550101', pickupLocation: 'Fixture pickup', dropoffLocation: 'Fixture destination', serviceType: 'Full truckload', pickupDate: '2026-10-20', notes: '<script>Fixture only</script> Keep upright.' });
  const start = new Date('2026-10-18T12:00:00Z');
  let clock = start;
  const calls: { kind: string; key: string; payload: unknown }[] = [];
  const provider: QuoteDeliveryProviders = {
    configured: () => true,
    async send(kind, payload, key) {
      calls.push({ kind, payload, key });
      if (kind === 'owner') return { ok: true, providerId: 'fake-provider-receipt' };
      const captured = await captureWebsiteIntake(db, 'twinmile', WebsiteIntakeSchema.parse(payload));
      assert.equal(captured.conflict, false);
      return { ok: true, providerId: captured.leadId };
    },
  };
  try {
    const first = await saveQuoteIntake(db, input, true, clock);
    const duplicate = await saveQuoteIntake(db, input, true, clock);
    assert.equal(first.created, true);
    assert.equal(duplicate.created, false);
    assert.equal(String(first.id), String(duplicate.id));
    await assert.rejects(saveQuoteIntake(db, { ...input, phone: '+12025550102' }, true, clock));
    assert.equal(await db.collection('leads_quotes').countDocuments(), 1);
    const saved = await db.collection('leads_quotes').findOne({ _id: first.id });
    assert.equal(saved!.customerNotes, input.notes);
    assert.deepEqual(saved!.notes, []);
    assert.equal(saved!.nextFollowUpAt.toISOString(), '2026-10-19T12:00:00.000Z');
    assert.match(saved!.quoteDelivery.owner.payload.html, /&lt;script&gt;/);
    console.log('PASS: one quote on retry, immutable payload, customer notes preserved and escaped, Monday follow-up');

    const delivered = await drainQuoteIntake(db, { quoteId: first.id, providers: provider, now: () => clock });
    assert.equal(delivered.accepted, 3);
    assert.equal(await db.collection('outreach_tasks').countDocuments(), 1);
    const task = await db.collection('outreach_tasks').findOne({ leadId: first.id });
    assert.equal(task!.status, 'pending');
    assert.equal(task!.template, 'quote_followup');
    assert.match(String(task!._id), /^[a-f0-9]{24}$/);
    assert.equal(await db.collection('leads').countDocuments({ clientId: 'twinmile' }), 1);
    assert.equal(await db.collection('leads').countDocuments({ clientId: 'notarylopez' }), 0);
    assert.equal(await db.collection('bookings').countDocuments(), 0);
    assert.equal(calls.length, 2);
    await drainQuoteIntake(db, { quoteId: first.id, providers: provider, now: () => clock });
    assert.equal(calls.length, 2);
    console.log('PASS: owner receipt + actual GVAI capture contract, one pending follow-up, no booking or duplicate send');

    const payload = WebsiteIntakeSchema.parse(saved!.quoteDelivery.gvai.payload);
    const receipt = await captureWebsiteIntake(db, 'twinmile', payload);
    assert.equal(receipt.replayed, true);
    const lead = await db.collection('leads').findOne({ clientId: 'twinmile' });
    await db.collection('leads').updateOne({ _id: lead!._id }, { $set: { notes: 'Owner edited this' } });
    await captureWebsiteIntake(db, 'twinmile', payload);
    assert.equal((await db.collection('leads').findOne({ _id: lead!._id }))!.notes, 'Owner edited this');
    assert.equal((await captureWebsiteIntake(db, 'twinmile', { ...payload, summary: 'Changed' })).conflict, true);
    const otherTenant = await captureWebsiteIntake(db, 'notarylopez', payload);
    assert.notEqual(otherTenant.leadId, lead!.id);
    await db.collection('leads').deleteOne({ _id: lead!._id });
    await captureWebsiteIntake(db, 'twinmile', payload);
    assert.equal(await db.collection('leads').countDocuments({ clientId: 'twinmile' }), 0);
    console.log('PASS: permanent tenant-specific deduplication, no overwriting edits or reviving deleted inquiries');

    // A receipt persisted before a crash must not block repair of its lead.
    const repairPayload = { ...payload, eventId: `repair:${randomUUID()}` };
    const faultyDb = { collection(name: string) { if (name === 'leads') return { updateOne: async () => { throw new Error('fixture crash'); } }; return db.collection(name); } } as unknown as Db;
    await assert.rejects(captureWebsiteIntake(faultyDb, 'twinmile', repairPayload));
    await captureWebsiteIntake(db, 'twinmile', repairPayload);
    assert.equal(await db.collection('leads').countDocuments({ clientId: 'twinmile' }), 1);
    console.log('PASS: interrupted GVAI receipt is repaired, not silently acknowledged');

    const retry = await saveQuoteIntake(db, { ...input, submissionId: randomUUID() }, false, clock);
    const retryCalls: { key: string; payload: string }[] = [];
    let failOwner = true;
    const flaky: QuoteDeliveryProviders = { ...provider, async send(kind, body, key) {
      if (kind === 'owner') {
        retryCalls.push({ key, payload: JSON.stringify(body) });
        if (failOwner) throw new Error('fixture timeout after provider acceptance');
      }
      return provider.send(kind, body, key);
    } };
    await drainQuoteIntake(db, { quoteId: retry.id, providers: flaky, now: () => clock });
    assert.equal((await db.collection('leads_quotes').findOne({ _id: retry.id }))!.quoteDelivery.owner.status, 'pending');
    clock = new Date(start.getTime() + 5 * 60_000);
    failOwner = false;
    await drainQuoteIntake(db, { quoteId: retry.id, providers: flaky, now: () => clock });
    assert.equal(retryCalls.length, 2);
    assert.deepEqual(retryCalls[0], retryCalls[1]);
    console.log('PASS: ambiguous owner acceptance retries with identical provider key and payload');

    const expired = await saveQuoteIntake(db, { ...input, submissionId: randomUUID() }, false, clock);
    await db.collection('leads_quotes').updateOne({ _id: expired.id }, { $set: { 'quoteDelivery.owner.firstAttemptAt': new Date(clock.getTime() - 23 * 60 * 60_000), 'quoteDelivery.gvai.status': 'accepted' } });
    const before = calls.length;
    await drainQuoteIntake(db, { quoteId: expired.id, providers: provider, now: () => clock });
    assert.equal(calls.length, before);
    assert.equal((await db.collection('leads_quotes').findOne({ _id: expired.id }))!.quoteDelivery.owner.status, 'attention');
    assert.equal((await quoteIntakeHealth(db)).attention, 1);
    console.log('PASS: expired email deduplication window requires review; no unsafe resend');

    const stale = await saveQuoteIntake(db, { ...input, submissionId: randomUUID() }, false, clock);
    await db.collection('leads_quotes').updateOne({ _id: stale.id }, { $set: { 'quoteDelivery.gvai.status': 'accepted', 'quoteDelivery.owner.status': 'processing', 'quoteDelivery.owner.owner': 'dead-worker', 'quoteDelivery.owner.leaseUntil': new Date(clock.getTime() - 1) } });
    await drainQuoteIntake(db, { quoteId: stale.id, providers: provider, now: () => clock });
    assert.equal((await db.collection('leads_quotes').findOne({ _id: stale.id }))!.quoteDelivery.owner.status, 'accepted');
    const leaseLoss = await saveQuoteIntake(db, { ...input, submissionId: randomUUID() }, false, clock);
    await db.collection('leads_quotes').updateOne({ _id: leaseLoss.id }, { $set: { 'quoteDelivery.gvai.status': 'accepted' } });
    await drainQuoteIntake(db, { quoteId: leaseLoss.id, limit: 1, now: () => clock, providers: { ...provider, async send() { clock = new Date(clock.getTime() + 91_000); return { ok: true, providerId: 'stale-receipt' }; } } });
    assert.notEqual((await db.collection('leads_quotes').findOne({ _id: leaseLoss.id }))!.quoteDelivery.owner.status, 'accepted');
    console.log('PASS: abandoned leases recover; expired workers cannot acknowledge someone else\'s job');

    const missing = await saveQuoteIntake(db, { ...input, submissionId: randomUUID() }, false, clock);
    await drainQuoteIntake(db, { quoteId: missing.id, providers: { configured: () => false, send: async () => { throw new Error('must not send'); } }, now: () => clock });
    const misconfigured = await db.collection('leads_quotes').findOne({ _id: missing.id });
    assert.equal(misconfigured!.quoteDelivery.owner.status, 'pending');
    assert.equal(misconfigured!.quoteDelivery.owner.firstAttemptAt, undefined);
    assert.match(misconfigured!.quoteDelivery.gvai.reason, /not-configured/);
    assert.ok((await quoteIntakeHealth(db)).pending > 0);
    for (let i = 0; i < 4; i++) await saveQuoteIntake(db, { ...input, submissionId: randomUUID() }, true, clock);
    const fairCalls: string[] = [];
    await drainQuoteIntake(db, { providers: { ...provider, async send(kind) { fairCalls.push(kind); return { ok: true, providerId: 'fake' }; } }, now: () => clock });
    assert.ok(fairCalls.includes('gvai'));
    console.log('PASS: missing configuration stays visible; busy queues do not starve GVAI');
  } finally {
    await cleanup();
  }
}
main().catch(error => {
  console.error('Quote intake verification FAILED:', String(error?.message || error).replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[database connection redacted]').slice(0, 500));
  process.exit(1);
});
