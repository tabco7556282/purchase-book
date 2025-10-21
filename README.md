# purchase-book

## Test Docs
- [回帰テスト（5分版）](docs/test/regression-5min.md)
- 注意: Stripe Webhookの署名シークレットはサーバの secret.php に保存し、Gitには含めない。
- Webhookは署名検証を有効化（server側）。whsecは public_html/api/stripe/secret.php に保存し、Gitには含めない。
-docs(ops): Webhookでイベント要約をログに追記（type/session/email）
- /api/license/redeem.php を仮実装（issued.csv を参照し、redeemed.csv に記録）
