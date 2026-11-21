import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=src.indexOf('const svgRoom=(room,tables,zones,structures,items,links=[])=>');
const stop=src.indexOf(' const buildPage=',start);
const geo=src.indexOf('const oasiNearbyTable=');
const geoEnd=src.indexOf('const oasiLinkedComponent=',geo);
assert.ok(start>=0&&stop>start&&geo>=0&&geoEnd>geo);
const prepare=[
 'const cleanNumber=n=>Number.isFinite(Number(n))?Number(n):0;',
 'const rect=r=>({x:cleanNumber(r.x),y:cleanNumber(r.y),w:Math.max(1,cleanNumber(r.w)),h:Math.max(1,cleanNumber(r.h))});',
 'const boxOf=(rects,padding=16)=>{const rs=rects.length?rects:[{x:0,y:0,w:1100,h:700}];const x=Math.min(...rs.map(r=>r.x))-padding,y=Math.min(...rs.map(r=>r.y))-padding;const xmax=Math.max(...rs.map(r=>r.x+r.w))+padding,ymax=Math.max(...rs.map(r=>r.y+r.h))+padding;return {x,y,w:xmax-x,h:ymax-y}};',
 "const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');",
 "const unionOutline=()=>'';",
 src.slice(geo,geoEnd),
 src.slice(start,stop),
 'return svgRoom;'
].join('\n');
const svgRoom=new Function(prepare)();
const t=(id,x,y,w=64,h=70)=>({id,room_id:1,code:String(id),shape:'square',x,y,w,h,enabled:1,rotation:0});
const tables=[t(4,650,100),t(2,650,185),t(3,520,100,64,55),t(5,520,170,64,80),t(6,520,265,64,75),t(9,100,100)];
const links=[{table_a:4,table_b:2},{table_a:3,table_b:5},{table_a:5,table_b:6},{table_a:5,table_b:4}];
const reservation=(id,ids,party,name,time)=>({id,room_id:1,table_ids:ids.join(','),party_size:party,name,time,status:'confirmed'});

test('La stampa unisce verticalmente 4+2 e 3+5+6 senza linee diagonali',()=>{
 const bookings=[reservation(20,[4,2],12,'Cliente Gruppo','21:00'),reservation(22,[3,5,6],19,'Cliente Banchetto','21:30')];
 const plan=svgRoom({id:1,name:'Sala piano terra'},tables,[],[],bookings,links).svg;
 assert.equal((plan.match(/class="print-joined-bridge"/g)||[]).length,3);
 assert.equal((plan.match(/>P1</g)||[]).length,2);
 assert.equal((plan.match(/>P2</g)||[]).length,3);
 assert.ok(!plan.includes('Cliente Gruppo'));
 assert.ok(!plan.includes('Cliente Banchetto'));
 assert.ok(!plan.includes('12 persone'));
});
test('Non unisce tavoli collegati ma assegnati a clienti diversi',()=>{
 const bookings=[reservation(20,[4],2,'Persona A','19:30'),reservation(21,[2],2,'Persona B','19:30')];
 const plan=svgRoom({id:1,name:'Sala'},tables,[],[],bookings,links).svg;
 assert.equal((plan.match(/class="print-joined-bridge"/g)||[]).length,0);
});
test('Tabelle e riferimenti P1/P2 integrati nello stesso documento di stampa',()=>{
 const body=src.slice(src.indexOf('function printOasiReservations('),src.indexOf('async function openCustomerCard('));
 assert.ok(body.includes('listTable(roomBookings,true)'));
 assert.ok(body.includes('class="print-group-key"'));
 assert.ok(body.includes('class="booking-ref"'));
 assert.ok(body.includes("api('admin/table-links')"));
 assert.ok(body.includes('print-color-adjust:exact'));
});
