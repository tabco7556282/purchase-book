const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeBackupPayload,
  applyBackupToStore,
  mergeSettings
} = require('../restore-utils.js');

test('normalizeBackupPayload accepts valid payload', () => {
  const payload = {
    version: '1.1',
    tables: {
      suppliers: [{ id: 's1' }],
      products: [{ id: 'p1' }],
      entries: [{ id: 'e1' }],
      priceHistory: { p1: [100] },
      settings: { plan: 'middle', theme: 'dark', recentProducts: ['p1'] }
    }
  };

  const result = normalizeBackupPayload(payload);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.suppliers, payload.tables.suppliers);
  assert.deepEqual(result.data.priceHistory, payload.tables.priceHistory);
  assert.deepEqual(result.data.settings.plan, 'middle');
  assert.deepEqual(result.data.settings.recentProducts, ['p1']);
});

test('normalizeBackupPayload handles settings outside tables and missing arrays', () => {
  const payload = {
    tables: {
      suppliers: null,
      products: undefined,
      entries: undefined,
      priceHistory: null
    },
    settings: { plan: 'pro' }
  };

  const result = normalizeBackupPayload(payload);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.suppliers, []);
  assert.deepEqual(result.data.products, []);
  assert.deepEqual(result.data.entries, []);
  assert.deepEqual(result.data.priceHistory, {});
  assert.deepEqual(result.data.settings.plan, 'pro');
});

test('normalizeBackupPayload rejects invalid payload', () => {
  assert.equal(normalizeBackupPayload(null).ok, false);
  assert.equal(normalizeBackupPayload({}).ok, false);
});

test('applyBackupToStore merges settings while preserving defaults', () => {
  const store = {
    suppliers: [],
    products: [],
    entries: [],
    priceHistory: {},
    settings: { plan: 'free', recentProducts: ['p0'], hisRange: '60' }
  };

  const normalized = {
    suppliers: [{ id: 's1' }],
    products: [],
    entries: [],
    priceHistory: { p1: [100] },
    settings: { plan: 'pro', hisRangeDays: 90 }
  };

  applyBackupToStore(store, normalized);

  assert.deepEqual(store.suppliers, [{ id: 's1' }]);
  assert.equal(store.settings.plan, 'pro');
  assert.equal(store.settings.hisRange, '60');
  assert.equal(store.settings.hisRangeDays, 90);
  assert.deepEqual(store.settings.recentProducts, ['p0']);
});

test('mergeSettings enforces array defaults', () => {
  const merged = mergeSettings({ recentProducts: 'oops' }, { plan: 'free' });
  assert.deepEqual(merged.recentProducts, []);
});
