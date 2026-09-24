# Web Thu Thập Thông Tin (100% Serverless — Cloudflare Pages & Google Sheets)

Hệ thống Landing Page thu thập dữ liệu khách hàng được thiết kế theo kiến trúc **100% Serverless**:
- **Hosting tĩnh:** Cloudflare Pages (Toàn cầu, miễn phí, siêu tốc độ).
- **Backend API & Proxy:** Cloudflare Pages Functions (Edge Workers - bảo vệ Webhook secret, chống spam rate-limit).
- **Cơ sở dữ liệu:** Google Sheets (thông qua Google Apps Script Web App).

---

## Cấu trúc thư mục dự án (Tối giản & Bảo mật)

```text
├── _headers                   # Cấu hình Security Headers chuẩn Cloudflare Pages
├── .gitignore                 # Bỏ qua các tệp môi trường bí mật (.env, .dev.vars)
├── app.js                     # Xử lý form, validate, áp dụng ảnh nền động
├── functions/                 # Cloudflare Pages Functions (Serverless API)
│   └── api/
│       ├── submit.js          # API proxy gửi dữ liệu sang Google Apps Script
│       └── config.js          # API cung cấp URL ảnh nền cấu hình từ biến môi trường
├── google-apps-script.js      # Mã nguồn triển khai trên Google Apps Script
├── index.html                 # Trang Landing Page chính
├── package.json               # Cấu hình chạy thử nghiệm cục bộ với Wrangler
└── styles.css                 # Giao diện CSS
```

---

## Hướng dẫn Deploy miễn phí lên Cloudflare Pages

### Bước 1: Đẩy mã nguồn lên GitHub
```bash
git add .
git commit -m "feat: pure serverless lead capture for cloudflare pages"
git push origin main
```

### Bước 2: Tạo dự án trên Cloudflare Pages
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Điều hướng tới **Workers & Pages** > **Create application** > chọn tab **Pages** > **Connect to Git**.
3. Chọn kho lưu trữ `form_thu_thap_php`.
4. Cài đặt Build Settings:
   - **Framework preset:** `None`
   - **Build command:** *(Để trống)*
   - **Build output directory:** `.` *(hoặc để trống)*
5. Bấm **Save and Deploy**. Dự án sẽ được cấp tên miền `*.pages.dev` trong vòng chưa đầy 1 phút!

### Bước 3: Cấu hình Biến môi trường (Environment Variables)
Trong dự án Cloudflare Pages vừa tạo:
1. Vào **Settings** > **Variables and Secrets** > bấm **Add variable** (trong mục Production):
   - `GOOGLE_SHEET_WEBHOOK_URL`: URL Web App của Google Apps Script (dạng `https://script.google.com/macros/s/.../exec`).
   - `GOOGLE_SHEET_SHARED_SECRET`: Chuỗi khóa bí mật đối soát (nếu có dùng).
   - `BACKGROUND_IMAGE_URL`: *(Tùy chọn)* Link ảnh nền trực tiếp hoặc link Google Drive (hệ thống tự động nhận diện và chuyển đổi sang CDN Google). Nếu để trống, hệ thống sử dụng màu nền gradient tối mặc định.
2. Nhấn **Save**. Sau khi lưu biến môi trường, vào tab **Deployments** và bấm **Retry deployment** (hoặc tạo một commit mới) để biến có hiệu lực.

---

## Chạy thử nghiệm ở máy cục bộ (Local Development)

Yêu cầu cài đặt Node.js. Chạy lệnh:

```bash
npx wrangler pages dev .
```

Mở trình duyệt truy cập:
- **Trang chủ form:** `http://localhost:8788`
