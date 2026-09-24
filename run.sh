#!/usr/bin/env bash
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_BIND_HOST="${APP_BIND_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-8088}"

cd "$APP_DIR"

if ! command -v php >/dev/null 2>&1; then
    echo "Error: PHP was not found in PATH." >&2
    exit 1
fi

echo "Form:  http://${APP_BIND_HOST}:${APP_PORT}"
echo "Admin: http://${APP_BIND_HOST}:${APP_PORT}/admin.php"
exec php -S "${APP_BIND_HOST}:${APP_PORT}" router.php
