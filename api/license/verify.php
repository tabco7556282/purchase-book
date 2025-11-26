<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

// 設定読み込み（あれば config.php、なければ config.sample.php）
$cfg = @include __DIR__ . '/config.php';
if (!$cfg) {
    $cfg = @include __DIR__ . '/config.sample.php';
}

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $cfg['allow_origins'] ?? [], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}

// /public_html まで戻る（PHP5 でも動く書き方）
$root       = dirname(dirname(dirname(__DIR__)));
$SECURE_DIR = $root . '/secure/license';
$LEDGER_CSV = $SECURE_DIR . '/redeemed.csv';
$LOG_FILE   = $SECURE_DIR . '/verify.log';

if (!is_dir($SECURE_DIR)) {
    @mkdir($SECURE_DIR, 0700, true);
}

function nowJst(): string {
    return (new DateTime('now', new DateTimeZone('Asia/Tokyo')))->format('Y-m-d H:i:s');
}

function jexit(array $arr, int $code = 200): void {
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// 入力（POST JSON なければ GET/POST パラメータ）
$raw = file_get_contents('php://input');
$in  = $raw ? json_decode($raw, true) : $_REQUEST;

$did = trim((string)($in['device'] ?? ''));
$app = trim((string)($in['app'] ?? 'tlp'));

if ($app !== 'tlp') {
    jexit(['ok' => false, 'error' => 'bad_app'], 400);
}
if ($did === '') {
    jexit(['ok' => false, 'error' => 'device_required'], 400);
}

// 監査ログ
@file_put_contents(
    $LOG_FILE,
    sprintf(
        "%s\tVERIFY\t%s\t%s\t%s\n",
        nowJst(),
        $did,
        $_SERVER['REMOTE_ADDR'] ?? '-',
        $raw !== '' ? $raw : json_encode($in, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    ),
    FILE_APPEND
);

// 台帳からプランを読む（同じ device の最後の行が有効）
$plan = 'free';
if (is_file($LEDGER_CSV) && ($fh = fopen($LEDGER_CSV, 'r')) !== false) {
    while (($row = fgetcsv($fh)) !== false) {
        // CSV: time,action,device,plan,code,ip,meta_json
        if (count($row) < 7) {
            continue;
        }
        if ($row[2] === $did) {
            $plan = $row[3];
        }
    }
    fclose($fh);
}

// 応答
jexit([
    'ok'      => true,
    'device'  => $did,
    'plan'    => $plan,   // 'free' | 'middle' | 'pro'
    'freshAt' => nowJst(),
]);
