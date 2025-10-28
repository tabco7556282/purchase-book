<?php declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

$cfg = @include __DIR__.'/config.php';
if (is_array($cfg) && !empty($cfg['STRIPE_SECRET_KEY_LIVE'])) {
  putenv('STRIPE_SECRET_KEY_LIVE='.$cfg['STRIPE_SECRET_KEY_LIVE']);
}

const STORAGE_DIR = __DIR__ . '/storage';
if (!is_dir(STORAGE_DIR)) { @mkdir(STORAGE_DIR, 0700, true); }

// ← priceID => plan名（keyが実際の price_... ）
$PRICE_PLAN = [
  'price_1SLI3t3rSjqRZT7cuU6PBp3l' => 'middle',
  'price_1SLI3t3rSjqRZT7coIVtsEkQ' => 'pro',
];

// 受信
$payload = file_get_contents('php://input') ?: '';
$sig     = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

// 署名シークレットを config から取得（配列化）
$secrets = [];
if (is_array($cfg)) {
    // 新構成（推奨: $cfg['stripe']['webhook_secret']）
    if (!empty($cfg['stripe']['webhook_secret'])) $secrets[] = $cfg['stripe']['webhook_secret'];
    // 旧構成の後方互換（あれば）
    if (!empty($cfg['WEBHOOK_SECRET_LIVE']))      $secrets[] = $cfg['WEBHOOK_SECRET_LIVE'];
    if (!empty($cfg['WHSEC_LIVE']))               $secrets[] = $cfg['WHSEC_LIVE'];
}


// 署名検証
$event = null;
foreach ($secrets as $sec) {
  try { $event = \Stripe\Webhook::constructEvent($payload, $sig, $sec); break; }
  catch (\Throwable $e) {}
}
if (!$event) { http_response_code(400); exit('invalid'); }

// 冪等
function hasProcessed(string $id): bool {
  $p = STORAGE_DIR . '/processed.ids';
  if (!file_exists($p)) return false;
  $set = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
  return in_array($id, $set, true);
}
function markProcessed(string $id): void {
  file_put_contents(STORAGE_DIR . '/processed.ids', $id . PHP_EOL, FILE_APPEND | LOCK_EX);
}
if (hasProcessed($event->id)) { http_response_code(200); exit('dup'); }

// 対象イベント
$allowed = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
];
if (!in_array($event->type, $allowed, true)) { http_response_code(200); exit('ignored'); }

// ------- 成功系処理（TEST/LIVE 共通） ------- //
if (in_array($event->type, ['checkout.session.completed','checkout.session.async_payment_succeeded'], true)) {

  // Checkoutイベント本体から取得
  $sessionId = $event->data->object->id ?? null;
  $email     = $event->data->object->customer_details->email ?? '';

  // 1) 先に plan を確定（LIVEのみ）
  $plan    = 'unknown';
  $priceId = '';
  if ($event->livemode) {
    $liveKey = getenv('STRIPE_SECRET_KEY_LIVE') ?: '';
    if ($liveKey !== '' && $sessionId) {
      try {
        $stripe  = new \Stripe\StripeClient($liveKey);
        $session = $stripe->checkout->sessions->retrieve($sessionId, ['expand' => ['line_items']]);
        $priceId = $session->line_items->data[0]->price->id ?? '';
        $plan    = $PRICE_PLAN[$priceId] ?? 'unknown';
      } catch (\Throwable $e) {}
    }
  }

  // 2) メール送信（本文JIS / 件名はUTF-8文字列をそのまま渡す方式）
  mb_language('Japanese'); mb_internal_encoding('UTF-8');
  $from        = 'no-reply@cafetabco.pussycat.jp';
  $to          = $email;
  $enc         = 'ISO-2022-JP-MS';
  $subjectUtf8 = 'ご購入ありがとうございます - Tabco Ledger Plus';
  $bodyUtf8    = "このたびはご購入ありがとうございます。\n"
               . "プラン: {$plan}\n\n"
               . "アクセスURL: https://cafetabco.com/app/\n"
               . "ご利用開始手順: https://cafetabco.com/help/start\n"
               . "お問い合わせ: support@cafetabco.com\n";
  $bodyJis     = mb_convert_encoding($bodyUtf8, $enc, 'UTF-8');
  $headers  = "From: ".mb_encode_mimeheader('Tabco Ledger Plus', $enc)." <{$from}>\r\n";
  $headers .= "Reply-To: support@cafetabco.com\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/plain; charset=ISO-2022-JP\r\n";
  $headers .= "Content-Transfer-Encoding: 7bit\r\n";
  mb_send_mail($to, $subjectUtf8, $bodyJis, $headers, "-f{$from}");

  // 3) LIVEならCSVへ記録
  if ($event->livemode) {
    $csv = STORAGE_DIR . '/orders.csv';
    $row = [$event->created, date('c',(int)$event->created), $event->id, $sessionId, $email, $priceId, $plan];
    $fp = @fopen($csv, 'a'); if ($fp) { fputcsv($fp, $row); fclose($fp); }
  }
} // ------- 成功系処理ここまで ------- //


// 最小ログ（TEST/LIVE 共通）
file_put_contents(
  STORAGE_DIR . '/events.jsonl',
  json_encode(['id'=>$event->id,'type'=>$event->type,'created'=>$event->created,'live'=>$event->livemode], JSON_UNESCAPED_SLASHES) . PHP_EOL,
  FILE_APPEND | LOCK_EX
);

markProcessed($event->id);
http_response_code(200);
echo 'ok';
