# Web Thu Thập Thông Tin (100% Serverless — Cloudflare Workers & Google Sheets)

Hệ thống Landing Page thu thập dữ liệu khách hàng được thiết kế theo kiến trúc **100% Serverless**:
- **Hosting tĩnh & CDN:** Cloudflare Workers Static Assets (Toàn cầu, miễn phí, siêu tốc độ).
- **Backend API & Proxy:** Cloudflare Workers (Edge runtime - bảo vệ Webhook secret, chống spam rate-limit).
- **Cơ sở dữ liệu:** Google Sheets (thông qua Google Apps Script Web App).

---

## Cấu trúc thư mục dự án (Tối giản & Chuẩn Cloudflare)

```text
├── .gitignore                 # Bỏ qua các tệp môi trường bí mật (.env, .dev.vars)
├── functions/                 # API Handlers
│   └── api/
│       ├── submit.js          # API proxy gửi dữ liệu sang Google Apps Script
│       └── config.js          # API cung cấp URL ảnh nền cấu hình từ biến môi trường
├── google-apps-script.js      # Mã nguồn triển khai trên Google Apps Script
├── package.json               # Cấu hình dự án (hỗ trợ npm run dev)
├── public/                    # Thư mục chứa toàn bộ tài nguyên tĩnh (HTML, CSS, JS)
│   ├── _headers               # Cấu hình Security Headers chuẩn Cloudflare
│   ├── app.js                 # Xử lý form, validate, áp dụng ảnh nền động
│   ├── index.html             # Trang Landing Page chính
│   └── styles.css             # Giao diện CSS
├── worker.js                  # Worker Entrypoint điều phối API & Assets
└── wrangler.jsonc             # Cấu hình Cloudflare Worker & Assets
```

---

## Cấu hình Biến môi trường (Environment Variables)

Trong Cloudflare Dashboard (dự án `formthongtin`):
1. Vào **Settings** > **Variables and Secrets** > bấm **Add variable**:
   - `GOOGLE_SHEET_WEBHOOK_URL`: URL Web App của Google Apps Script (dạng `https://script.google.com/macros/s/.../exec`).
   - `GOOGLE_SHEET_SHARED_SECRET`: Chuỗi khóa bí mật đối soát (nếu có dùng).
   - `BACKGROUND_IMAGE_URL`: *(Tùy chọn)* Link ảnh nền trực tiếp hoặc link Google Drive (hệ thống tự động chuyển đổi sang CDN Google). Nếu để trống, hệ thống sử dụng màu nền gradient tối mặc định.
2. Nhấn **Save**.

---

## Chạy thử nghiệm ở máy cục bộ (Local Development)

Yêu cầu cài đặt Node.js. Chạy lệnh:

```bash
npm run dev
```
*(hoặc `npx wrangler dev`)*

Mở trình duyệt truy cập:
- **Trang chủ form:** `http://localhost:8787`
