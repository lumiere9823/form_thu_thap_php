<?php

declare(strict_types=1);

const APP_ROOT = __DIR__ . '/..';
const CONFIG_FILE = APP_ROOT . '/config.php';
const MAX_REQUEST_BYTES = 4096;

function load_app_config(): array
{
    if (!is_file(CONFIG_FILE) || !is_readable(CONFIG_FILE)) {
        return [];
    }

    $config = require CONFIG_FILE;
    return is_array($config) ? $config : [];
}

function config_value(string $key): string
{
    $value = $GLOBALS['APP_CONFIG'][$key] ?? '';
    return is_string($value) ? trim($value) : '';
}

function apply_security_headers(): void
{
    header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self' 'unsafe-inline'; connect-src 'self' https://script.google.com https://script.googleusercontent.com");
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
}

function json_response(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        header('Allow: POST');
        json_response(['status' => 'error', 'message' => 'Phương thức không được hỗ trợ.'], 405);
    }
}

function read_json_body(): array
{
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > MAX_REQUEST_BYTES) {
        json_response(['status' => 'error', 'message' => 'Dữ liệu gửi lên quá lớn.'], 413);
    }

    $raw = file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
    if ($raw === false || strlen($raw) > MAX_REQUEST_BYTES) {
        json_response(['status' => 'error', 'message' => 'Dữ liệu gửi lên quá lớn.'], 413);
    }

    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_response(['status' => 'error', 'message' => 'Dữ liệu JSON không hợp lệ.'], 400);
    }

    if (!is_array($data)) {
        json_response(['status' => 'error', 'message' => 'Dữ liệu gửi lên không hợp lệ.'], 400);
    }

    return $data;
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/**
 * Uses a small locked file in the system temp directory, so limits also work
 * across PHP requests and worker processes.
 */
function rate_limit_exceeded(
    string $bucket,
    string $identity,
    int $limit,
    int $windowSeconds,
    bool $recordAttempt = true
): bool
{
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
        . 'web_thu_thap_' . preg_replace('/[^a-z0-9_-]/i', '', $bucket) . '.json';
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        return false;
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            return false;
        }

        $raw = stream_get_contents($handle);
        $entries = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        if (!is_array($entries)) {
            $entries = [];
        }

        $now = time();
        foreach ($entries as $key => $entry) {
            if (!is_array($entry) || $now - (int) ($entry['started'] ?? 0) >= $windowSeconds) {
                unset($entries[$key]);
            }
        }

        $key = hash('sha256', $identity);
        $entry = $entries[$key] ?? ['count' => 0, 'started' => $now];
        $exceeded = (int) $entry['count'] >= $limit;
        if (!$exceeded && $recordAttempt) {
            $entry['count'] = (int) $entry['count'] + 1;
            $entries[$key] = $entry;
        }

        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($entries));
        fflush($handle);
        flock($handle, LOCK_UN);
        return $exceeded;
    } finally {
        fclose($handle);
    }
}

function clear_rate_limit(string $bucket, string $identity): void
{
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
        . 'web_thu_thap_' . preg_replace('/[^a-z0-9_-]/i', '', $bucket) . '.json';
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        return;
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            return;
        }
        $raw = stream_get_contents($handle);
        $entries = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        if (!is_array($entries)) {
            $entries = [];
        }
        unset($entries[hash('sha256', $identity)]);
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($entries));
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
}

function valid_google_webhook(string $url): bool
{
    $parts = parse_url($url);
    return is_array($parts)
        && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
        && strtolower((string) ($parts['host'] ?? '')) === 'script.google.com'
        && str_ends_with((string) ($parts['path'] ?? ''), '/exec');
}

function resolve_ca_bundle(): string
{
    $opensslLocations = function_exists('openssl_get_cert_locations')
        ? openssl_get_cert_locations()
        : [];
    $programFiles = getenv('ProgramFiles');
    $candidates = [
        ini_get('curl.cainfo'),
        ini_get('openssl.cafile'),
        $opensslLocations['default_cert_file'] ?? '',
        '/etc/ssl/certs/ca-certificates.crt',
        '/etc/pki/tls/certs/ca-bundle.crt',
        '/etc/ssl/ca-bundle.pem',
        dirname(PHP_BINARY) . '/extras/ssl/cacert.pem',
        'C:/laragon/etc/ssl/cacert.pem',
        is_string($programFiles) ? $programFiles . '/Git/mingw64/etc/ssl/certs/ca-bundle.crt' : '',
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && $candidate !== '' && is_file($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }

    return '';
}

function post_to_webhook(string $url, array $fields): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL chưa được bật trên máy chủ.');
    }

    $responseBody = '';
    $curl = curl_init($url);
    $options = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'WebThuThap-PHP/1.0',
        CURLOPT_WRITEFUNCTION => static function ($curlHandle, string $chunk) use (&$responseBody): int {
            if (strlen($responseBody) + strlen($chunk) > 1024 * 1024) {
                return 0;
            }
            $responseBody .= $chunk;
            return strlen($chunk);
        },
    ];
    $caBundle = resolve_ca_bundle();
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }
    curl_setopt_array($curl, $options);

    try {
        $ok = curl_exec($curl);
        if ($ok === false) {
            throw new RuntimeException(curl_error($curl));
        }
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    } finally {
        curl_close($curl);
    }

    try {
        $result = json_decode($responseBody, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new RuntimeException('Webhook trả về dữ liệu không hợp lệ.');
    }

    if (!is_array($result)) {
        throw new RuntimeException('Webhook trả về dữ liệu không hợp lệ.');
    }
    if ($status < 200 || $status >= 300 || ($result['status'] ?? '') === 'error') {
        $message = is_string($result['message'] ?? null) ? $result['message'] : 'Không thể lưu thông tin.';
        throw new DomainException($message);
    }

    return $result;
}

function verify_admin_password(string $password): bool
{
    $stored = config_value('admin_password_hash');
    if ($stored === '' || $password === '') {
        return false;
    }

    // PHP password_hash formats (Argon2id/bcrypt) are supported for new setups.
    if ((password_get_info($stored)['algoName'] ?? 'unknown') !== 'unknown') {
        return password_verify($password, $stored);
    }

    // Backward compatibility with the former Node crypto.scryptSync salt:hex format.
    [$salt, $hex] = array_pad(explode(':', $stored, 2), 2, '');
    if (!function_exists('sodium_crypto_pwhash_scryptsalsa208sha256')
        || strlen($salt) !== SODIUM_CRYPTO_PWHASH_SCRYPTSALSA208SHA256_SALTBYTES
        || $hex === ''
        || !ctype_xdigit($hex)
        || strlen($hex) % 2 !== 0) {
        return false;
    }

    $expected = hex2bin($hex);
    if ($expected === false) {
        return false;
    }

    try {
        $actual = sodium_crypto_pwhash_scryptsalsa208sha256(
            strlen($expected),
            $password,
            $salt,
            SODIUM_CRYPTO_PWHASH_SCRYPTSALSA208SHA256_OPSLIMIT_INTERACTIVE,
            SODIUM_CRYPTO_PWHASH_SCRYPTSALSA208SHA256_MEMLIMIT_INTERACTIVE
        );
    } catch (Throwable) {
        return false;
    }

    return hash_equals($expected, $actual);
}

function save_config_value(string $key, string $value): bool
{
    $handle = fopen(CONFIG_FILE, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        return false;
    }

    try {
        $config = $GLOBALS['APP_CONFIG'];
        $config[$key] = $value;
        $contents = "<?php\n\ndeclare(strict_types=1);\n\n"
            . "// Keep this file private: it contains credentials used by the application.\n"
            . 'return ' . var_export($config, true) . ";\n";

        rewind($handle);
        ftruncate($handle, 0);
        $written = fwrite($handle, $contents);
        fflush($handle);
        if ($written !== false) {
            $GLOBALS['APP_CONFIG'] = $config;
        }
        return $written !== false;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

$GLOBALS['APP_CONFIG'] = load_app_config();
apply_security_headers();
