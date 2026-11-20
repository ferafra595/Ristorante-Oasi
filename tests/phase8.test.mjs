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
 const env={DB:db,ADMIN_PASSWORD:'test-only-password',PUBLIC_URL:'https://oasi.test'};let cookie='';
 const call=async(path,method='GET',body,auth=true)=>{const headers={'Origin':'https://oasi.test','Sec-Fetch-Site':'same-origin','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'};if(auth&&cookie)headers.Cookie=cookie;const r=await onRequest({request:new Request('https://oasi.test/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined}),env});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 const login=await call('admin/login','POST',{password:env.ADMIN_PASSWORD});assert.equal(login.status,200,JSON.stringify(login.body));cookie=login.cookie.split(';')[0];
 const book=(table_ids=[1],party_size=5,extra={})=>call('admin/reservations','POST',{date,time:'12:30',service:'lunch',name:'Cliente test',phone:'0000000000',email:'test@example.invalid',party_size,table_ids,...extra});
 const move=(id,table_ids)=>call('admin/reservations/'+id,'PATCH',{table_ids});
 const cancel=id=>call('admin/reservations/'+id,'PATCH',{status:'cancelled'});
 const block=(scope,target_id,service='lunch')=>call('admin/blocks','POST',{date,service,scope,target_id,reason:'Test'});
 const event=(room_ids=[1],service='lunch',extra={})=>call('admin/events','POST',{title:'Cerimonia test',contact_name:'Referente',phone:'0000000000',start_date:date,end_date:date,service,status:'confirmed',room_ids,...extra});
 const rows=()=>db.sql.prepare('SELECT * FROM reservations ORDER BY id').all();
 const assigned=id=>db.sql.prepare('SELECT table_id FROM reservation_tables WHERE reservation_id=? ORDER BY table_id').all(id).map(x=>x.table_id);
 return {db,call,book,move,cancel,block,event,rows,assigned};
}
const ok=(r,code=200)=>assert.equal(r.status,code,JSON.stringify(r.body));
const rejected=r=>assert.ok(r.status>=400,JSON.stringify(r.body));
const isBookingBatch=stmts=>stmts.some(x=>x.q.startsWith('INSERT INTO reservations('));

const calendar=(x,start=date,end=date,auth=true)=>x.call('admin/calendar?'+new URLSearchParams({start,end}),'GET',undefined,auth);
test('calendar requires admin session and validates date ranges',async()=>{const x=await setup();assert.equal((await calendar(x,date,date,false)).status,401);for(const [a,b] of [['2099-02-30','2099-03-03'],['2099-12-02',date],['2099-01-01',date]])assert.equal((await calendar(x,a,b)).status,400);ok(await calendar(x,'2099-11-01','2099-12-12'));});
test('calendar aggregates confirmed covers and cancellations correctly, without customer PII',async()=>{const x=await setup();const a=await x.book([1],5);ok(a,201);const b=await x.book([2],6);ok(b,201);ok(await x.cancel(b.body.id));ok(await x.book([1],5,{service:'dinner',time:'19:30'}),201);const r=await calendar(x);ok(r);assert.equal(r.body.reservations.length,3);assert.equal(r.body.reservations.find(z=>z.service==='lunch'&&z.status==='confirmed').covers,5);assert.equal(r.body.reservations.find(z=>z.status==='cancelled').bookings,1);assert.ok(!JSON.stringify(r.body).includes('test@example.invalid'));});
test('calendar overlaps multi-day events, excludes cancelled events and preserves manual blocks',async()=>{const x=await setup();const e=await x.event([2],'both',{start_date:'2099-11-30',end_date:'2099-12-03'});ok(e,201);ok(await x.block('table',3));const r=await calendar(x);ok(r);assert.equal(r.body.events.length,1);assert.equal(r.body.events[0].service,'both');assert.equal(r.body.blocks.length,1);assert.equal(r.body.blocks[0].target_name,'3');ok(await x.call('admin/events/'+e.body.id,'DELETE',{}));assert.equal((await calendar(x)).body.events.length,0);});
test('calendar returns weekday, exceptional closure and disabled service configuration',async()=>{const x=await setup();const cfg=JSON.parse(x.db.sql.prepare("SELECT value FROM settings WHERE key='booking'").get().value);cfg.closedDates=[date,'2100-01-01'];cfg.dinner.enabled=false;x.db.sql.prepare("UPDATE settings SET value=? WHERE key='booking'").run(JSON.stringify(cfg));const r=await calendar(x);ok(r);assert.deepEqual(r.body.closedDates,[date]);assert.equal(r.body.serviceEnabled.dinner,false);assert.deepEqual(r.body.weekdays,cfg.weekdays);});

test('selected day details match range, exclude contact fields and retain booking states',async()=>{const x=await setup();ok(await x.book(),201);const r=await x.call('admin/calendar?start=2099-11-30&end=2099-12-02&selected='+date);ok(r);assert.equal(r.body.details.length,1);assert.equal(r.body.details[0].name,'Cliente test');assert.equal(r.body.details[0].table_codes,'1');assert.equal(r.body.details[0].email,undefined);assert.equal((await x.call('admin/calendar?start=2099-11-30&end=2099-12-02&selected=2099-12-03')).status,400);});
