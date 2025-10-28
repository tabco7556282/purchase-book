# Stripe 本番運用チェックリスト（月1スモーク/SOP）

## 毎月のスモーク
- [ ] Middle で少額決済（Live）→ 成功
- [ ] メール受信 OK（内容・宛先）
- [ ] `/secure/stripe/storage/orders.csv` に 1行だけ追記（重複なし）
- [ ] Stripe ダッシュボード配信履歴が 200 Delivered
- [ ] `links.php` 200 / `webhook.php`(GET) 403 / 署名なしPOST 400
- [ ] `storage/` 配下 403、`config.php` 403（ブラウザ確認）

## セキュリティ・運用
- [ ] Test Webhook：エンドポイント 0（または全部停止/削除）
- [ ] Live Webhook：`checkout.session.completed` のみ選択
- [ ] `/secure/stripe/config.php` 権限 600
- [ ] `/secure/stripe/storage/` 権限 700（必要に応じ 750→755）
- [ ] バックアップ取得：`webhook.php`, `config.php`, `.htaccess`, `storage/*.csv, *.jsonl`
- [ ] `orders.csv` が肥大化していたらローテーション（例：`orders-YYYYMM.csv` へ）
2025-10-28 実行済
