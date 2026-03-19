<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'empty_body'], JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
    exit;
}

function pick(array $src, string $key, int $max = 2000): string {
    $value = $src[$key] ?? '';
    if (is_array($value) || is_object($value)) {
        $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    $value = trim((string)$value);
    if ($max > 0 && mb_strlen($value, 'UTF-8') > $max) {
        $value = mb_substr($value, 0, $max, 'UTF-8');
    }
    return $value;
}

function valOrDash(string $value): string {
    return $value !== '' ? $value : '-';
}

$reportId = date('Ymd-His') . '-' . bin2hex(random_bytes(3));
$to = 'support@cafetabco.com';

$fields = [
    'report_id'     => $reportId,
    'received_at'   => date('c'),
    'remote_addr'   => (string)($_SERVER['REMOTE_ADDR'] ?? ''),
    'page'          => pick($payload, 'page', 255),
    'sku'           => pick($payload, 'sku', 255),
    'href'          => pick($payload, 'href', 2000),
    'referrer'      => pick($payload, 'referrer', 2000),
    'channel'       => pick($payload, 'channel', 255),
    'title'         => pick($payload, 'title', 255),
    'price_text'    => pick($payload, 'price_text', 255),
    'dg_status'     => pick($payload, 'dg_status', 255),
    'owned_status'  => pick($payload, 'owned_status', 255),
    'status_text'   => pick($payload, 'status_text', 1000),
    'error_name'    => pick($payload, 'error_name', 255),
    'error_message' => pick($payload, 'error_message', 4000),
    'error_stack'   => pick($payload, 'error_stack', 12000),
    'user_agent'    => pick($payload, 'user_agent', 2000),
    'language'      => pick($payload, 'language', 255),
    'platform'      => pick($payload, 'platform', 255),
    'timestamp'     => pick($payload, 'timestamp', 255),
    'timezone'      => pick($payload, 'timezone', 255),
    'user_note'     => pick($payload, 'user_note', 4000),
];

$subjectText = sprintf('[TLP] Play購入エラー報告 %s / %s / %s',
    $reportId,
    $fields['title'] !== '' ? $fields['title'] : '商品名なし',
    $fields['error_name'] !== '' ? $fields['error_name'] : 'エラー名なし'
);
$subject = mb_encode_mimeheader($subjectText, 'UTF-8', 'B', "\r\n");

$summary = [];
$summary[] = 'Tabco Ledger Plus の Play購入エラー報告です。';
$summary[] = '';
$summary[] = '【要約】';
$summary[] = 'レポートID: ' . valOrDash($fields['report_id']);
$summary[] = '受信日時: ' . valOrDash($fields['received_at']);
$summary[] = 'ページ: ' . valOrDash($fields['page']);
$summary[] = '商品: ' . valOrDash($fields['title']);
$summary[] = 'SKU: ' . valOrDash($fields['sku']);
$summary[] = '表示価格: ' . valOrDash($fields['price_text']);
$summary[] = 'エラー名: ' . valOrDash($fields['error_name']);
$summary[] = 'エラー内容: ' . valOrDash($fields['error_message']);
$summary[] = '状態メモ: ' . valOrDash($fields['status_text']);
$summary[] = '購入情報の取得: ' . valOrDash($fields['dg_status']);
$summary[] = '所有状態: ' . valOrDash($fields['owned_status']);
$summary[] = '';
$summary[] = '【購入者メモ】';
$summary[] = valOrDash($fields['user_note']);
$summary[] = '';
$summary[] = '【アクセス情報】';
$summary[] = 'URL: ' . valOrDash($fields['href']);
$summary[] = '参照元: ' . valOrDash($fields['referrer']);
$summary[] = 'チャネル: ' . valOrDash($fields['channel']);
$summary[] = 'IP: ' . valOrDash($fields['remote_addr']);
$summary[] = '';
$summary[] = '【端末情報】';
$summary[] = 'ユーザーエージェント: ' . valOrDash($fields['user_agent']);
$summary[] = '言語: ' . valOrDash($fields['language']);
$summary[] = 'プラットフォーム: ' . valOrDash($fields['platform']);
$summary[] = '端末タイムゾーン: ' . valOrDash($fields['timezone']);
$summary[] = '端末タイムスタンプ: ' . valOrDash($fields['timestamp']);
$summary[] = '';
$summary[] = '【詳細スタック】';
$summary[] = valOrDash($fields['error_stack']);
$bodyPlain = implode("\n", $summary);
$body = chunk_split(base64_encode($bodyPlain));

$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0775, true);
}
$logPath = $logDir . '/purchase_issue_reports.log';
@file_put_contents(
    $logPath,
    json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
    FILE_APPEND | LOCK_EX
);

$headers = [];
$headers[] = 'From: TLP Support <support@cafetabco.com>';
$headers[] = 'Reply-To: support@cafetabco.com';
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headers[] = 'Content-Transfer-Encoding: base64';
$headerText = implode("\r\n", $headers);

$sent = @mail($to, $subject, $body, $headerText);
if (!$sent) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'mail_send_failed',
        'report_id' => $reportId,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'ok' => true,
    'report_id' => $reportId,
], JSON_UNESCAPED_UNICODE);
