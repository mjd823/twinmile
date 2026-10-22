import { ObjectId } from 'mongodb';

const clone = value => value instanceof ObjectId ? new ObjectId(value.toHexString()) : value instanceof Date ? new Date(value) :
  Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) : value;
const at = (row, key) => key.split('.').reduce((v, k) => v?.[k], row);
const equal = (a, b) => a instanceof ObjectId || b instanceof ObjectId ? String(a) === String(b) : JSON.stringify(a) === JSON.stringify(b);
function matches(row, query) {
  return Object.entries(query).every(([key, value]) => {
    const actual = at(row, key);
    if (value && typeof value === 'object' && '$exists' in value) return (actual !== undefined) === value.$exists;
    return value === null ? actual == null : equal(actual, value);
  });
}
export function conversionFixture() {
  const tables = new Map(), writes = [], reads = [];
  const id = 'a'.repeat(24);
  let hook = async () => {};
  const db = { collection(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    const rows = tables.get(name);
    return {
      findOne: async query => { reads.push(name); await hook('read', name, query); return clone([...rows.values()].find(row => matches(row, query)) || null); },
      updateOne: async (query, update, options) => {
        await hook('before-write', name, query, update);
        let row = [...rows.values()].find(row => matches(row, query));
        const matchedCount = row ? 1 : 0;
        if (!row && options?.upsert) {
          if (rows.has(String(query._id))) throw Object.assign(new Error('duplicate'), { code: 11000 });
          row = { _id: clone(query._id), ...clone(update.$setOnInsert) };
          rows.set(String(query._id), row);
        }
        if (row) {
          Object.assign(row, clone(update.$set || {}));
          for (const [key, value] of Object.entries(update.$push || {})) (row[key] ||= []).push(clone(value));
        }
        writes.push({ name, doc: clone(update.$setOnInsert), query, update });
        await hook('after-write', name, query, update);
        return { matchedCount, upsertedCount: !matchedCount && row ? 1 : 0 };
      },
    };
  } };
  db.collection('leads_quotes');
  tables.get('leads_quotes').set(id, { _id: new ObjectId(id), name: 'Fixture', pickupLocation: 'A', dropoffLocation: 'B',
    email: 'fixture@example.test', phone: '+15555550100', status: 'new', convertedAt: null, notes: [] });
  return { db, id, tables, writes, reads, setHook(fn) { hook = fn; }, lead: () => tables.get('leads_quotes').get(id) };
}
