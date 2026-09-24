# Web Thu Thập Thông Tin (100% Serverless — Cloudflare Pages & Google Sheets)

Hệ thống Landing Page thu thập dữ liệu khách hàng được thiết kế theo kiến trúc **100% Serverless**:
- **Hosting tĩnh:** Cloudflare Pages (Toàn cầu, miễn phí, siêu tốc độ).
- **Backend API & Proxy:** Cloudflare Pages Functions (Edge Workers - bảo vệ Webhook secret, chống spam rate-limit).
- **Cơ sở dữ liệu:** Google Sheets (thông qua Google Apps Script Web App).

---

## Cấu trúc thư mục dự án

```text
├── _headers                   # Cấu hình Security Headers chuẩn Cloudflare Pages
├── _redirects                 # Cấu hình chuyển hướng URL (/admin -> /admin.html)
├── .gitignore                 # Các tệp bỏ qua khi đẩy lên Git
├── admin.html                 # Giao diện quản trị webhook & ảnh nền
├── app.js                     # Xử lý form, validate, áp dụng ảnh nền động
├── functions/                 # Cloudflare Pages Functions (Serverless API)
│   └── api/
│       ├── submit.js          # API proxy gửi dữ liệu sang Google Apps Script
│       ├── config.js          # API cấu hình Webhook và Ảnh nền (hỗ trợ KV/env)
│       └── save-webhook.js    # Alias quản trị webhook
├── google-apps-script.js      # Mã nguồn triển khai trên Google Apps Script
├── index.html                 # Trang Landing Page chính
├── package.json               # Cấu hình chạy thử nghiệm cục bộ với Wrangler
└── styles.css                 # Giao diện CSS
```

---

## Hướng dẫn Deploy miễn phí lên Cloudflare Pages

### Bước 1: Đẩy mã nguồn lên GitHub / GitLab
Khởi tạo và đẩy code lên repository của bạn:
```bash
git add .
git commit -m "feat: migrate to 100% serverless cloudflare pages & dynamic background"
git push -u origin main
```

### Bước 2: Tạo dự án trên Cloudflare Pages
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Điều hướng tới **Workers & Pages** > **Create application** > chọn tab **Pages** > **Connect to Git**.
3. Chọn kho lưu trữ (repository) bạn vừa đẩy lên.
4. Cài đặt Build Settings:
   - **Framework preset:** `None`
   - **Build command:** *(Để trống)*
   - **Build output directory:** `.` *(hoặc để trống mặc định)*
5. Bấm **Save and Deploy**. Dự án sẽ được build và cấp tên miền `*.pages.dev` trong vòng chưa đầy 1 phút!

### Bước 3: Cấu hình Biến môi trường & Bảo mật
Toàn bộ cấu hình hệ thống được bảo mật tuyệt đối, **không có bất kỳ mật khẩu hay secret nào bị fix cứng trong mã nguồn**.

Trong dự án Cloudflare Pages vừa tạo:
1. Vào **Settings** > **Variables and Secrets** > bấm **Add variable** (trong mục Production):
   - `GOOGLE_SHEET_WEBHOOK_URL`: URL Web App của Google Apps Script (dạng `https://script.google.com/macros/s/.../exec`).
   - `GOOGLE_SHEET_SHARED_SECRET`: Chuỗi khóa bí mật đối soát trùng với `SHARED_SECRET` trong Google Apps Script.
   - `ADMIN_PASSWORD`: Mật khẩu bảo vệ trang `/admin` (Bắt buộc thiết lập, ví dụ: mật khẩu mạnh của bạn).
   - `BACKGROUND_IMAGE_URL`: *(Tùy chọn)* Đường dẫn URL ảnh nền (ví dụ link ảnh Imgur/Cloudinary/Unsplash). Nếu để trống, hệ thống sử dụng màu nền gradient tối mặc định.
2. Nhấn **Save**. Sau khi lưu biến môi trường, vào tab **Deployments** và bấm **Retry deployment** (hoặc tạo một commit mới) để biến có hiệu lực.

*(Tùy chọn nâng cao)*: Để có thể thay đổi Webhook URL, Secret và Ảnh nền trực tiếp từ giao diện trang `/admin` mà không cần vào Dashboard, bạn có thể tạo một KV Namespace (ví dụ đặt tên `CONFIG_KV`) trong Cloudflare Workers & Pages > KV, sau đó vào Pages > Settings > Functions > KV namespace bindings và liên kết biến `CONFIG_KV`. Khi đó, toàn bộ cấu hình sẽ được lưu tập trung vào cùng một KV database này!

---

## Chạy thử nghiệm ở máy cục bộ (Local Development)

Yêu cầu cài đặt Node.js. Chạy lệnh:

```bash
npx wrangler pages dev .
```

Mở trình duyệt truy cập:
- **Trang chủ form:** `http://localhost:8788`
- **Trang quản trị:** `http://localhost:8788/admin`
