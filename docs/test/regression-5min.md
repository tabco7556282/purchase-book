# 回帰テスト（5分版）

対象：EULA同意（黒背景・改定日連動）、課金フローC-1（コード入力スタブ）、モーダルa11y、出力

## 0. 前提リセット（任意）
開発ツール > コンソール
```js
localStorage.removeItem('tlp.eula.accepted');
localStorage.removeItem('tlp_eula_version');
localStorage.removeItem('tlp_eula_version_accepted');
localStorage.removeItem('tlp_eula_accepted_at');
localStorage.removeItem('tlpPro');
location.reload();
