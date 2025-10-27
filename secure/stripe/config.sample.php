<?php
return [
  'stripe' => [
    'secret_key'     => 'SK_LIVE_PLACEHOLDER',
    'webhook_secret' => 'WHSEC_PLACEHOLDER',
  ],
  'email' => [
    'to'   => 'orders@example.com',
    'from' => 'no-reply@example.com',
  ],
  'storage_path' => __DIR__ . '/storage',
];
