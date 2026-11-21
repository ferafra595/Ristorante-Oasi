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
 db.sql.exec("INSERT INTO tables(id,room_id,code,seats,x,y,w,h,enabled) VALUES (1,1,'1',8,10,10,80,80,1),(2,1,'2',8,10,110,80,80,1),(3,1,'3',4,200,10,80,80,1),(4,2,'4',8,10,10,80,80,1),(5,1,'5',8,300,10,80,80,0),(6,1,'6',2,400,10,80,80,1); INSERT INTO table_details(table_id,min_seats,module_count) VALUES(1,4,1),(2,4,1),(3,1,1),(4,1,1),(5,1,1),(6,1,1); INSERT INTO table_links VALUES(1,2); INSERT INTO room_zones(room_id,label,x,y,w,h) VALUES(1,'Sala',0,0,600,400);");
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
test('migration 0011 is idempotent; cannot mutate critical data without migration',async()=>{const x=await setup({migration:false});assert.equal((await x.book()).status,503);const sql=readFileSync(new URL('../migrations/0011_integrita_operativa.sql',import.meta.url),'utf8');x.db.sql.exec(sql);x.db.sql.exec(sql);ok(await x.book(),201)});
test('atomic creation: failure after header leaves no reservation or table',async()=>{const x=await setup();x.db.failAt=(stmts,i)=>isBookingBatch(stmts)&&i===1;rejected(await x.book());assert.equal(x.rows().length,0);assert.equal(x.db.sql.prepare('SELECT COUNT(*) n FROM reservation_tables').get().n,0)});
test('two concurrent requests for the same table: exactly one succeeds',async()=>{const x=await setup();const r=await Promise.all([x.book(),x.book()]);assert.equal(r.filter(x=>x.status===201).length,1);assert.equal(x.rows().length,1);assert.deepEqual(x.assigned(x.rows()[0].id),[1]);});
test('manual multi-table 12 people, 1 reservation, 2 links; rejects duplicates and insufficient capacity',async()=>{const x=await setup();rejected(await x.book([1,1],8));rejected(await x.book([3],5));const r=await x.book([1,2],12);ok(r,201);assert.deepEqual(x.assigned(r.body.id),[1,2]);assert.equal(x.rows().length,1);rejected(await x.book([2],5));});
test('banchetto condiviso: più gruppi di tavoli sotto una sola prenotazione, senza bloccare gli altri',async()=>{
 const x=await setup();
 rejected(await x.book([1,2,3],18));
 const result=await x.book([1,2,3],18,{banquet_shared:true});
 ok(result,201);
 assert.deepEqual(x.assigned(result.body.id),[1,2,3]);
 assert.equal(x.rows()[0].source,'staff_banquet');
 rejected(await x.book([2],5));
 ok(await x.book([6],2),201);
 assert.equal(x.rows().length,2);
});
test('banchetto condiviso: nove tavoli distinti in una prenotazione, senza ampliare il limite normale',async()=>{
 const x=await setup();
 for(let id=30;id<39;id++)x.db.sql.prepare('INSERT INTO tables(id,room_id,code,seats,x,y,w,h,enabled) VALUES(?,1,?,4,10,10,70,70,1)').run(id,String(id));
 const ids=Array.from({length:9},(_,i)=>i+30);
 rejected(await x.book(ids,27));
 const booking=await x.book(ids,27,{banquet_shared:true});
 ok(booking,201);
 assert.deepEqual(x.assigned(booking.body.id),ids);
 ok(await x.book([6],2),201);
});
test('banchetto condiviso: rifiuta tavoli di sale diverse, occupati o insufficienti',async()=>{
 const x=await setup();
 rejected(await x.book([1,4],12,{banquet_shared:true}));
 rejected(await x.book([1,3],20,{banquet_shared:true}));
 ok(await x.book([1,3],9,{banquet_shared:true}),201);
 rejected(await x.book([1,2],12,{banquet_shared:true}));
});
test('blocks for table, room, service; same date dinner unaffected',async()=>{const x=await setup();ok(await x.block('table',1));rejected(await x.book());ok(await x.block('room',2));rejected(await x.book([4]));ok(await x.block('service',0));rejected(await x.book([3],2));ok(await x.book([1],5,{service:'dinner',time:'19:30'}),201);});
test('manual block inserted between validation and transaction still prevents booking',async()=>{const x=await setup();x.db.beforeBatch=(stmts,db)=>{if(!isBookingBatch(stmts))return false;db.sql.prepare("INSERT INTO service_blocks(book_date,service,scope,target_id,reason,created_at) VALUES(?,'lunch','table',1,'Race',CURRENT_TIMESTAMP)").run(date);return true};rejected(await x.book());assert.equal(x.rows().length,0)});
test('disabled room cannot be selected explicitly; disabled tables excluded',async()=>{const x=await setup();x.db.sql.exec('UPDATE rooms SET internal_enabled=0 WHERE id=2');rejected(await x.book([4],5,{room_id:2}));rejected(await x.book([5],5));assert.equal(x.rows().length,0)});
test('capacity shrink inserted after validation is rejected and fully rolled back',async()=>{const x=await setup();x.db.beforeBatch=(stmts,db)=>{if(!isBookingBatch(stmts))return false;db.sql.exec('UPDATE tables SET seats=4 WHERE id=1');return true};rejected(await x.book());assert.equal(x.rows().length,0)});
test('move: disabled, blocked, too-small, occupied, cross-room and duplicate tables rejected; original intact',async()=>{const x=await setup();const a=await x.book();ok(a,201);const id=a.body.id;ok(await x.book([2],5),201);ok(await x.block('table',4));for(const list of [[2],[3],[4],[5],[1,1],[1,4]]){rejected(await x.move(id,list));assert.deepEqual(x.assigned(id),[1]);} const r=await x.move(id,[1]);ok(r);assert.deepEqual(x.assigned(id),[1])});
test('move: valid cross-room reassignment and failure mid-batch preserve original',async()=>{const x=await setup();const a=await x.book();ok(a,201);const id=a.body.id; x.db.failAt=(stmts,i)=>stmts[0].q.startsWith('DELETE FROM reservation_tables')&&i===2;rejected(await x.move(id,[4]));assert.deepEqual(x.assigned(id),[1]);assert.equal(x.rows()[0].room_id,1);ok(await x.move(id,[4]));assert.deepEqual(x.assigned(id),[4]);assert.equal(x.rows()[0].room_id,2)});
test('move of cancelled reservation rejected, including illegal status change in SQL',async()=>{const x=await setup();const r=await x.book();ok(r,201);ok(await x.cancel(r.body.id));rejected(await x.move(r.body.id,[2]));assert.equal(x.rows()[0].status,'cancelled');assert.deepEqual(x.assigned(r.body.id),[]);assert.throws(()=>x.db.sql.exec("UPDATE reservations SET status='confirmed'"),/oasi_cancelled_booking/)});
test('event vs booking: event first, booking first, both services and release on cancel',async()=>{const x=await setup();const e=await x.event([1],'both');ok(e,201);rejected(await x.book());rejected(await x.book([1],5,{service:'dinner',time:'19:30'}));ok(await x.call('admin/events/'+e.body.id,'DELETE'));ok(await x.book(),201);rejected(await x.event([1]));});
test('simultaneous event and booking cannot overlap; no partial event or reservation',async()=>{const x=await setup();const results=await Promise.all([x.event([1]),x.book()]);assert.equal(results.filter(r=>r.status===201).length,1);const eventCount=x.db.sql.prepare("SELECT COUNT(*) n FROM oasi_private_events WHERE status<>'cancelled'").get().n;assert.equal(eventCount+x.rows().length,1);});
test('legacy event missing materialized slots still prevents another event and booking',async()=>{const x=await setup();ok(await x.event([1]),201);x.db.sql.exec('DELETE FROM oasi_event_room_slots');rejected(await x.event([1]));rejected(await x.book());});
test('large multi-day event uses one atomic bounded batch; cancellation releases all slots',async()=>{const x=await setup();const e=await x.event([1,2,3,4],'both',{end_date:'2100-01-30'});ok(e,201);assert.equal(e.body.blocked_slots,488);ok(await x.call('admin/events/'+e.body.id,'DELETE'));assert.equal(x.db.sql.prepare('SELECT COUNT(*) n FROM oasi_event_room_slots').get().n,0)});
test('restore geometry succeeds with confirmed booking, conflicting standard restores nothing',async()=>{const x=await setup();ok(await x.call('admin/floor-template','PUT',{room_id:1}));x.db.sql.exec('UPDATE tables SET x=42 WHERE id=1');const r=await x.book();ok(r,201);ok(await x.call('admin/floor-template','POST',{room_id:1}));assert.equal(x.db.sql.prepare('SELECT x FROM tables WHERE id=1').get().x,10);assert.deepEqual(x.assigned(r.body.id),[1]);const tpl=JSON.parse(x.db.sql.prepare('SELECT data FROM floor_plan_templates WHERE room_id=1').get().data);tpl.tables.find(t=>t.id===1).seats=3;tpl.tables.find(t=>t.id===2).x=999; x.db.sql.prepare('UPDATE floor_plan_templates SET data=? WHERE room_id=1').run(JSON.stringify(tpl));rejected(await x.call('admin/floor-template','POST',{room_id:1}));assert.equal(x.db.sql.prepare('SELECT x FROM tables WHERE id=2').get().x,10);assert.equal(x.db.sql.prepare('SELECT seats FROM tables WHERE id=1').get().seats,8);assert.deepEqual(x.assigned(r.body.id),[1]);});
test('floor restore transaction rolls back on failure after table updates',async()=>{const x=await setup();ok(await x.call('admin/floor-template','PUT',{room_id:1}));x.db.sql.exec('UPDATE tables SET x=44 WHERE id=1');x.db.failAt=(stmts,i)=>stmts[0].q.includes('WITH snapshot')&&i===7;rejected(await x.call('admin/floor-template','POST',{room_id:1}));assert.equal(x.db.sql.prepare('SELECT x FROM tables WHERE id=1').get().x,44);assert.equal(x.db.sql.prepare('SELECT COUNT(*) n FROM room_zones').get().n,1);});
test('reserved table config protected, public and admin API auth preserved, operations includes event/block/zone snapshot',async()=>{const x=await setup();ok(await x.book(),201);assert.throws(()=>x.db.sql.exec('UPDATE tables SET enabled=0 WHERE id=1'),/oasi_reserved_table_configuration/);assert.throws(()=>x.db.sql.exec('UPDATE table_details SET min_seats=7 WHERE table_id=1'),/oasi_reserved_table_configuration/);ok(await x.block('table',3));ok(await x.event([2]),201);const r=await x.call('admin/operations?date='+date+'&service=lunch');ok(r);assert.equal(r.body.blocks.length,2);assert.equal(r.body.zones.length,1);assert.equal((await x.call('admin/operations?date='+date,'GET',undefined,false)).status,401);});
test('public booking path, public-only room admission, no email configured; customer and notification preserved',async()=>{const x=await setup();const d=new Date();d.setUTCDate(d.getUTCDate()+7);const day=d.toISOString().slice(0,10);const cfg=JSON.parse(x.db.sql.prepare("SELECT value FROM settings WHERE key='booking'").get().value);cfg.weekdays=[0,1,2,3,4,5,6];cfg.closedDates=[];x.db.sql.prepare("UPDATE settings SET value=? WHERE key='booking'").run(JSON.stringify(cfg));const r=await x.call('book','POST',{date:day,time:'12:30',service:'lunch',party_size:2,name:'Web test',phone:'0000000000',email:'web@example.invalid'},false);ok(r,201);assert.equal(r.body.room_id,1);assert.equal(r.body.email_status,'unconfigured');assert.equal(x.db.sql.prepare('SELECT COUNT(*) n FROM oasi_customer_reservations').get().n,1);assert.equal(x.db.sql.prepare('SELECT COUNT(*) n FROM oasi_staff_notifications').get().n,1);});


test('online cancellation keeps booked tables after service starts and releases only expected reservations',async()=>{
 const x=await setup();
 const a=await x.book([1],5);ok(a,201);
 const token=new URL(a.body.cancel_url).searchParams.get('token');assert.ok(token);
 ok(await x.call('admin/visits/'+a.body.id,'PATCH',{state:'seated'}));
 const blocked=await x.call('cancel','POST',{token},false);assert.equal(blocked.status,409,JSON.stringify(blocked.body));
 assert.deepEqual(x.assigned(a.body.id),[1]);assert.equal(x.rows().find(r=>r.id===a.body.id).status,'confirmed');
 const b=await x.book([2],5);ok(b,201);
 const token2=new URL(b.body.cancel_url).searchParams.get('token');assert.ok(token2);
 ok(await x.call('cancel','POST',{token:token2},false));
 assert.deepEqual(x.assigned(b.body.id),[]);assert.equal(x.rows().find(r=>r.id===b.body.id).status,'cancelled');
});


test('ADMIN table suggestions are ranked, authenticated and exclude blocked tables',async()=>{
 const x=await setup();
 const endpoint='admin/suggestions?date='+date+'&service=lunch&party_size=2';
 const unauthorized=await x.call(endpoint,'GET',undefined,false);
 assert.equal(unauthorized.status,401);
 const initial=await x.call(endpoint);
 ok(initial);
 assert.ok(initial.body.options.length);
 assert.deepEqual(initial.body.options[0].table_ids,[6]);
 ok(await x.block('table',6));
 const afterBlock=await x.call(endpoint);
 ok(afterBlock);
 assert.ok(afterBlock.body.options.every(c=>!c.table_ids.includes(6)));
 assert.deepEqual(afterBlock.body.options[0].table_ids,[3]);
 const saved=await x.book([3],2);
 ok(saved,201);
 const afterBooking=await x.call(endpoint);
 ok(afterBooking);
 assert.ok(afterBooking.body.options.every(c=>!c.table_ids.includes(3)));
});
test('ADMIN table suggestions preserve validations for date, service and party size',async()=>{
 const x=await setup();
 for(const query of ['date=garbage&service=lunch&party_size=2','date='+date+'&service=all&party_size=2','date='+date+'&service=lunch&party_size=201']){
  const response=await x.call('admin/suggestions?'+query);
  assert.equal(response.status,400);
 }
});


test('service arrival progression never releases or duplicates booked tables',async()=>{
 const x=await setup();
 const reservation=await x.book([1],5);
 ok(reservation,201);
 const id=reservation.body.id;
 for(const state of ['arrived','seated','finished']){
  ok(await x.call('admin/visits/'+id,'PATCH',{state}));
  const row=x.db.sql.prepare('SELECT state FROM service_visits WHERE reservation_id=?').get(id);
  assert.equal(row.state,state);
  assert.deepEqual(x.assigned(id),[1]);
  assert.equal(x.rows().find(r=>r.id===id).status,'confirmed');
 }
 ok(await x.call('admin/visits/'+id,'PATCH',{state:'expected'}));
 assert.deepEqual(x.assigned(id),[1]);
});

test('concorrenza: banchetto condiviso e prenotazione normale non possono occupare lo stesso tavolo',async()=>{
 const x=await setup();
 const [banquet,normal]=await Promise.all([
  x.book([1,2,3],18,{banquet_shared:true}),
  x.book([2],5)
 ]);
 assert.equal([banquet,normal].filter(r=>r.status===201).length,1);
 assert.equal(x.rows().length,1);
 const occupied=x.db.sql.prepare('SELECT COUNT(*) n FROM reservation_tables WHERE table_id=2 AND book_date=? AND service=?').get(date,'lunch');
 assert.equal(occupied.n,1);
});
test('un banchetto annullato libera esattamente i tavoli assegnati, senza toccare le altre prenotazioni',async()=>{
 const x=await setup();
 const banquet=await x.book([1,2,3],18,{banquet_shared:true});ok(banquet,201);
 const ordinary=await x.book([6],2);ok(ordinary,201);
 ok(await x.cancel(banquet.body.id));
 assert.deepEqual(x.assigned(banquet.body.id),[]);
 assert.deepEqual(x.assigned(ordinary.body.id),[6]);
 ok(await x.book([1,2],12),201);
});
test('i blocchi di sala e tavolo si applicano anche ai banchetti condivisi',async()=>{
 const x=await setup();
 ok(await x.block('table',2));
 rejected(await x.book([1,2,3],18,{banquet_shared:true}));
 assert.equal(x.rows().length,0);
 ok(await x.block('room',1));
 rejected(await x.book([1,3],9,{banquet_shared:true}));
 assert.equal(x.rows().length,0);
});
test('banchetto a pranzo non impedisce l\'utilizzo degli stessi tavoli a cena',async()=>{
 const x=await setup();
 const lunch=await x.book([1,2,3],18,{banquet_shared:true});ok(lunch,201);
 const dinner=await x.book([1,2,3],18,{banquet_shared:true,service:'dinner',time:'19:30'});ok(dinner,201);
 assert.equal(x.rows().length,2);
 assert.deepEqual(x.assigned(lunch.body.id),[1,2,3]);
 assert.deepEqual(x.assigned(dinner.body.id),[1,2,3]);
});
