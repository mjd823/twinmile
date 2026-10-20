import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const result = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(result.diagnostics, []);
  const module = { exports: {} };
  const importer = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === 'react/jsx-runtime') return require(id);
    throw new Error(`Unmocked dependency: ${id}`);
  };
  // No fetch, environment secrets, real database, or business actions enter this sandbox.
  vm.runInNewContext(`(function(require,module,exports){${result.outputText}\n})`, {
    process: { env: {} },
  })(importer, module, module.exports);
  return module.exports;
}

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  return [value, ...nodes(value.props.children)];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('');
  if (React.isValidElement(value)) return text(value.props.children);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
const quote = (id, delivery, overrides = {}) => ({
  id, name: id, company: 'Fixture freight', email: `${id}@example.invalid`, phone: '',
  pickupLocation: 'Pickup', dropoffLocation: 'Destination', status: 'new',
  createdAt: '2026-10-19T12:00:00Z', delivery, ...overrides,
});
const fixtures = [
  quote('owner-only', { operator: 'attention', gvai: 'accepted', operatorReason: 'Review before another send' }),
  quote('gvai-only', { operator: 'accepted', gvai: 'attention', gvaiReason: 'gvai-http-409' }, { status: 'qualified', createdAt: '2026-10-18T12:00:00Z' }),
  quote('both', { operator: 'attention', gvai: 'attention' }, { createdAt: '2026-10-17T12:00:00Z' }),
  quote('accepted', { operator: 'accepted', gvai: 'accepted' }),
  quote('pending', { operator: 'pending', gvai: 'processing' }),
  quote('legacy', undefined),
];
function inbox({ quoteLeads = fixtures, initialType, initialStage } = {}) {
  const hooks = [];
  let cursor = 0;
  let actionCalls = 0;
  const { AdminInbox } = load('components/admin/admin-inbox.tsx', {
    react: {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = initial;
        return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
      },
      useMemo(factory, deps) {
        const index = cursor++;
        const previous = hooks[index];
        if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
          hooks[index] = { deps, value: factory() };
        }
        return hooks[index].value;
      },
      useEffect() { cursor++; },
    },
    'lucide-react': { TriangleAlert: props => React.createElement('svg', props) },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/input': { Input: 'input' },
    '@/lib/pipeline-stages': {
      OFF_FUNNEL_BUCKETS: [{ label: 'Rejected' }], QUOTE_STAGES: [{ label: 'New' }],
      stageDef: key => ({ shortLabel: key }),
    },
    '@/app/actions/admin': Object.fromEntries([
      'convertDriverLeadAction', 'convertQuoteLeadAction', 'deleteLeadAction', 'updateLeadAction',
    ].map(name => [name, () => { actionCalls++; throw new Error('Business actions must not run'); }])),
  });
  const render = () => {
    cursor = 0;
    return AdminInbox({
      quoteLeads, initialType, initialStage,
      driverLeads: [{ id: 'driver', fullName: 'Driver fixture', status: 'new', createdAt: '', email: '', truckType: '' }],
    });
  };
  const toggle = checked => nodes(render()).find(n => n.type === 'input' && n.props.type === 'checkbox')
    .props.onChange({ currentTarget: { checked } });
  const rows = () => nodes(render()).filter(n => n.type === 'button' && /^(quotes|drivers):/.test(n.key || ''));
  const ids = () => rows().map(n => n.key);
  return { render, toggle, rows, ids, actionCalls: () => actionCalls };
}

function pageHarness({ role = { id: 'fixture-admin' }, storedQuotes = [] } = {}) {
  const calls = [];
  const db = {
    collection(name) {
      calls.push(['collection', name]);
      return {
        countDocuments: async () => 123,
        aggregate: () => ({ toArray: async () => [] }),
        find(filter) {
          calls.push(['find', name, JSON.parse(JSON.stringify(filter))]);
          return { sort: () => ({ toArray: async () => name === 'leads_quotes'
            ? storedQuotes.filter(q => q.isArchived !== true) : [] }) };
        },
      };
    },
  };
  const { default: page } = load('app/admin/lead-engine/page.tsx', {
    '@/lib/mongodb': { __esModule: true, default: Promise.resolve({ db: () => db }) },
    '@/lib/auth/session': { requireRole: async name => { calls.push(['role', name]); return role; } },
    '@/lib/pipeline-stages': {
      getPipelineCounts: async () => ({}), getQuoteStageCounts: async () => ({}),
      ENGAGED_SESSION_FILTER: {}, QUALIFIED_SCORE_THRESHOLD: 75,
    },
    '@/lib/paginate': {
      parsePage: value => Math.max(1, Number(value) || 1),
      paginatedList: async (_collection, filter, options) => {
        calls.push(['paginate', JSON.parse(JSON.stringify(filter)), JSON.parse(JSON.stringify(options))]);
        return { rows: [], total: 123, page: options.page, pageCount: 3, pageSize: 50 };
      },
    },
    '@/components/admin/RecruitingPipeline': { RecruitingPipeline: 'fixture-pipeline' },
  });
  return { calls, page: params => page({ searchParams: Promise.resolve(params) }) };
}

test('admin role remains required before reading any quote data', async () => {
  const h = pageHarness({ role: null });
  assert.equal(await h.page({ tab: 'manual' }), null);
  assert.deepEqual(h.calls, [['role', 'admin']]);
});

test('page passes bounded reasons without delivery payloads, preserves archive scope and prospect pagination', async () => {
  const reason = '  Review\n before another send. ' + 'x'.repeat(400);
  const storedQuotes = Array.from({ length: 61 }, (_, i) => ({
    _id: `quote-${i}`, name: `Fixture ${i}`, isArchived: i === 0,
    quoteDelivery: {
      owner: { status: 'attention', reason, payload: { private: 'immutable-email-payload' }, owner: 'lease-token' },
      gvai: { status: 'attention', reason: { unexpected: 'object' } },
    },
  }));
  const h = pageHarness({ storedQuotes });
  const result = await h.page({ tab: 'prospects', page: '3', filter: 'below75' });
  const props = result.props.children.props;
  assert.equal(props.manualQuoteLeads.length, 60, 'attention is not limited to the first prospect page');
  assert.equal(props.manualQuoteLeads.at(-1).id, 'quote-60');
  assert.equal(props.manualQuoteLeads[0].delivery.operatorReason, reason.slice(0, 300).replace(/\s+/g, ' ').trim());
  assert.ok(props.manualQuoteLeads[0].delivery.operatorReason.length <= 300);
  assert.equal(props.manualQuoteLeads[0].delivery.gvaiReason, '');
  assert.doesNotMatch(JSON.stringify(props), /immutable-email-payload|lease-token/);
  assert.deepEqual(h.calls.find(c => c[0] === 'find' && c[1] === 'leads_quotes')[2], { isArchived: { $ne: true } });
  const pagination = h.calls.find(c => c[0] === 'paginate');
  assert.equal(pagination[2].page, 3);
  assert.deepEqual(pagination[1].$nor, [{ aiScore: { $gte: 75 } }]);
  assert.equal(props.prospects.total, 123);
  assert.equal(props.outreachPaused, true);
});

test('inbox counts quotes once and shows destination-specific row warnings only for attention', () => {
  const h = inbox();
  assert.match(text(h.render()), /Quote handoff attention \(3\)/);
  const warnings = h.rows().filter(row => text(row).includes('Handoff attention:'));
  assert.equal(warnings.length, 3);
  assert.match(text(warnings.find(row => row.key === 'quotes:owner-only')), /Handoff attention: Owner email$/);
  assert.match(text(warnings.find(row => row.key === 'quotes:gvai-only')), /Handoff attention: GVAI dashboard$/);
  assert.match(text(warnings.find(row => row.key === 'quotes:both')), /Handoff attention: Owner email, GVAI dashboard$/);
  assert.equal(h.actionCalls(), 0);
});

test('attention filter includes only flagged quotes, keeps sorting, and can restore all leads', () => {
  const h = inbox();
  h.toggle(true);
  assert.deepEqual(h.ids(), ['quotes:owner-only', 'quotes:gvai-only', 'quotes:both']);
  assert.match(text(h.render()), /3 of 7 leads/);
  nodes(h.render()).find(n => n.type === 'button' && text(n).startsWith('Submitted ')).props.onClick();
  assert.deepEqual(h.ids(), ['quotes:both', 'quotes:gvai-only', 'quotes:owner-only']);
  h.toggle(false);
  assert.equal(h.ids().length, 7);
  assert.equal(h.actionCalls(), 0);
});

test('attention intersects existing stage, search and type filters without altering its total count', () => {
  const h = inbox({ initialStage: 'qualified' });
  h.toggle(true);
  assert.deepEqual(h.ids(), ['quotes:gvai-only']);
  const search = () => nodes(h.render()).find(n => n.type === 'input' && n.props.placeholder === 'Search...');
  search().props.onChange({ currentTarget: { value: 'owner-only' } });
  assert.deepEqual(h.ids(), []);
  search().props.onChange({ currentTarget: { value: 'GVAI-ONLY' } });
  assert.deepEqual(h.ids(), ['quotes:gvai-only']);
  assert.match(text(h.render()), /Quote handoff attention \(3\)/);
  const drivers = inbox({ initialType: 'drivers' });
  drivers.toggle(true);
  assert.deepEqual(drivers.ids(), []);
  drivers.toggle(false);
  assert.deepEqual(drivers.ids(), ['drivers:driver']);
});

test('details show each stored attention reason as escaped text, not a resend control or a lost quote', () => {
  const h = inbox({ quoteLeads: [quote('detail', {
    operator: 'attention', gvai: 'attention',
    operatorReason: 'Review before another send', gvaiReason: '<script>fixture</script>',
  })] });
  h.rows()[0].props.onClick();
  const html = renderToStaticMarkup(h.render());
  assert.match(html, /Owner email reason: Review before another send/);
  assert.match(html, /GVAI dashboard reason: &lt;script&gt;fixture&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|resend|retry|lost quote|earned money/i);
  assert.equal(h.actionCalls(), 0);
});

test('legacy reasons are optional and accepted email is not represented as delivered', () => {
  const h = inbox({ quoteLeads: [quote('detail', { operator: 'accepted', gvai: 'attention' })] });
  h.rows()[0].props.onClick();
  assert.match(text(h.render()), /Owner email: Provider accepted/);
  assert.match(text(h.render()), /GVAI dashboard reason: No reason recorded\./);
  assert.doesNotMatch(text(h.render()), /Owner email reason:|delivered/i);
  const empty = inbox({ quoteLeads: [quote('legacy', undefined)] });
  assert.match(text(empty.render()), /Quote handoff attention \(0\)/);
  empty.toggle(true);
  assert.match(text(empty.render()), /No leads found for current filters/);
});
