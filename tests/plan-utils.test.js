const test = require('node:test');
const assert = require('node:assert/strict');

const PlanUtils = require('../plan-utils.js');

const PLAN_LIMITS = {
  free:   { suppliers: 5, products: 50, entries: 1000 },
  middle: { suppliers: 15, products: 200, entries: 5000 },
  pro:    { suppliers: Infinity, products: Infinity, entries: Infinity },
};

test('canCreate ignores soft-deleted records when counting usage', () => {
  const store = {
    settings: { plan: 'free' },
    suppliers: [
      { id: 's-1', name: 'Active 1' },
      { id: 's-2', name: 'Deleted', deleted: true },
      { id: 's-3', name: 'Hidden', hidden: true },
      { id: 's-4', name: 'Active 2' },
    ],
  };

  assert.equal(PlanUtils.getActiveCount(store.suppliers), 2);
  assert.equal(PlanUtils.canCreate(store, 'suppliers', PLAN_LIMITS, 'free'), true);

  const almostFull = {
    settings: { plan: 'free' },
    suppliers: [
      { id: 's-1' },
      { id: 's-2' },
      { id: 's-3' },
      { id: 's-4' },
      { id: 's-5' },
      { id: 's-6', deleted: true },
    ],
  };
  assert.equal(PlanUtils.canCreate(almostFull, 'suppliers', PLAN_LIMITS, 'free'), false);
});

test('computePlanLocks only locks active items beyond the limit', () => {
  const store = {
    settings: { plan: 'free' },
    suppliers: [
      { id: 's-1' },
      { id: 's-2', deleted: true },
      { id: 's-3' },
      { id: 's-4' },
    ],
    products: [],
    entries: [],
  };

  const locks = PlanUtils.computePlanLocks(store, {
    free: { suppliers: 2, products: 10, entries: 10 },
  });

  assert.deepEqual(locks.suppliers, ['s-4']);
});

test('computePlanLocks uses stable indexes when ids are missing', () => {
  const store = {
    settings: { plan: 'free' },
    suppliers: [
      { id: 's-1' },
      { name: 'No id but active' },
      { name: 'Deleted', archived: true },
      { name: 'Overflow item' },
    ],
    products: [],
    entries: [],
  };

  const locks = PlanUtils.computePlanLocks(store, {
    free: { suppliers: 2, products: 10, entries: 10 },
  });

  assert.deepEqual(locks.suppliers, [3]);
});

test('pro plan remains unlimited for creation and locks', () => {
  const store = {
    settings: { plan: 'pro' },
    suppliers: Array.from({ length: 100 }, (_, i) => ({ id: `pro-${i}` })),
    products: Array.from({ length: 100 }, (_, i) => ({ id: `prod-${i}` })),
    entries: Array.from({ length: 100 }, (_, i) => ({ id: `entry-${i}` })),
  };

  assert.equal(PlanUtils.canCreate(store, 'suppliers', PLAN_LIMITS, 'free'), true);
  const locks = PlanUtils.computePlanLocks(store, PLAN_LIMITS);
  assert.deepEqual(locks, { suppliers: [], products: [], entries: [] });
});
