import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../server/api.js';

const date='2099-12-05';
class D1{
 constructor(){
  this.sql=new DatabaseSync(':memory:');
  this.sql.exec('PRAGMA foreign_keys=ON');
  for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())
   this.sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 }
 prepare(sql){
  let args=[];
  const self=this;
  return {
   bind(...values){args=values;return this},
   async all(){return {results:self.sql.prepare(sql).all(...args)}},
   async first(){return self.sql.prepare(sql).get(...args)??null},
   async run(){const result=self.sql.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}},
   execute(){if(/^\s*SELECT\b/i.test(sql))return {results:self.sql.prepare(sql).all(...args),meta:{changes:0}};const result=self.sql.prepare(sql).run(...args);return {results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
  };
 }
 async batch(statements){
  this.sql.exec('BEGIN IMMEDIATE');
  try{const results=statements.map(stmt=>stmt.execute());this.sql.exec('COMMIT');return results}
  catch(e){this.sql.exec('ROLLBACK');throw e}
 }
}
function setup(){
 const db=new D1();
 db.sql.exec("INSERT INTO tables(room_id,code,shape,seats,enabled) VALUES(1,'A1','square',2,1)");
 db.sql.exec(`UPDATE settings SET value=json_set(value,
 '$.seasonMode','winter',
 '$.firstFloorOverflowEnabled',json('true'),
 '$.firstFloorOverflowCapacity',7,
 '$.weekdays',json('[0,1,2,3,4,5,6]'),
 '$.maxDaysAhead',50000,
 '$.minNoticeMinutes',0) WHERE key='booking'`);
 const env={DB:db,PUBLIC_URL:'https://oasi.test'};
 let id=0;
 const request=async(route,method='GET',body)=>{
  const response=await onRequest({request:new Request('https://oasi.test/api/'+route,{method,headers:{Origin:'https://oasi.test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env});
  return {status:response.status,body:await response.json()};
 };
 const book=(party_size,changes={})=>request('book','POST',{date,time:'19:30',service:'dinner',party_size,name:'Cliente '+(++id),email:'guest'+id+'@example.com',phone:'3390000000',...changes});
 const available=(party_size=2)=>request('availability?date='+date+'&service=dinner&time=19:30&party_size='+party_size);
 return {db,env,request,book,available};
}
test('Inverno: piano terra prioritario, poi primo piano disattivato senza tavoli',async()=>{
 const t=setup();
 const first=await t.book(2);assert.equal(first.status,201,JSON.stringify(first.body));assert.equal(first.body.room_id,1);
 const avail=await t.available(4);assert.equal(avail.status,200);assert.equal(avail.body.available,true);assert.equal(avail.body.overflow,true);assert.deepEqual(avail.body.rooms.map(r=>r.id),[2]);
 const second=await t.book(4);assert.equal(second.status,201,JSON.stringify(second.body));assert.equal(second.body.room_id,2);assert.deepEqual(second.body.table_ids,[]);
 const row=t.db.sql.prepare('SELECT r.room_id,r.party_size,COUNT(rt.table_id) tables FROM reservations r LEFT JOIN reservation_tables rt ON rt.reservation_id=r.id WHERE r.id=?').get(second.body.id);
 assert.equal(row.room_id,2);assert.equal(row.tables,0);
 const third=await t.book(3);assert.equal(third.status,201,JSON.stringify(third.body));
 assert.equal(third.body.room_id,2);
 const full=await t.available(1);assert.equal(full.body.available,false);
});
test('Inverno: capacità reale, blocchi e cerimonie impediscono overbooking',async()=>{
 const t=setup();await t.book(2);await t.book(7);
 const over=await t.book(1);assert.notEqual(over.status,201);
 assert.equal(t.db.sql.prepare("SELECT COUNT(*) n FROM reservations WHERE room_id=2 AND status='confirmed'").get().n,1);
 const b=setup();await b.book(2);
 b.db.sql.prepare("INSERT INTO service_blocks(book_date,service,scope,target_id,reason,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)").run(date,'dinner','room',2,'Chiuso');
 assert.equal((await b.available(3)).body.available,false);
});
test('Estate: nessun overflow al primo piano; veranda disponibile solo se attiva',async()=>{
 const t=setup();
 t.db.sql.exec("UPDATE settings SET value=json_set(value,'$.seasonMode','summer') WHERE key='booking'");
 await t.book(2);
 assert.equal((await t.available(3)).body.available,false);
 t.db.sql.exec("INSERT INTO tables(room_id,code,shape,seats,enabled) VALUES(4,'V1','square',4,1); UPDATE rooms SET public_enabled=1 WHERE id=4");
 const open=await t.available(3);
 assert.equal(open.body.available,true);assert.deepEqual(open.body.rooms.map(r=>r.id),[4]);assert.equal(open.body.overflow,false);
});
test('Inverno: il primo piano è disattivabile dall\'ADMIN senza toccare i dati',async()=>{
 const t=setup();await t.book(2);
 t.db.sql.exec("UPDATE settings SET value=json_set(value,'$.firstFloorOverflowEnabled',json('false')) WHERE key='booking'");
 assert.equal((await t.available(3)).body.available,false);
});

test('ADMIN: modifica prenotazione al primo piano senza obbligare a scegliere un tavolo',async()=>{
 const t=setup();
 await t.book(2);const original=await t.book(4);
 assert.equal(original.status,201,JSON.stringify(original.body));
 const row=t.db.sql.prepare('SELECT * FROM reservations WHERE id=?').get(original.body.id);
 const response=await onRequest({request:new Request('https://oasi.test/api/admin/login',{
   method:'POST',headers:{Origin:'https://oasi.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.55'},
   body:JSON.stringify({password:'password-test'})
 }),env:{...t.env,ADMIN_PASSWORD:'password-test'}});
 assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];
 const fields=['book_date','service','time','party_size','name','phone','email','notes','room_id','status'];
 const expected={...Object.fromEntries(fields.map(key=>[key,row[key]])),table_ids:[]};
 const edit=await onRequest({request:new Request('https://oasi.test/api/admin/reservations/'+row.id,{
   method:'PATCH',headers:{Origin:'https://oasi.test','Content-Type':'application/json','Cookie':cookie},
   body:JSON.stringify({action:'edit_full',expected,table_ids:[],room_id:2,date,service:'dinner',time:'19:30',party_size:5,name:row.name,phone:row.phone,email:row.email,notes:row.notes})
 }),env:{...t.env,ADMIN_PASSWORD:'password-test'}});
 assert.equal(edit.status,200,await edit.text());
 const updated=t.db.sql.prepare('SELECT room_id,party_size FROM reservations WHERE id=?').get(row.id);
 assert.equal(updated.room_id,2);assert.equal(updated.party_size,5);
 assert.equal(t.db.sql.prepare('SELECT COUNT(*) n FROM reservation_tables WHERE reservation_id=?').get(row.id).n,0);
});
