import {onRequest} from './api.js';
export default {async fetch(request,env,ctx){if(new URL(request.url).pathname.startsWith('/api/'))return onRequest({request,env,waitUntil:p=>ctx.waitUntil(p)});return env.ASSETS.fetch(request)}};
