import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=readFileSync(new URL('../server/api.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const config=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const worker=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
const mail=readFileSync(new URL('../server/phase2.js',import.meta.url),'utf8');

test('Il controllo di consegna richiede la sessione ADMIN',()=>{
 const auth=api.indexOf("const user=await currentUser(db,ctx.request)");
 const route=api.indexOf("if(resource==='readiness'&&method==='GET')");
 assert.ok(auth>0&&route>auth);
 assert.ok(api.slice(auth,route).includes("return fail('Accesso richiesto',401)"));
 assert.ok(!api.slice(route,route+1500).includes('RESEND_API_KEY:'));
});
test('Lo stato segnala configurazione email, R2, schema D1 e backup non verificato',()=>{
 for(const field of ['database_ready','media_bucket_configured','email_configured','tables_enabled','rooms_enabled','email_failed_or_unconfigured','scheduled_reminders','backup'])
  assert.ok(api.includes(field),field);
 assert.ok(ui.includes("api('admin/readiness')"));
 assert.ok(ui.includes('oasi-readiness-panel'));
});
test('I cron invocano il Worker due volte per gestire ora solare e legale',()=>{
 assert.match(config,/\[triggers\][\s\S]*crons\s*=\s*\["0 15,16 \* \* \*"\]/);
 assert.ok(worker.includes('async scheduled(event,env,ctx)'));
 assert.ok(worker.includes('sendDueReminders(env)'));
 assert.ok(mail.includes("if(hour<17||hour>17)return"));
});
