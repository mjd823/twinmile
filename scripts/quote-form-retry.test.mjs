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
  let interrupt;
  const pending = new Promise((_, reject) => {
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
  return { calls, form, render, submit, interrupt, state: () => state.state };
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
