<?php
return [
  // 後で /public_html/api/license/config.php を作って、ここを本値に。
  'hmac_secret' => 'CHANGE_ME_TO_RANDOM_32+_CHARS',
  // 許可Origin（必要に応じて追記）
  'allow_origins' => ['https://app.cafetabco.com'],
];
