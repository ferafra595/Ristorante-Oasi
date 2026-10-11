import {onRequest} from './api.js';
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return onRequest({request, env, waitUntil: promise => ctx.waitUntil(promise)});
    }
    if (!env.ASSETS) return new Response('Asset frontend non configurati', {status:503});
    return env.ASSETS.fetch(request);
  }
};
