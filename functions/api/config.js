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

// Phân giải chế độ màu chữ: "dark" (chữ tối cho nền sáng) hoặc "light" (chữ sáng cho nền tối)
function resolveTextTheme(env) {
  const textTheme = String(env?.TEXT_THEME || env?.TEXT_COLOR_MODE || env?.TEXT_MODE || '').toLowerCase().trim();
  if (textTheme === 'dark' || textTheme === 'black' || textTheme === 'toi') {
    return 'dark';
  }
  if (textTheme === 'light' || textTheme === 'white' || textTheme === 'sang') {
    return 'light';
  }

  // Hỗ trợ THEME_MODE hoặc THEME (Light mode = nền sáng -> chữ tối; Dark mode = nền tối -> chữ sáng)
  const themeMode = String(env?.THEME_MODE || env?.THEME || '').toLowerCase().trim();
  if (themeMode === 'light' || themeMode === 'sang') {
    return 'dark'; // nền sáng => chữ màu tối
  }
  if (themeMode === 'dark' || themeMode === 'toi') {
    return 'light'; // nền tối => chữ màu sáng
  }

  return 'light';
}

const DEFAULT_BG_IMAGE_URL = 'https://lh3.googleusercontent.com/d/1Ler6x8p96gZ7T0eeX6oMQofbEWNEgEge';

// GET: Cung cấp URL ảnh nền, thời gian sự kiện và theme màu chữ cấu hình từ biến môi trường
export async function onRequestGet({ env }) {
  const rawBg = env?.BACKGROUND_IMAGE_URL || env?.BG_IMAGE_URL || DEFAULT_BG_IMAGE_URL;
  const event = checkEventStatus(env);
  const textTheme = resolveTextTheme(env);

  return new Response(
    JSON.stringify({
      status: 'success',
      bgImageUrl: normalizeImageUrl(rawBg),
      textTheme,
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
