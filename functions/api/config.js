async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, env) {
  if (!password || typeof password !== 'string') return false;

  // 1. Kiểm tra hash mật khẩu lưu trong Cloudflare KV (nếu admin từng đổi)
  if (env?.CONFIG_KV) {
    try {
      const kvHash = await env.CONFIG_KV.get('admin_password_hash');
      if (kvHash) {
        const inputHash = await hashPassword(password);
        return inputHash === kvHash.toLowerCase();
      }
    } catch (_) {}
  }

  // 2. Kiểm tra biến môi trường ADMIN_PASSWORD_HASH (SHA-256)
  if (env?.ADMIN_PASSWORD_HASH) {
    const inputHash = await hashPassword(password);
    return inputHash === env.ADMIN_PASSWORD_HASH.trim().toLowerCase();
  }

  // 3. Kiểm tra biến môi trường ADMIN_PASSWORD (chuỗi bí mật trên Dashboard)
  if (env?.ADMIN_PASSWORD) {
    return password === env.ADMIN_PASSWORD.trim();
  }

  // Tuyệt đối không fallback về mật khẩu mặc định (bảo vệ an toàn 100%)
  return false;
}

// Tự động chuyển đổi link chia sẻ Google Drive sang link ảnh trực tiếp
export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

// GET: Dành cho client công khai (chỉ lấy ảnh nền, tuyệt đối KHÔNG lộ Webhook URL hay Secret)
export async function onRequestGet({ env }) {
  let bgImageUrl = '';

  if (env?.CONFIG_KV) {
    try {
      const kvBg = await env.CONFIG_KV.get('background_image_url');
      if (kvBg !== null && kvBg !== undefined) bgImageUrl = kvBg;
    } catch (_) {}
  }

  if (!bgImageUrl && (env?.BACKGROUND_IMAGE_URL || env?.BG_IMAGE_URL)) {
    bgImageUrl = (env.BACKGROUND_IMAGE_URL || env.BG_IMAGE_URL).trim();
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      bgImageUrl: normalizeImageUrl(bgImageUrl),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

// POST: Dành cho Quản trị viên (bắt buộc xác thực mật khẩu an toàn)
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Dữ liệu JSON không hợp lệ.' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const isAuth = await verifyPassword(password, env);

  if (!isAuth) {
    const hasConfiguredPwd = Boolean(env?.ADMIN_PASSWORD || env?.ADMIN_PASSWORD_HASH);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: hasConfiguredPwd
          ? 'Mật khẩu quản trị không chính xác.'
          : 'Hệ thống chưa được thiết lập biến môi trường ADMIN_PASSWORD trên Cloudflare Pages.'
      }),
      { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // Hành động 1: Lấy thông tin cấu hình hiện tại (chỉ admin có mật khẩu mới xem được)
  if (body.action === 'get_status') {
    let webhookUrl = '';
    let bgImageUrl = '';
    let hasKV = Boolean(env?.CONFIG_KV);

    if (env?.CONFIG_KV) {
      try {
        webhookUrl = (await env.CONFIG_KV.get('google_sheet_webhook_url')) || '';
        bgImageUrl = (await env.CONFIG_KV.get('background_image_url')) || '';
      } catch (_) {}
    }
    if (!webhookUrl && env?.GOOGLE_SHEET_WEBHOOK_URL) {
      webhookUrl = env.GOOGLE_SHEET_WEBHOOK_URL.trim();
    }
    if (!bgImageUrl && (env?.BACKGROUND_IMAGE_URL || env?.BG_IMAGE_URL)) {
      bgImageUrl = (env.BACKGROUND_IMAGE_URL || env.BG_IMAGE_URL).trim();
    }

    const maskedWebhook = webhookUrl.length > 45
      ? webhookUrl.slice(0, 36) + '...' + webhookUrl.slice(-10)
      : (webhookUrl || 'Chưa thiết lập');

    return new Response(
      JSON.stringify({
        status: 'success',
        activeWebhookUrl: maskedWebhook,
        bgImageUrl: bgImageUrl,
        kvEnabled: hasKV,
      }),
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // Hành động 2: Lưu cấu hình (Webhook URL, Ảnh nền, Secret)
  const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'URL Webhook Google Apps Script không hợp lệ (phải là https://script.google.com/.../exec).' }),
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    } catch (_) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'URL Webhook không đúng định dạng.' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }
  }

  const rawBg = typeof body.bgImageUrl === 'string' ? body.bgImageUrl.trim() : '';
  const bgImageUrl = normalizeImageUrl(rawBg);
  if (bgImageUrl && !bgImageUrl.startsWith('http://') && !bgImageUrl.startsWith('https://') && !bgImageUrl.startsWith('data:image/')) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Đường dẫn ảnh nền phải bắt đầu bằng https://, http:// hoặc để trống.' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const sharedSecret = typeof body.sharedSecret === 'string' ? body.sharedSecret.trim() : '';

  // Lưu vào Cloudflare KV (Nơi lưu trữ cấu hình tập trung an toàn)
  if (env?.CONFIG_KV) {
    try {
      if (webhookUrl) {
        await env.CONFIG_KV.put('google_sheet_webhook_url', webhookUrl);
      }
      if (typeof body.bgImageUrl === 'string') {
        await env.CONFIG_KV.put('background_image_url', bgImageUrl);
      }
      if (sharedSecret) {
        await env.CONFIG_KV.put('google_sheet_shared_secret', sharedSecret);
      }
      return new Response(
        JSON.stringify({ status: 'success', message: 'Đã lưu toàn bộ cấu hình Webhook và Ảnh nền an toàn vào Cloudflare KV!' }),
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Lỗi ghi Cloudflare KV: ' + e.message }),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      message: 'Xác thực mật khẩu hợp lệ! Lưu ý: Để lưu trữ cấu hình động trên Cloudflare Pages, bạn có thể tạo và liên kết KV Namespace (CONFIG_KV), hoặc cấu hình trực tiếp các biến môi trường trong Cloudflare Dashboard.'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
