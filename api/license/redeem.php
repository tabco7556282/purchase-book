<?php
// api/license/redeem.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// ===== パス定義 =====
// このファイルの場所: /public_html/tlp/api/license/redeem.php
// __DIR__              = /public_html/tlp/api/license
// dirname(__DIR__, 3)  = /public_html
$root       = dirname(__DIR__, 3);              // /public_html
$SECURE_DIR = $root . '/secure/license';
$CODES_CSV  = $SECURE_DIR . '/codes.csv';
$LEDGER_CSV = $SECURE_DIR . '/redeemed.csv';
$LOG_FILE   = $SECURE_DIR . '/redeem.log';

// ===== config & CORS =====
$configFile = $SECURE_DIR . '/config.php';
if (!is_file($configFile)) {
    $configFile = $SECURE_DIR . '/config.sample.php';
}
$config = is_file($configFile) ? include $configFile : [];
$allow_origins = $config['allow_origins'] ?? [];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allow_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-License-Sig');
    exit;
}

// ===== ヘルパー =====
function tlp_log_line(string $file, string $line): void {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function tlp_json_out(array $body, int $status = 200): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ===== 入力読み取り =====
$raw  = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) {
    // デバッグ用 GET も許容
    $data = [
        'code'   => $_GET['code']   ?? '',
        'device' => $_GET['device'] ?? '',
        'app'    => $_GET['app']    ?? '',
    ];
}

$codeRaw = (string)($data['code']   ?? '');
$device  = trim((string)($data['device'] ?? ''));
$app     = trim((string)($data['app']    ?? ''));

// コードは「大文字＋前後の空白除去」で統一（ハイフンはそのまま）
$code = strtoupper(trim($codeRaw));

$ip = $_SERVER['REMOTE_ADDR'] ?? '-';

// リクエストログ
tlp_log_line(
    $LOG_FILE,
    sprintf(
        "%s\tREQUEST\t%s\t%s\t%s",
        date('Y-m-d H:i:s'),
        $device ?: '-',
        $ip,
        json_encode(['code' => $code, 'app' => $app], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    )
);

// ===== バリデーション =====
if ($app !== 'tlp') {
    tlp_json_out(['ok' => false, 'error' => 'bad_app'], 400);
}
if ($code === '' || strlen($code) < 8) {
    tlp_json_out(['ok' => false, 'error' => 'code_required'], 400);
}
if ($device === '') {
    tlp_json_out(['ok' => false, 'error' => 'device_required'], 400);
}
if (!is_file($CODES_CSV)) {
    tlp_json_out(['ok' => false, 'error' => 'server_config'], 500);
}

// ===== codes.csv からコード検索 =====
// フォーマット前提:
// 0: time, 1: code, 2: plan, 3: status, 4: issued_by, 5: used_at, 6: used_device, 7: used_ip,...
$fh = @fopen($CODES_CSV, 'r');
if (!$fh) {
    tlp_json_out(['ok' => false, 'error' => 'server_read_codes'], 500);
}

// 先頭1行はヘッダー
$header = fgetcsv($fh);
if (!is_array($header)) {
    fclose($fh);
    tlp_json_out(['ok' => false, 'error' => 'codes_empty'], 500);
}

$codeRow = null;
while (($row = fgetcsv($fh)) !== false) {
    if (count($row) < 4) {
        continue;
    }

    $rowCode = strtoupper(trim((string)$row[1])); // code
    if ($rowCode !== $code) {
        continue;
    }

    $plan   = strtolower(trim((string)$row[2])); // plan
    $status = strtolower(trim((string)$row[3])); // status

    // middle / pro だけ有効
    if ($plan !== 'middle' && $plan !== 'pro') {
        continue;
    }

    $codeRow = [
        'plan'   => $plan,
        'status' => $status,
    ];
    break;
}
fclose($fh);

if (!$codeRow) {
    // 該当コード無し
    tlp_json_out(['ok' => false, 'error' => 'code_not_found']);
}

$plan = $codeRow['plan']; // 'middle' or 'pro'

// ===== redeemed.csv を読み込んで利用状況チェック =====
// 形式: time,action,device,plan,code,ip,meta_json
$existingPlanForDevice = null;
$devicesForCode        = [];

if (is_file($LEDGER_CSV)) {
    $fh = @fopen($LEDGER_CSV, 'r');
    if ($fh) {
        $head = fgetcsv($fh);
        if (is_array($head)) {
            $ix = array_flip($head);
            while (($row = fgetcsv($fh)) !== false) {
                if (count($row) < count($head)) {
                    continue;
                }
                $d = trim($row[$ix['device']] ?? '');
                $p = strtolower(trim($row[$ix['plan']]  ?? ''));
                $c = strtoupper(trim($row[$ix['code']]  ?? ''));

                if ($d === $device && ($p === 'middle' || $p === 'pro')) {
                    $existingPlanForDevice = $p;
                }
                if ($c === $code && $d !== '') {
                    $devicesForCode[$d] = true;
                }
            }
        }
        fclose($fh);
    }
}

// すでにこの端末に有料プラン記録があるなら、そのまま成功扱い
if ($existingPlanForDevice === 'middle' || $existingPlanForDevice === 'pro') {
    tlp_json_out([
        'ok'     => true,
        'plan'   => $existingPlanForDevice,
        'device' => $device,
        'code'   => $code,
        'via'    => 'already_linked',
    ]);
}

// 1ライセンスあたりの許可端末数（暫定）
$MAX_DEVICES = 3;

// このコードで既に紐づいている端末数
$currentDevices = count($devicesForCode);
if ($currentDevices >= $MAX_DEVICES) {
    tlp_json_out(['ok' => false, 'error' => 'device_limit']);
}

// ===== redeemed.csv に追記（このタイミングで初めて端末を紐づけ） =====
if (!is_file($LEDGER_CSV)) {
    $dir = dirname($LEDGER_CSV);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    @file_put_contents(
        $LEDGER_CSV,
        "time,action,device,plan,code,ip,meta_json\n",
        FILE_APPEND | LOCK_EX
    );
}

$meta = [
    'via' => 'redeem.php',
    'ua'  => $_SERVER['HTTP_USER_AGENT'] ?? '',
];

$line = sprintf(
    "%s,%s,%s,%s,%s,%s,%s",
    date('Y-m-d H:i:s'),
    'REDEEM',
    $device,
    $plan,
    $code,
    $ip,
    json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
);
@file_put_contents($LEDGER_CSV, $line . "\n", FILE_APPEND | LOCK_EX);

// 成功ログ
tlp_log_line(
    $LOG_FILE,
    sprintf(
        "%s\tOK\t%s\t%s\t%s",
        date('Y-m-d H:i:s'),
        $device,
        $ip,
        json_encode(['code' => $code, 'plan' => $plan], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    )
);

// レスポンス
tlp_json_out([
    'ok'     => true,
    'plan'   => $plan,
    'device' => $device,
    'code'   => $code,
]);
