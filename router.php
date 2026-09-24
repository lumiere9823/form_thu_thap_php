<?php

declare(strict_types=1);

$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$blocked = [
    '/.env',
    '/config.php',
    '/local-server.js',
    '/google-apps-script.js',
    '/package.json',
    '/package-lock.json',
    '/admin.html',
    '/api/_bootstrap.php',
];

if (str_contains($path, '..') || in_array(strtolower($path), $blocked, true)) {
    http_response_code(404);
    echo '404 Not Found';
    return true;
}

$routes = [
    '/' => '/index.php',
    '/api/submit' => '/api/submit.php',
    '/api/save-webhook' => '/api/save-webhook.php',
];
if (isset($routes[$path])) {
    require __DIR__ . $routes[$path];
    return true;
}

$file = realpath(__DIR__ . $path);
if ($file !== false && str_starts_with($file, __DIR__ . DIRECTORY_SEPARATOR) && is_file($file)) {
    return false;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo '404 Not Found';
return true;
