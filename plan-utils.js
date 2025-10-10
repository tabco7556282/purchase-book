(function(global, factory){
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.PlanUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const SOFT_DELETE_TRUE_KEYS = [
    'deleted', 'isDeleted', '_deleted',
    'hidden', 'archived'
  ];
  const SOFT_DELETE_FALSE_KEYS = ['active', 'enabled', 'visible'];

  function isSoftDeleted(item){
    if (!item || typeof item !== 'object') return false;
    for (const key of SOFT_DELETE_TRUE_KEYS) {
      if (item[key] === true) return true;
    }
    for (const key of SOFT_DELETE_FALSE_KEYS) {
      if (item[key] === false) return true;
    }
    return false;
  }

  function getActiveList(list){
    if (!Array.isArray(list)) return [];
    const active = [];
    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      if (isSoftDeleted(item)) continue;
      active.push({ item, index });
    }
    return active;
  }

  function getActiveCount(list){
    return getActiveList(list).length;
  }

  function toNumericLimit(limit){
    if (limit === Infinity) return Infinity;
    if (typeof limit === 'number') {
      if (!Number.isFinite(limit) || limit < 0) return Infinity;
      return limit;
    }
    if (typeof limit === 'string' && limit.trim() !== '') {
      const num = Number(limit);
      if (Number.isFinite(num) && num >= 0) return num;
    }
    return Infinity;
  }

  function resolvePlanContext(store, planLimits, fallbackPlan = 'free'){
    const plan = (store && store.settings && store.settings.plan) || fallbackPlan;
    const fallbackLimits = (planLimits && planLimits[fallbackPlan]) || {};
    const limits = (planLimits && planLimits[plan]) || fallbackLimits;
    return { plan, limits, fallbackLimits };
  }

  function getPlanLimit(context, entity, { fallbackInfinity = true } = {}){
    if (!context) return fallbackInfinity ? Infinity : 0;
    const { limits, fallbackLimits } = context;
    const hasLimit = limits && Object.prototype.hasOwnProperty.call(limits, entity);
    const hasFallback = fallbackLimits && Object.prototype.hasOwnProperty.call(fallbackLimits, entity);
    const raw = hasLimit ? limits[entity] : (hasFallback ? fallbackLimits[entity] : undefined);

    if (raw === undefined) return fallbackInfinity ? Infinity : 0;
    if (raw === Infinity) return Infinity;

    const numeric = toNumericLimit(raw);
    if (numeric === Infinity) {
      return fallbackInfinity ? Infinity : 0;
    }
    return numeric;
  }

  function computeLockList(list, limit){
    const numericLimit = toNumericLimit(limit);
    if (numericLimit === Infinity) return [];

    const active = getActiveList(list);
    if (active.length <= numericLimit) return [];

    const locks = [];
    for (let i = numericLimit; i < active.length; i++) {
      const { item, index } = active[i];
      const id = item && (item.id ?? item.uuid ?? item.code);
      locks.push(id != null ? id : index);
    }
    return locks;
  }

  function computePlanLocks(store, planLimits, fallbackPlan = 'free'){
    const context = resolvePlanContext(store, planLimits, fallbackPlan);
    return {
      suppliers: computeLockList(store && store.suppliers, getPlanLimit(context, 'suppliers', { fallbackInfinity: true })),
      products:  computeLockList(store && store.products,  getPlanLimit(context, 'products',  { fallbackInfinity: true })),
      entries:   computeLockList(store && store.entries,   getPlanLimit(context, 'entries',   { fallbackInfinity: true })),
    };
  }

  function canCreate(store, entity, planLimits, fallbackPlan = 'free'){
    const context = resolvePlanContext(store, planLimits, fallbackPlan);
    const limit = getPlanLimit(context, entity, { fallbackInfinity: false });
    if (limit === Infinity) return true;
    const count = getActiveCount(store && store[entity]);
    return count < limit;
  }

  return {
    isSoftDeleted,
    getActiveList,
    getActiveCount,
    resolvePlanContext,
    getPlanLimit,
    computeLockList,
    computePlanLocks,
    canCreate,
    toNumericLimit,
  };
});
