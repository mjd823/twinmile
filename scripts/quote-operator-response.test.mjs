import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { createRequire } from 'node:module';

function harness(quotes) {
  const writes = [];
  const queries = [];
  const forbiddenWrite = async () => {
    writes.push('attempted');
    throw new Error('Operator review must not write');
  };
  const db = { collection(name) {
    assert.equal(name, 'leads_quotes');
    return {
      countDocuments: async query => {
        queries.push(query);
        return quotes.filter(q => query.status.$in.includes(q.status) && q.isArchived !== true).length;
      },
      find: () => ({ limit: () => ({ toArray: async () => quotes }) }),
      updateOne: forbiddenWrite,
      insertOne: forbiddenWrite,
    };
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/mongodb': { __esModule: true, default: Promise.resolve({ db: () => db }) },
    '@/lib/fmcsa-prospecting-core': { runFmcsaProspecting: () => { throw new Error('No prospecting'); } },
  };
  const code = ts.transpileModule(readFileSync('app/admin/api/ai-activity/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  // No network, provider credentials, or actual database is available to the route.
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console: { error() {} },
  })(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unmocked dependency: ${id}`);
    return mocks[id];
  }, module, module.exports);
  return { writes, queries, post: () => module.exports.POST({ json: async () => ({ action: 'find_customers' }) }) };
}

test('quote processing hands off to operator without inventing quoted status or completion', async () => {
  const quotes = [
    { status: 'new' }, { status: 'qualified' }, { status: 'contacted' },
    { status: 'new', isArchived: true }, { status: 'converted' }, { status: 'lost' },
  ];
  const before = JSON.stringify(quotes);
  const h = harness(quotes);
  const { body, status } = await h.post();
  assert.deepEqual(h.writes, []);
  assert.equal(JSON.stringify(quotes), before);
  assert.equal(status, 200);
  assert.equal(body.success, false);
  assert.equal(body.requiresOperator, true);
  assert.equal(body.details.pendingTotal, 3);
  assert.equal(body.details.quotesBuilt, 0);
  assert.match(body.message, /operator/i);
  assert.match(body.message, /response/i);
  assert.equal(h.queries[0].isArchived.$ne, true);
});

test('empty quote queue reports no response work and never records a completed quote', async () => {
  const h = harness([]);
  const { body } = await h.post();
  assert.deepEqual(h.writes, []);
  assert.equal(body.success, false);
  assert.equal(body.requiresOperator, true);
  assert.equal(body.details.pendingTotal, 0);
  assert.equal(body.details.quotesBuilt, 0);
  assert.match(body.message, /No active quote requests/);
});

test('operator handoff opens the existing inbox and does not advance failed workflow actions', async () => {
  const require = createRequire(import.meta.url);
  const hooks = [];
  let cursor = 0;
  const result = { success: false, requiresOperator: true, message: 'Operator response required' };
  const component = () => 'fixture';
  const mocks = {
    react: { ...React, useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = index === 1 ? result : initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { __esModule: true, default: 'a' },
    '@/components/ui/card': { Card: 'section', CardContent: 'div', CardHeader: 'header', CardTitle: 'h2' },
    '@/components/ui/badge': { Badge: 'span' },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/tabs': { Tabs: 'div', TabsContent: 'div', TabsList: 'div', TabsTrigger: 'button' },
    '@/lib/client-ai-activity-engine': { clientAIActivityEngine: { handleDashboardAction: async () => result } },
    'lucide-react': new Proxy({}, { get: () => component }),
  };
  const code = ts.transpileModule(readFileSync('app/admin/lead-engine/agent/[id]/agent-dashboard-client.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unmocked dependency: ${id}`);
    return mocks[id];
  }, module, module.exports);
  const tree = module.exports.AgentDashboardClient({ agentId: 'sales', name: 'Fixture Operator',
    role: 'Sales', department: 'Sales', color: '', action: {}, tools: [], recentActivity: [] });
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    return React.isValidElement(value) ? [value, ...nodes(value.props.children)] : [];
  }
  const elements = nodes(tree);
  assert.ok(elements.some(el => el.props.href === '/admin/lead-engine?tab=manual'));
  assert.ok(!elements.some(el => el.props.children === 'Step completed:'));
  const advance = elements.find(el => el.type === 'button' &&
    JSON.stringify(el.props.children).includes('Advance'));
  assert.ok(advance, 'Expected existing workflow advance control');
  await advance.props.onClick();
  assert.equal(hooks[3], 0, 'An operator handoff is not a completed workflow step');
});
