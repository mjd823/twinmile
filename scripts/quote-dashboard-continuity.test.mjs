import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';

function harness({ admin = true, count = 2, fail = false, configured = true } = {}) {
  const queries = [];
  const db = { collection(name) {
    assert.equal(name, 'leads_quotes');
    return { async countDocuments(filter) {
      queries.push(filter);
      if (fail) throw new Error('Fixture database failure');
      return count;
    } };
  } };
  const mocks = {
    'react/jsx-runtime': jsx,
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/lib/mongodb': { __esModule: true, default: configured ? Promise.resolve({ db: () => db }) : null },
    '@/lib/auth/session': { requireRole: async role => { assert.equal(role, 'admin'); return admin ? { email: 'fixture@example.invalid' } : null; } },
    '@/lib/recruiting-coverage': { getRecruitingCoverage: async () => ({ totals: {} }) },
    '@/components/admin/admin-ops-dashboard': { AdminOpsDashboard: () => React.createElement('div', {}, 'Existing operations') },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync('app/admin/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console: { error() {} } })(id => {
    if (!Object.hasOwn(mocks, id)) throw new Error(`Unexpected dependency: ${id}`);
    return mocks[id];
  }, module, module.exports);
  return { queries, async render() { return renderToStaticMarkup(await module.exports.default()); } };
}

test('operations exposes failed quote handoffs and links to the existing manual quote inbox', async () => {
  const h = harness();
  const html = await h.render();
  assert.match(html, /2 quote handoffs need review/);
  assert.match(html, /href="\/admin\/lead-engine\?tab=manual"/);
  assert.match(html, /Existing operations/);
  assert.equal(h.queries.length, 1);
  assert.equal(JSON.stringify(h.queries[0]), JSON.stringify({ isArchived: { $ne: true }, $or: [
    { 'quoteDelivery.owner.status': 'attention' }, { 'quoteDelivery.gvai.status': 'attention' },
  ] }));
});

test('a single failed quote uses singular copy', async () => {
  const html = await harness({ count: 1 }).render();
  assert.match(html, /1 quote handoff needs review/);
});

test('zero recorded failures does not show a failure warning', async () => {
  const html = await harness({ count: 0 }).render();
  assert.doesNotMatch(html, /quote handoffs? needs? review|Quote handoff status unavailable/);
});

for (const options of [{ fail: true }, { configured: false }]) {
  test(`unavailable quote data stays unknown with a review link (${JSON.stringify(options)})`, async () => {
    const html = await harness(options).render();
    assert.match(html, /Quote handoff status unavailable/);
    assert.match(html, /href="\/admin\/lead-engine\?tab=manual"/);
    assert.doesNotMatch(html, /0 quote|Fixture database failure/);
  });
}

test('unauthorized viewers cannot read quote counts or see the dashboard', async () => {
  const h = harness({ admin: false });
  assert.equal(await h.render(), '');
  assert.equal(h.queries.length, 0);
});
