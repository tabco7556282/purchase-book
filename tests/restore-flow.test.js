const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadRestoreSnippet(options = {}){
  const {
    fileContent = '{"tables":{"suppliers":[],"products":[],"entries":[],"priceHistory":{},"settings":{}}}',
    confirmResult = true,
    readerBehavior,
    initialStore
  } = options;

  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  let start = html.indexOf('const restoreState');
  if (start < 0) {
    start = html.indexOf('// Restore: 読み込み＋適用');
  }
  const end = html.indexOf('function refreshFiscalLabel');
  if (start < 0 || end < 0) {
    throw new Error('Failed to locate restore snippet in index.html');
  }
  const snippet = html.slice(start, end);

  const changeHandlers = [];
  const clickHandlers = [];
  const alerts = [];

  const input = {
    id: 'fileRestore',
    _value: '',
    files: [{ text: fileContent }],
    dataset: {},
    get value(){ return this._value; },
    set value(v){
      this._value = v;
      if (v === '') {
        this.files = [];
      }
    }
  };

  const calls = [];
  let lastSaved = null;
  const baseStore = initialStore || { suppliers: [], products: [], entries: [], priceHistory: {}, settings: {} };

  const context = {
    window: { RestoreUtils: require('../restore-utils.js') },
    document: {
      addEventListener(type, handler){
        if (type === 'change') changeHandlers.push(handler);
        else if (type === 'click') clickHandlers.push(handler);
      },
      getElementById(id){ return id === 'fileRestore' ? input : null; }
    },
    alert: (msg) => alerts.push(msg),
    confirm: () => confirmResult,
    FileReader: function(){
      this.readAsText = (file) => {
        if (typeof readerBehavior === 'function') {
          readerBehavior.call(this, file);
        } else {
          this.result = file && (file.text ?? file.content ?? '');
          if (typeof this.onload === 'function') this.onload();
        }
      };
    },
    store: JSON.parse(JSON.stringify(baseStore)),
    DB: {
      save(data){
        lastSaved = JSON.parse(JSON.stringify(data));
      },
      load(){
        if (typeof options.dbLoad === 'function') {
          return options.dbLoad(lastSaved);
        }
        if (lastSaved) return JSON.parse(JSON.stringify(lastSaved));
        return JSON.parse(JSON.stringify(baseStore));
      }
    },
    requestAnimationFrame: (fn) => { calls.push({ name: 'raf' }); fn(); },
    setTimeout,
    console
  };

  const snapshotStore = () => JSON.parse(JSON.stringify(context.store));
  const stub = (name) => () => { calls.push({ name, snapshot: snapshotStore() }); };

  context.enforcePlan = stub('enforcePlan');
  context.applyPlanUI = stub('applyPlanUI');
  context.applyTheme = stub('applyTheme');
  context.refreshHome = stub('refreshHome');
  context.initInputPage = stub('initInputPage');
  context.renderSuppliers = stub('renderSuppliers');
  context.fillFilterSupplier = stub('fillFilterSupplier');
  context.renderProducts = stub('renderProducts');
  context.renderHistory = stub('renderHistory');
  context.renderTodayList = stub('renderTodayList');
  context.navigate = (page) => { calls.push({ name: 'navigate', args: [page], snapshot: snapshotStore() }); };
  context.enableSelectOnFocus = stub('enableSelectOnFocus');

  context.calls = calls;
  context.lastSaved = () => lastSaved;

  vm.createContext(context);
  vm.runInContext(snippet, context);

  if (!changeHandlers.length) {
    throw new Error('Restore change handler was not registered');
  }

  return {
    alerts,
    input,
    trigger: () => changeHandlers[0]({ target: input }),
    context
  };
}

test('ignores duplicate change events while restore is in progress', async () => {
  let release;
  const { alerts, trigger, input } = loadRestoreSnippet({
    readerBehavior(file){
      this.result = file && (file.text ?? file.content ?? '');
      release = () => { if (typeof this.onload === 'function') this.onload(); };
    }
  });

  trigger();
  trigger();

  release();
  await input.__restorePromise;

  assert.deepEqual(alerts, ['復元しました']);
  assert.equal(input.dataset.restoring, undefined);
});

test('shows failure alert once for invalid JSON', async () => {
  const { alerts, trigger, input } = loadRestoreSnippet({ fileContent: '{"oops"', confirmResult: true });
  trigger();
  await input.__restorePromise;
  assert.deepEqual(alerts, ['復元に失敗しました。ファイルをご確認ください。']);
});

test('does not show failure alert after successful restore even if reader errors later', async () => {
  const { alerts, trigger, input } = loadRestoreSnippet({
    readerBehavior(file){
      this.result = file && (file.text ?? file.content ?? '');
      setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0);
      setTimeout(() => { if (typeof this.onerror === 'function') this.onerror({ target: { error: new Error('late error') } }); }, 1);
    }
  });

  trigger();
  await input.__restorePromise;
  assert.deepEqual(alerts, ['復元しました']);
});

test('reloads store and refreshes UI after restore', async () => {
  const data = {
    tables: {
      suppliers: [{ id: 's1', name: 'Supplier' }],
      products: [{ id: 'p1', name: 'Product', supplier_id: 's1' }],
      entries: [{ id: 'e1', supplier_id: 's1', product_id: 'p1' }],
      priceHistory: {},
      settings: { plan: 'free' }
    }
  };

  const { alerts, trigger, input, context } = loadRestoreSnippet({
    fileContent: JSON.stringify(data),
    dbLoad(lastSaved){
      const next = JSON.parse(JSON.stringify(lastSaved || {}));
      next.__reloaded = true;
      return next;
    }
  });

  const initialStore = context.store;

  trigger();
  await input.__restorePromise;

  assert.deepEqual(alerts, ['復元しました']);
  assert.notEqual(context.store, initialStore);
  assert.equal(context.store.__reloaded, true);

  const renderCall = context.calls.find((c) => c.name === 'renderSuppliers');
  assert.ok(renderCall, 'renderSuppliers should be called');
  assert.equal(renderCall.snapshot.suppliers.length, 1);

  const navCall = context.calls.find((c) => c.name === 'navigate');
  assert.ok(navCall, 'navigate should be called');
  assert.deepEqual(navCall.args, ['home']);
});
