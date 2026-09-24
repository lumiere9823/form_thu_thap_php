# Form thu thập dữ liệu — PHP

Ứng dụng yêu cầu PHP 8.1+ với các extension `curl`, `mbstring` và `sodium`.

## Chạy local

Chạy `run.bat`, sau đó mở:

- Form: <http://127.0.0.1:8088>
- Quản trị webhook: <http://127.0.0.1:8088/admin.php>

Hoặc chạy trực tiếp:

```powershell
php -S 127.0.0.1:8088 router.php
```

Trên Linux, chạy:

```bash
chmod +x run.sh
./run.sh
```

Mặc định máy chủ chỉ nghe trên `127.0.0.1:8088`. Có thể đổi bằng:

```bash
APP_BIND_HOST=0.0.0.0 APP_PORT=8088 ./run.sh
```

## Cấu hình

Các giá trị được khai báo trực tiếp trong `config.php`:

```php
return [
    'google_sheet_webhook_url' => 'https://script.google.com/macros/s/.../exec',
    'google_sheet_shared_secret' => '...',
    'admin_password_hash' => '...',
];
```

`admin_password_hash` hiện tại từ phiên bản Node.js vẫn dùng được. Với cài đặt mới,
có thể tạo chuỗi băm PHP bằng:

```powershell
php -r "echo password_hash('MAT_KHAU_MOI', PASSWORD_ARGON2ID), PHP_EOL;"
```

Khi triển khai Apache/cPanel, đặt toàn bộ mã nguồn trong thư mục website và đảm bảo
PHP có quyền ghi `config.php` nếu cần đổi webhook từ trang quản trị. `.htaccess` đã cấu hình
trang mặc định, HTTPS, route API và chặn truy cập các tệp nhạy cảm.

Ví dụ cấp quyền trên Linux (thay `www-data` bằng user chạy Apache/PHP-FPM của máy chủ):

```bash
sudo chown root:www-data config.php
sudo chmod 660 config.php
```

Không dùng `php -S` làm máy chủ production. Với production, trỏ document root của
Apache/Nginx vào thư mục này; Apache sẽ dùng `.htaccess`. Nếu dùng Nginx, phải chặn
truy cập trực tiếp tới `config.php`, `api/_bootstrap.php`, `router.php` và `admin.html`.
