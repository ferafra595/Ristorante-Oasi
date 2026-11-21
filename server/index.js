import {onRequest} from './api.js';
import {sendDueReminders} from './phase2.js';
import {enhancePageResponse} from './seo.js';
export default {
 async fetch(request,env,ctx){
  if(new URL(request.url).pathname.startsWith('/api/'))return onRequest({request,env,waitUntil:p=>ctx.waitUntil(p)});
  return enhancePageResponse(request,await env.ASSETS.fetch(request));
 },
 async scheduled(event,env,ctx){ctx.waitUntil(sendDueReminders(env))}
};
