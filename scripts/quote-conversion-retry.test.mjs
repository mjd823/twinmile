import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { conversionFixture } from './quote-conversion-fixture.mjs';

const require = createRequire(import.meta.url);
const module = { exports: {} };
const code = ts.transpileModule(readFileSync('lib/quote-conversion.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(id => {
  assert.ok(['zod', 'mongodb', 'node:crypto'].includes(id));
  return require(id);
}, module, module.exports);
const { convertQuoteOnce: convert } = module.exports;
const terms = { rateType: 'flat', rateUsd: 725, agreedRateReviewed: true, createLoad: true };
const run = (h, input = terms) => convert(h.db, h.id, input, 'offline-owner');
const counts = h => ['customers', 'contracts', 'loads'].map(name => h.tables.get(name)?.size || 0);

test('concurrent same terms and later replay return one stable conversion and one note', async () => {
  const h = conversionFixture();
  const results = await Promise.all(Array.from({ length: 6 }, () => run(h)));
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.deepEqual(await run(h), results[0]);
  assert.deepEqual(counts(h), [1, 1, 1]);
  assert.equal(h.lead().notes.length, 1);
});
for (const stage of ['claim', 'customers', 'contracts', 'loads', 'completion']) {
  for (const phase of ['before-write', 'after-write']) {
    test(`retry reconciles ${phase} failure at ${stage} without duplicate records`, async () => {
      const h = conversionFixture(); let failed = false;
      h.setHook(async (point, name, _query, update) => {
        const relevant = stage === 'claim' ? name === 'leads_quotes' && update?.$set?.conversionIntent
          : stage === 'completion' ? name === 'leads_quotes' && update?.$set?.convertedAt : name === stage;
        if (!failed && point === phase && relevant) { failed = true; throw new Error('offline write uncertainty'); }
      });
      await assert.rejects(run(h));
      const result = await run(h);
      assert.deepEqual(h.lead().conversion, { ...result });
      assert.deepEqual(counts(h), [1, 1, 1]);
      assert.equal(h.lead().notes.length, 1);
    });
  }
}
test('competing reviewed rates cannot overwrite the winning claim', async () => {
  const h = conversionFixture();
  const results = await Promise.allSettled([run(h), run(h, { ...terms, rateUsd: 900 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.deepEqual(counts(h), [1, 1, 1]);
});
test('quote contact edit between read and claim prevents stale conversion', async () => {
  const h = conversionFixture(); let edited = false;
  h.setHook(async (phase, name, _query, update) => {
    if (!edited && phase === 'before-write' && name === 'leads_quotes' && update?.$set?.conversionIntent) {
      edited = true; h.lead().email = 'corrected@example.test';
    }
  });
  await assert.rejects(run(h), /terms changed/);
  assert.deepEqual(counts(h), [0, 0, 0]);
  await run(h);
  assert.equal([...h.tables.get('customers').values()][0].contactEmail, 'corrected@example.test');
});
test('mid-conversion quote edit blocks further writes without removing the claim', async () => {
  const h = conversionFixture();
  h.setHook(async (phase, name) => { if (phase === 'after-write' && name === 'customers') h.lead().pickupLocation = 'Corrected'; });
  await assert.rejects(run(h), /Quote changed/);
  await assert.rejects(run(h), /Quote changed/);
  assert.deepEqual(counts(h), [1, 0, 0]);
  assert.ok(h.lead().conversionIntent);
});
test('reconciliation never replaces owner edits to existing child records', async () => {
  const h = conversionFixture(); let failed = false;
  h.setHook(async (phase, name) => { if (!failed && phase === 'after-write' && name === 'contracts') { failed = true; throw Error('offline'); } });
  await assert.rejects(run(h));
  [...h.tables.get('contracts').values()][0].notes = 'Owner edit';
  await run(h);
  assert.equal([...h.tables.get('contracts').values()][0].notes, 'Owner edit');
});
test('no-load conversion stays no-load on retries and changed terms are rejected', async () => {
  const h = conversionFixture(); const input = { ...terms, createLoad: false };
  const result = await run(h, input);
  assert.equal(result.loadId, null);
  assert.deepEqual(await run(h, input), result);
  await assert.rejects(run(h), /terms changed/);
  assert.deepEqual(counts(h), [1, 1, 0]);
});
