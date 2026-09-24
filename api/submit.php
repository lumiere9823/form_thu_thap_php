<?php

declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

require_post();

if (rate_limit_exceeded('submit', client_ip(), 8, 10 * 60)) {
    json_response(['status' => 'error', 'message' => 'Bạn gửi quá nhiều lần, vui lòng thử lại sau.'], 429);
}

$webhookUrl = config_value('google_sheet_webhook_url');
if ($webhookUrl === '' || !valid_google_webhook($webhookUrl)) {
    json_response(['status' => 'error', 'message' => 'Máy chủ chưa được cấu hình webhook hợp lệ.'], 500);
}

$payload = read_json_body();
$allowedFields = [
    'fullName',
    'phone',
    'address',
    'facebookName',
    'luckyNumber',
    'memberType',
    'submittedAt',
    'device',
];
$fields = [];
foreach ($allowedFields as $field) {
    $value = $payload[$field] ?? '';
    if (is_array($value) || is_object($value)) {
        $value = '';
    }
    $fields[$field] = mb_substr((string) $value, 0, 500);
}

$sharedSecret = config_value('google_sheet_shared_secret');
if ($sharedSecret !== '') {
    $fields['secret'] = $sharedSecret;
}

try {
    json_response(post_to_webhook($webhookUrl, $fields));
} catch (DomainException $error) {
    json_response(['status' => 'error', 'message' => $error->getMessage()], 400);
} catch (Throwable $error) {
    error_log('Submit proxy error: ' . $error->getMessage());
    json_response(['status' => 'error', 'message' => 'Không thể kết nối đến máy chủ lưu dữ liệu.'], 502);
}
