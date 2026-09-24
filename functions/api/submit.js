// Rate limiting cache (in-memory per Cloudflare edge worker instance)
const rateLimits = new Map();

function isRateLimited(ip, maxRequests = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (record.count >= maxRequests) {
    return true;
  }
  record.count += 1;
  return false;
}

export async function onRequestPost({ request, env }) {
  // 1. Rate limiting by IP
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  if (isRateLimited(clientIp, 8, 10 * 60 * 1000)) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Bạn gửi quá nhiều lần, vui lòng thử lại sau.' }),
      { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // 2. Resolve Webhook URL & Secret strictly from KV or Environment Variables (ZERO hardcoded values)
  let webhookUrl = '';
  if (env?.CONFIG_KV) {
    try {
      webhookUrl = (await env.CONFIG_KV.get('google_sheet_webhook_url')) || '';
    } catch (_) {}
  }
  if (!webhookUrl && env?.GOOGLE_SHEET_WEBHOOK_URL) {
    webhookUrl = env.GOOGLE_SHEET_WEBHOOK_URL.trim();
  }
  if (!webhookUrl && env?.GOOGLE_SHEET_WEBHOOK) {
    webhookUrl = env.GOOGLE_SHEET_WEBHOOK.trim();
  }

  if (!webhookUrl) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Hệ thống chưa được cấu hình Webhook URL. Vui lòng thiết lập biến GOOGLE_SHEET_WEBHOOK_URL trong Cloudflare Settings > Variables and Secrets.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  let sharedSecret = '';
  if (env?.CONFIG_KV) {
    try {
      sharedSecret = (await env.CONFIG_KV.get('google_sheet_shared_secret')) || '';
    } catch (_) {}
  }
  if (!sharedSecret && env?.GOOGLE_SHEET_SHARED_SECRET) {
    sharedSecret = env.GOOGLE_SHEET_SHARED_SECRET.trim();
  }
  if (!sharedSecret && env?.GOOGLE_SHEET_SHARED_S) {
    sharedSecret = env.GOOGLE_SHEET_SHARED_S.trim();
  }

  // Validate webhook URL format
  try {
    const parsed = new URL(webhookUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Đường dẫn Webhook Google Apps Script cấu hình không hợp lệ.' }),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }
  } catch (_) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Đường dẫn Webhook Google Apps Script không đúng định dạng.' }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // 3. Read JSON payload
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Dữ liệu JSON không hợp lệ.' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // 4. Sanitize and filter fields
  const allowedFields = [
    'fullName',
    'phone',
    'address',
    'facebookName',
    'luckyNumber',
    'memberType',
    'submittedAt',
    'device',
  ];

  const params = new URLSearchParams();
  for (const field of allowedFields) {
    let val = payload[field] ?? '';
    if (typeof val !== 'string') val = String(val || '');
    val = val.slice(0, 500).trim();
    params.set(field, val);
  }

  if (sharedSecret) {
    params.set('secret', sharedSecret);
  }

  // 5. Forward to Google Apps Script
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const gasResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'User-Agent': 'WebThuThap-Cloudflare/1.0',
      },
      body: params,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    const gasText = await gasResponse.text();
    let result;
    try {
      result = JSON.parse(gasText);
    } catch (_) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Webhook Google Sheet trả về dữ liệu không hợp lệ.' }),
        { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (result.status === 'error' || result.status === 'closed' || result.status === 'busy') {
      return new Response(
        JSON.stringify({ status: 'error', message: result.message || 'Không thể lưu thông tin.' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return new Response(
      JSON.stringify({
        status: 'error',
        message: isTimeout
          ? 'Quá thời gian kết nối tới máy chủ lưu dữ liệu.'
          : 'Không thể kết nối đến máy chủ lưu dữ liệu.'
      }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

export async function onRequestGet() {
  return new Response(
    JSON.stringify({ status: 'error', message: 'Phương thức không được hỗ trợ.' }),
    { status: 405, headers: { 'Allow': 'POST', 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
