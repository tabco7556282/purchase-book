(function(global){
  'use strict';

  const isPlainObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  };

  const toArray = (value) => Array.isArray(value) ? value.slice() : [];

  const toObject = (value, fallback = {}) => isPlainObject(value) ? { ...value } : { ...fallback };

  function normalizeBackupPayload(raw){
    if (!isPlainObject(raw)) {
      return { ok: false, reason: 'empty' };
    }

    const tables = isPlainObject(raw.tables) ? raw.tables : null;
    if (!tables) {
      return { ok: false, reason: 'missing_tables' };
    }

    const normalized = {
      suppliers: toArray(tables.suppliers ?? raw.suppliers),
      products: toArray(tables.products ?? raw.products),
      entries: toArray(tables.entries ?? tables.history ?? raw.entries),
      priceHistory: toObject(tables.priceHistory ?? raw.priceHistory),
      settings: toObject(tables.settings ?? raw.settings ?? raw.config)
    };

    return { ok: true, data: normalized };
  }

  function mergeSettings(currentSettings, incomingSettings){
    const defaults = {
      theme: 'light',
      lastBackupAt: null,
      plan: 'free',
      autoClear: true,
      historyShowBoth: true,
      showTaxFlags: false,
      recentProducts: [],
      hisRange: '30',
      hisRangeDays: 30
    };

    const base = toObject(currentSettings, defaults);
    const incoming = toObject(incomingSettings);
    const merged = Object.assign({}, defaults, base, incoming);

    if (!Array.isArray(merged.recentProducts)) merged.recentProducts = [];
    if (typeof merged.hisRange !== 'string') merged.hisRange = String(merged.hisRange ?? '30');
    if (!Number.isFinite(merged.hisRangeDays)) merged.hisRangeDays = Number.parseInt(merged.hisRange, 10) || 30;

    return merged;
  }

  function applyBackupToStore(store, normalized){
    if (!store || typeof store !== 'object') {
      throw new Error('store must be an object');
    }
    if (!normalized || typeof normalized !== 'object') {
      throw new Error('normalized payload missing');
    }

    store.suppliers = toArray(normalized.suppliers);
    store.products = toArray(normalized.products);
    store.entries = toArray(normalized.entries);
    store.priceHistory = toObject(normalized.priceHistory);
    store.settings = mergeSettings(store.settings, normalized.settings);

    return store;
  }

  const api = { normalizeBackupPayload, applyBackupToStore, mergeSettings, toArray, toObject, isPlainObject };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.RestoreUtils = api;
})(typeof window !== 'undefined' ? window : globalThis);
