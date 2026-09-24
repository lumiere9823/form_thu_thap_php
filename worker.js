import { onRequestPost as submitPost } from './functions/api/submit.js';
import { onRequestGet as configGet } from './functions/api/config.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route: API Submit Form
    if (url.pathname === '/api/submit' || url.pathname === '/api/submit/') {
      if (request.method === 'POST') {
        return submitPost({ request, env, ctx });
      }
      return new Response(
        JSON.stringify({ status: 'error', message: 'Phương thức không được hỗ trợ.' }),
        { status: 405, headers: { 'Allow': 'POST', 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Route: API Config (Background Image)
    if (url.pathname === '/api/config' || url.pathname === '/api/config/') {
      return configGet({ request, env, ctx });
    }

    // Phục vụ file tĩnh (HTML, CSS, JS) qua Cloudflare Assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
