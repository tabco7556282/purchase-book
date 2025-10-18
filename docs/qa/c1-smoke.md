# C-1 スタブ動作確認（Codespacesブラウザ）

- 初期：無料 / pill=「プラン：無料」 / tlpPro=null … OK
- 「コードを入力」：11桁以下は適用ボタン無効 … OK
- 12桁以上で有効→適用：tlpPro='1'、pill=「プラン：プロ」、広告非表示 … OK
- キャンセル：状態変化なし … OK
- 再読込後もプロ継続 … OK
- 備考：PWA/manifestのCORS赤ログは開発環境由来で無視
