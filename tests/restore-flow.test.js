const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadRestoreSnippet(options = {}){
  const {
    fileContent = '{"tables":{"suppliers":[],"products":[],"entries":[],"priceHistory":{},"settings":{}}}',
    confirmResult = true,
    readerBehavior
  } = options;

  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('// Restore: 読み込み＋適用');
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
    store: { suppliers: [], products: [], entries: [], priceHistory: {}, settings: {} },
    DB: { save(){} },
    enforcePlan(){},
    applyPlanUI(){},
    applyTheme(){},
    refreshHome(){},
    initInputPage(){},
    renderSuppliers(){},
    fillFilterSupplier(){},
    renderProducts(){},
    renderHistory(){},
    renderTodayList(){},
    navigate(){},
    enableSelectOnFocus(){},
    console
  };

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
  let onload;
  const { alerts, trigger, input } = loadRestoreSnippet({
    readerBehavior(file){
      this.result = file && (file.text ?? file.content ?? '');
      onload = () => { if (typeof this.onload === 'function') this.onload(); };
      setTimeout(onload, 0);
    }
  });

  trigger();
  trigger();

  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.deepEqual(alerts, ['復元しました']);
  assert.equal(input.dataset.restoring, undefined);
});

test('shows failure alert once for invalid JSON', () => {
  const { alerts, trigger } = loadRestoreSnippet({ fileContent: '{"oops"', confirmResult: true });
  trigger();
  assert.deepEqual(alerts, ['復元に失敗しました。ファイルをご確認ください。']);
});

test('does not show failure alert after successful restore even if reader errors later', async () => {
  const { alerts, trigger } = loadRestoreSnippet({
    readerBehavior(file){
      this.result = file && (file.text ?? file.content ?? '');
      setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0);
      setTimeout(() => { if (typeof this.onerror === 'function') this.onerror({ target: { error: new Error('late error') } }); }, 1);
    }
  });

  trigger();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(alerts, ['復元しました']);
});
