<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

require_post();

$clientIp = client_ip();
if (rate_limit_exceeded('admin_login', $clientIp, 5, 15 * 60, false)) {
    json_response(['status' => 'error', 'message' => 'Quá nhiều lần thử, vui lòng thử lại sau 15 phút.'], 429);
}

$data = read_json_body();
$password = is_string($data['password'] ?? null) ? $data['password'] : '';
if (!verify_admin_password($password)) {
    rate_limit_exceeded('admin_login', $clientIp, 5, 15 * 60);
    json_response(['status' => 'error', 'message' => 'Mật khẩu không chính xác.'], 401);
}
clear_rate_limit('admin_login', $clientIp);

$webhookUrl = is_string($data['webhookUrl'] ?? null) ? trim($data['webhookUrl']) : '';
if (!valid_google_webhook($webhookUrl)) {
    json_response(['status' => 'error', 'message' => 'URL webhook không hợp lệ.'], 400);
}

if (!save_config_value('google_sheet_webhook_url', $webhookUrl)) {
    json_response(['status' => 'error', 'message' => 'Không thể ghi tệp config.php.'], 500);
}

json_response(['status' => 'success', 'message' => 'Đã lưu webhook vào config.php.']);
