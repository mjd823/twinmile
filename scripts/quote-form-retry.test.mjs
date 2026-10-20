import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync('components/forms/quote-form.tsx', 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

function harness() {
  let state = { state: 'idle' };
  const submissionId = { current: null };
  const calls = [];
  let accept;
  let interrupt;
  const pending = new Promise((resolve, reject) => {
    accept = () => resolve({ ok: true });
    interrupt = () => reject(new Error('Synthetic interrupted response'));
  });
  const element = (type, props) => ({ type, props });
  const mocks = {
    react: {
      useState: () => [state, next => { state = next; }],
      useRef: () => submissionId,
      useEffect: () => {},
    },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/input': { Input: 'input' },
    '@/components/ui/textarea': { Textarea: 'textarea' },
    '@/lib/utm': { captureUtm: () => {}, getUtm: () => undefined },
    '@/app/actions/public': {
      submitQuoteLeadAction: async payload => {
        calls.push({ ...payload });
        return calls.length === 1 ? pending : { ok: true };
      },
    },
  };
  const importer = id => {
    if (!Object.hasOwn(mocks, id)) throw new Error(`Unmocked dependency: ${id}`);
    return mocks[id];
  };
  let sequence = 0;
  const module = { exports: {} };
  // The sandbox has no fetch, process, database, or real action imports.
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    FormData: class {
      constructor(form) { this.form = form; }
      entries() { return Object.entries(this.form.values)[Symbol.iterator](); }
    },
  })(importer, module, module.exports);
  const form = {
    values: { name: 'Fixture', notes: 'Original details' },
    reset() { this.values = {}; },
  };
  const render = () => module.exports.QuoteForm().props;
  const submit = () => render().onSubmit({ preventDefault() {}, currentTarget: form });
  return { calls, form, render, submit, accept, interrupt, state: () => state.state };
}

test('an unchanged quote retry keeps its submission ID after an interrupted response', { timeout: 1000 }, async () => {
  const h = harness();
  const first = h.submit();
  assert.equal(h.state(), 'submitting');
  h.interrupt();
  await first;
  assert.equal(h.state(), 'error');
  await h.submit();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].submissionId, h.calls[0].submissionId);
});

test('editing a quote while submitting gives its interrupted retry a new submission ID', { timeout: 1000 }, async () => {
  const h = harness();
  const first = h.submit();
  assert.equal(h.state(), 'submitting');
  h.form.values.notes = 'Edited during submission';
  h.render().onChange();
  h.interrupt();
  await first;
  assert.equal(h.state(), 'error');
  await h.submit();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].notes, 'Original details');
  assert.equal(h.calls[1].notes, 'Edited during submission');
  assert.notEqual(h.calls[1].submissionId, h.calls[0].submissionId);
});

test('a successful response preserves freight details edited while submitting until they are submitted', { timeout: 1000 }, async () => {
  const h = harness();
  h.form.values = {
    name: 'Fixture Shipper', company: 'Fixture Freight', email: 'shipper@example.invalid',
    phone: '202-555-0100', pickupLocation: 'Austin, TX', dropoffLocation: 'Dallas, TX',
    serviceType: 'Freight Transportation', pickupDate: '10/26/2026',
    notes: '2 pallets, 1,200 lb total, 48 x 40 x 48 inches each', hp: '',
  };
  const original = { ...h.form.values };
  const first = h.submit();
  assert.equal(h.state(), 'submitting');
  h.form.values.notes = '3 pallets, 1,800 lb total, 48 x 40 x 48 inches each';
  h.render().onChange();
  const edited = { ...h.form.values };
  h.accept();
  await first;

  assert.equal(h.calls[0].notes, original.notes);
  assert.deepEqual(h.form.values, edited, 'unsent freight corrections must survive the original success');
  const receipt = h.render().children.find(child => child?.props?.role === 'status');
  assert.match(receipt?.props.children, /original request/i);
  assert.match(receipt?.props.children, /changes.*have not been submitted/i);

  await h.submit();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].notes, edited.notes);
  assert.notEqual(h.calls[1].submissionId, h.calls[0].submissionId);
  assert.deepEqual(h.form.values, {}, 'an unchanged successful submission still resets the form');
  const finalReceipt = h.render().children.find(child => child?.props?.role === 'status');
  assert.match(finalReceipt?.props.children, /received your request/i);
  assert.doesNotMatch(finalReceipt?.props.children, /have not been submitted/i);
});
