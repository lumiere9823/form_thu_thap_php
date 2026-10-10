import { checkEventStatus } from './eventUtils.js';

// Tự động chuyển đổi link chia sẻ Google Drive sang link ảnh trực tiếp
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

const DEFAULT_BG_IMAGE_URL = 'https://lh3.googleusercontent.com/d/1Ler6x8p96gZ7T0eeX6oMQofbEWNEgEge';

// GET: Cung cấp URL ảnh nền và thời gian sự kiện cấu hình từ biến môi trường
export async function onRequestGet({ env }) {
  const rawBg = env?.BACKGROUND_IMAGE_URL || env?.BG_IMAGE_URL || DEFAULT_BG_IMAGE_URL;
  const event = checkEventStatus(env);

  return new Response(
    JSON.stringify({
      status: 'success',
      bgImageUrl: normalizeImageUrl(rawBg),
      event,
      debugKeys: Object.keys(env || {}),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
