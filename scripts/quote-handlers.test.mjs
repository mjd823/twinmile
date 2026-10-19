import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const importer = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === '@/lib/leads') return load('lib/leads.ts');
    if (id.startsWith('@/')) throw new Error(`Unmocked application dependency: ${id}`);
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(importer, module, module.exports);
  return module.exports;
}
const valid = { submissionId: 'ea5aac22-43fa-4845-b121-2da0c50743d9', name: 'Fixture', email: 'fixture@example.com', phone: '+12025550101', pickupLocation: 'Pickup', dropoffLocation: 'Destination', serviceType: 'Truckload', notes: 'Keep upright' };
function harness({ rate = true, failDrain = false, created = true } = {}) {
  const calls = [];
  const db = { collection: () => ({ updateOne: async (...args) => { calls.push(['update', ...args]); } }) };
  const mocks = {
    '@/lib/mongodb': { __esModule: true, default: Promise.resolve({ db: () => db }) },
    '@/lib/security/rate-limit': { rateLimit: async () => ({ ok: rate }) },
    '@/lib/security/request': { getClientIp: () => '203.0.113.9' },
    '@/app/actions/_request': { getClientIpFromHeaders: async () => '203.0.113.9' },
    '@/lib/email': { sendQuoteLeadConfirmation: async data => { calls.push(['confirmation', data]); return true; } },
    '@/lib/quote-intake': {
      saveQuoteIntake: async (...args) => { calls.push(['save', ...args]); return { id: 'fixture-id', created }; },
      drainQuoteIntake: async (...args) => { calls.push(['drain', ...args]); if (failDrain) throw new Error('fixture queue failure'); },
    },
  };
  return { calls, action: load('app/actions/public.ts', mocks).submitQuoteLeadAction, api: load('app/api/quote/route.ts', mocks).POST };
}
test('actual visible form action persists notes and acknowledges saved quotes despite delivery failure', async () => {
  const h = harness({ failDrain: true });
  assert.deepEqual(await h.action(valid), { ok: true });
  const saved = h.calls.find(c => c[0] === 'save');
  assert.equal(saved[2].notes, 'Keep upright');
  assert.equal(saved[3], true);
  assert.equal(h.calls.filter(c => c[0] === 'confirmation').length, 1);
});
test('repeated form submission never sends another customer confirmation', async () => {
  const h = harness({ created: false });
  assert.deepEqual(await h.action(valid), { ok: true });
  assert.equal(h.calls.filter(c => c[0] === 'confirmation').length, 0);
});
test('API uses the same saver, never sends a customer confirmation or enables follow-up', async () => {
  const h = harness({ failDrain: true });
  const response = await h.api(new Request('https://twinmile.com/api/quote', { method: 'POST', body: JSON.stringify(valid) }));
  assert.equal(response.status, 200);
  assert.equal(h.calls.find(c => c[0] === 'save')[3], false);
  assert.equal(h.calls.filter(c => c[0] === 'confirmation').length, 0);
});
test('both entry points reject invalid and rate-limited submissions before saving', async () => {
  const h = harness({ rate: false });
  assert.equal((await h.action(valid)).ok, false);
  assert.equal((await h.api(new Request('https://twinmile.com', { method: 'POST', body: JSON.stringify(valid) }))).status, 429);
  assert.equal(h.calls.length, 0);
  const invalid = harness();
  assert.equal((await invalid.action({ ...valid, email: 'bad' })).ok, false);
  assert.equal(invalid.calls.length, 0);
});
test('honeypot gets neutral success but creates no jobs or email', async () => {
  const h = harness();
  assert.deepEqual(await h.action({ ...valid, hp: 'bot' }), { ok: true });
  assert.equal(h.calls.length, 0);
});
test('cron rejects unauthorized calls before database or providers', async () => {
  const denied = new Response(null, { status: 401 });
  const cron = load('app/api/cron/quote-intake/route.ts', {
    '@/lib/mongodb': { __esModule: true, default: null },
    '@/lib/cron-auth': { checkCronAuth: () => denied },
    '@/lib/quote-intake': { drainQuoteIntake: () => { throw new Error('must not run'); } },
  });
  assert.equal(await cron.GET(new Request('https://twinmile.com')), denied);
});

test('real GVAI adapter requires a capture receipt and cannot choose another destination', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GVAI_INTAKE_KEY;
  process.env.GVAI_INTAKE_KEY = 'a'.repeat(64);
  let response = new Response(JSON.stringify({ captured: true, leadId: 'fixture-lead' }), { status: 201 });
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return response; };
  try {
    const { quoteDeliveryProviders } = load('lib/quote-intake.ts', { '@/lib/email': {} });
    assert.equal(quoteDeliveryProviders.configured('gvai'), true);
    assert.deepEqual(await quoteDeliveryProviders.send('gvai', { eventId: 'fixture-event' }, 'fixture-key'), { ok: true, providerId: 'fixture-lead' });
    assert.equal(calls[0][0], 'https://gvaipowered.com/api/client-intake/twinmile');
    assert.equal(calls[0][1].redirect, 'error');
    assert.equal(calls[0][1].headers.Authorization, `Bearer ${'a'.repeat(64)}`);
    assert.ok(!calls[0][1].body.includes('Bearer'));
    response = new Response(JSON.stringify({ captured: false }), { status: 200 });
    assert.equal((await quoteDeliveryProviders.send('gvai', {}, 'fixture-key')).ok, false);
    response = new Response(JSON.stringify({ error: 'conflict' }), { status: 409 });
    assert.equal((await quoteDeliveryProviders.send('gvai', {}, 'fixture-key')).permanent, true);
    response = new Response('Temporary failure', { status: 503 });
    assert.equal((await quoteDeliveryProviders.send('gvai', {}, 'fixture-key')).permanent, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GVAI_INTAKE_KEY; else process.env.GVAI_INTAKE_KEY = originalKey;
  }
});
