import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../server/api.js';
// SQLite adapter with the relevant D1 prepare/bind/all/first/run/batch behavior.
// Runs the real API handlers, with synchronous SQLite transactions for batch rollback.
// Does not emulate Cloudflare latency, quotas, or distributed infrastructure.
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');this.beforeBatch=null;this.failAt=null;}
 prepare(q){let args=[];const self=this;const prepared={q,bind(...a){args=a;return prepared},async all(){return {success:true,results:self.sql.prepare(q).all(...args)}},async first(){return self.sql.prepare(q).get(...args)??null},async run(){return prepared.execute()},execute(){const stmt=self.sql.prepare(q);if(/^\s*(SELECT|PRAGMA)\b/i.test(q))return {success:true,results:stmt.all(...args),meta:{changes:0}};const res=stmt.run(...args);return {success:true,results:[],meta:{changes:Number(res.changes),last_row_id:Number(res.lastInsertRowid)}}}};return prepared;}
 async batch(stmts){if(this.beforeBatch){const hook=this.beforeBatch;if(hook(stmts,this))this.beforeBatch=null;}this.sql.exec('BEGIN IMMEDIATE');try{const results=stmts.map((s,i)=>{if(this.failAt&&this.failAt(stmts,i)){this.failAt=null;throw Error('Injected batch exception')}return s.execute()});this.sql.exec('COMMIT');return results}catch(e){this.sql.exec('ROLLBACK');throw e}}
}
const migrationFiles=readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort();
const date='2099-12-01';
async function setup({migration=true}={}){
 const db=new D1();for(const name of migrationFiles){if(!migration&&name.startsWith('0011'))continue;db.sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));}
 db.sql.exec("INSERT INTO tables(id,room_id,code,seats,x,y,w,h,enabled) VALUES (1,1,'1',8,10,10,80,80,1),(2,1,'2',8,100,10,80,80,1),(3,1,'3',4,200,10,80,80,1),(4,2,'4',8,10,10,80,80,1),(5,1,'5',8,300,10,80,80,0),(6,1,'6',2,400,10,80,80,1); INSERT INTO table_details(table_id,min_seats,module_count) VALUES(1,4,1),(2,4,1),(3,1,1),(4,1,1),(5,1,1),(6,1,1); INSERT INTO table_links VALUES(1,2); INSERT INTO room_zones(room_id,label,x,y,w,h) VALUES(1,'Sala',0,0,600,400);");
 const objects=new Map();const MEDIA={async head(k){return objects.get(k)||null},async get(k){return objects.get(k)||null},async put(k,b){objects.set(k,{body:b,size:b.byteLength,uploaded:new Date(),httpMetadata:{contentType:'application/pdf'}})}};const env={MEDIA,DB:db,ADMIN_PASSWORD:'test-only-password',PUBLIC_URL:'https://oasi.test'};let cookie='';
 const call=async(path,method='GET',body,auth=true)=>{const headers={'Origin':'https://oasi.test','Sec-Fetch-Site':'same-origin','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'};if(auth&&cookie)headers.Cookie=cookie;const r=await onRequest({request:new Request('https://oasi.test/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined}),env});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 const login=await call('admin/login','POST',{password:env.ADMIN_PASSWORD});assert.equal(login.status,200,JSON.stringify(login.body));cookie=login.cookie.split(';')[0];
 const book=(table_ids=[1],party_size=5,extra={})=>call('admin/reservations','POST',{date,time:'12:30',service:'lunch',name:'Cliente test',phone:'0000000000',email:'test@example.invalid',party_size,table_ids,...extra});
 const move=(id,table_ids)=>call('admin/reservations/'+id,'PATCH',{table_ids});
 const cancel=id=>call('admin/reservations/'+id,'PATCH',{status:'cancelled'});
 const block=(scope,target_id,service='lunch')=>call('admin/blocks','POST',{date,service,scope,target_id,reason:'Test'});
 const event=(room_ids=[1],service='lunch',extra={})=>call('admin/events','POST',{title:'Cerimonia test',contact_name:'Referente',phone:'0000000000',start_date:date,end_date:date,service,status:'confirmed',room_ids,...extra});
 const rows=()=>db.sql.prepare('SELECT * FROM reservations ORDER BY id').all();
 const assigned=id=>db.sql.prepare('SELECT table_id FROM reservation_tables WHERE reservation_id=? ORDER BY table_id').all(id).map(x=>x.table_id);
 return {db,call,book,move,cancel,block,event,rows,assigned,env,cookie};
}

const upload=(x,content,name='menu.pdf',auth=true)=>{const f=new FormData();f.append('file',new Blob([content],{type:'application/pdf'}),name);return onRequest({env:x.env,request:new Request('https://oasi.test/api/admin/menu-pdf',{method:'POST',body:f,headers:{Origin:'https://oasi.test',...(auth?{Cookie:x.cookie}:{})}})});};
const get=(x,q='')=>onRequest({env:x.env,request:new Request('https://oasi.test/api/menu-pdf'+q)});
test('unpublished menu is unavailable',async()=>{const x=await setup();assert.equal((await get(x)).status,404);assert.equal((await x.call('public')).body.menuPdf,false)});
test('upload requires login and rejects invalid PDF',async()=>{const x=await setup();assert.equal((await upload(x,'%PDF-1.4 test','menu.pdf',false)).status,401);assert.equal((await upload(x,'not a pdf')).status,400);assert.equal((await get(x)).status,404)});
test('publish, replace, download and preserve on rejected upload',async()=>{const x=await setup();assert.equal((await upload(x,'%PDF-1.4 first')).status,200);assert.equal((await x.call('public')).body.menuPdf,true);assert.equal((await x.call('admin/menu-pdf')).body.available,true);assert.equal(await (await get(x)).text(),'%PDF-1.4 first');assert.equal((await upload(x,'%PDF-1.4 second')).status,200);assert.equal((await upload(x,'broken')).status,400);const r=await get(x,'?download=1');assert.equal(await r.text(),'%PDF-1.4 second');assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-disposition'),/^attachment/);assert.equal((await x.call('media/restaurant-menu.pdf')).status,404)});
test('independent image fields persist via real settings API without touching menu or FAQs',async()=>{const x=await setup();const before=(await x.call('admin/settings')).body.site;const updated={...before,heroImage:'/api/media/hero.png',homeStoryImage:'/api/media/home.png',storyImage:'/api/media/story.png',bookingImage:'/api/media/booking.png',eventWeddingImage:'/api/media/wedding.png',logoMain:'/api/media/logo.png',faqs:[{question:'Test',answer:'Test'}]};assert.equal((await x.call('admin/settings/site','PUT',updated,false)).status,401);assert.equal((await x.call('admin/settings/site','PUT',updated)).status,200);const published=(await x.call('public')).body;for(const k of ['heroImage','homeStoryImage','storyImage','bookingImage','eventWeddingImage','logoMain','faqs'])assert.deepEqual(published.site[k],updated[k]);assert.equal((await x.call('admin/settings/site','PUT',{...updated,homeStoryImage:''})).status,200);assert.equal((await x.call('public')).body.site.homeStoryImage,'');assert.equal((await x.call('public')).body.site.storyImage,updated.storyImage);assert.equal(published.menuPdf,false)});
