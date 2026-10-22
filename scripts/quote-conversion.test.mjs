import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';

const require = createRequire(import.meta.url);
function load(source, mocks = {}) {
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (['zod', 'mongodb', 'react/jsx-runtime'].includes(id)) return require(id);
    throw Error(`Unmocked dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}
const schema = load(readFileSync('lib/quote-conversion.ts', 'utf8'));
const valid = { rateType: 'per_mile', rateUsd: 3.25, agreedRateReviewed: true, createLoad: true };
function server() {
  const writes = [], reads = [];
  const db = { collection(name) { return {
    findOne: async () => { reads.push(name); return { name: 'Fixture', pickupLocation: 'A', dropoffLocation: 'B' }; },
    insertOne: async doc => { writes.push({ name, doc }); return { insertedId: `${name}-fixture` }; },
    updateOne: async (query, update) => { writes.push({ name, update }); return { matchedCount: 1 }; },
  }; } };
  const mocks = {
    '@/lib/quote-conversion': schema,
    '@/lib/mongodb': { __esModule: true, default: Promise.resolve({ db: () => db }) },
    '@/lib/auth/session': { requireRole: async () => ({ _id: 'offline-owner' }) },
    '@/lib/security/csrf': { isSameOrigin: () => true },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
  };
  const route = load(readFileSync('app/api/admin/leads/quotes/[id]/convert/route.ts', 'utf8'), mocks).POST;
  const source = readFileSync('app/actions/admin.ts', 'utf8');
  const ast = ts.createSourceFile('admin.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'convertQuoteLeadAction');
  // Execute the actual action body with only authenticated fixture dependencies.
  const action = load(`import { ConvertQuoteLeadSchema } from '@/lib/quote-conversion';
    import { ObjectId } from 'mongodb'; import clientPromise from '@/lib/mongodb';
    const isSameOriginFromHeaders = async () => true;
    const requireAdminOrError = async () => ({ok:true,admin:{_id:'offline-owner'}});
    ${fn.getText(ast)}`, mocks).convertQuoteLeadAction;
  const id = 'a'.repeat(24);
  return { writes, reads, action: input => action(id, input),
    api: input => route({ json: async () => input }, { params: Promise.resolve({ id }) }) };
}
for (const mode of ['action', 'api']) {
  test(`${mode} rejects missing/nonpositive/nonfinite/unreviewed agreed rates before DB access`, async () => {
    for (const input of [{}, { ...valid, rateUsd: undefined }, { ...valid, rateType: undefined },
      ...[0, -1, NaN, Infinity, -Infinity, null, '', '125'].map(rateUsd => ({ ...valid, rateUsd })),
      { ...valid, agreedRateReviewed: false }, { ...valid, agreedRateReviewed: undefined }]) {
      const h = server(), result = await h[mode](input);
      assert.equal(mode === 'api' ? result.status : result.ok, mode === 'api' ? 400 : false);
      assert.equal(h.writes.length, 0); assert.equal(h.reads.length, 0);
    }
  });
  test(`${mode} persists only explicit owner-reviewed rate and type in fake records`, async () => {
    const h = server(), result = await h[mode](valid);
    assert.equal(mode === 'api' ? result.status : result.ok, mode === 'api' ? 200 : true);
    assert.equal(h.writes.find(w => w.name === 'contracts').doc.rateType, 'per_mile');
    assert.equal(h.writes.find(w => w.name === 'contracts').doc.rateUsd, 3.25);
    assert.equal(h.writes.find(w => w.name === 'loads').doc.revenueUsd, 3.25);
  });
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  return [value, ...nodes(value.props.children)];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('');
  if (React.isValidElement(value)) return text(value.props.children);
  return typeof value === 'string' ? value : '';
}
test('quote Convert opens explicit empty rate review and submits only reviewed terms', async () => {
  const hooks = [], calls = [];
  let cursor = 0;
  const { AdminInbox } = load(readFileSync('components/admin/admin-inbox.tsx', 'utf8'), {
    react: { ...React, useState(initial) {
      const i = cursor++; if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    }, useMemo: fn => fn(), useEffect() {} },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    'lucide-react': { TriangleAlert: 'svg' },
    '@/components/ui/button': { Button: 'button' }, '@/components/ui/input': { Input: 'input' },
    '@/lib/pipeline-stages': { OFF_FUNNEL_BUCKETS: [{ label: 'Rejected' }], QUOTE_STAGES: [{ label: 'New' }], stageDef: key => ({ shortLabel: key }) },
    '@/app/actions/admin': { convertQuoteLeadAction: async (...args) => { calls.push(args); return { ok: true }; } },
  });
  const render = () => { cursor = 0; return AdminInbox({ quoteLeads: [{ id: 'quote', name: 'Fixture', status: 'new', createdAt: '' }], driverLeads: [] }); };
  nodes(render()).find(n => n.key === 'quotes:quote').props.onClick();
  nodes(render()).find(n => n.type === 'button' && text(n) === 'Convert').props.onClick();
  assert.equal(calls.length, 0);
  let form = nodes(render()).find(n => n.type === 'form');
  assert.equal(nodes(form).find(n => n.type === 'select').props.value, '');
  assert.equal(nodes(form).find(n => n.props.type === 'number').props.value, '');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0);
  nodes(form).find(n => n.type === 'select').props.onChange({ target: { value: 'flat' } });
  nodes(form).find(n => n.props.type === 'number').props.onChange({ target: { value: '725' } });
  form = nodes(render()).find(n => n.type === 'form');
  form.props.onSubmit({ preventDefault() {} }); assert.equal(calls.length, 0);
  nodes(form).find(n => n.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  form = nodes(render()).find(n => n.type === 'form');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.deepEqual({ ...calls[0][1] }, { createLoad: true, rateType: 'flat', rateUsd: 725, agreedRateReviewed: true });
  await new Promise(resolve => setImmediate(resolve));
});
