import {onRequest} from './api.js';
import {sendDueReminders} from './phase2.js';
export default {
 async fetch(request,env,ctx){
  if(new URL(request.url).pathname.startsWith('/api/'))return onRequest({request,env,waitUntil:p=>ctx.waitUntil(p)});
  return env.ASSETS.fetch(request);
 },
 async scheduled(event,env,ctx){ctx.waitUntil(sendDueReminders(env))}
};
