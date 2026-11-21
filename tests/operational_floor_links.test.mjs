import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const a=src.indexOf('const floorOpsSvg='),b=src.indexOf('// Fase 8: calendario operativo.',a);
const c=src.indexOf('const oasiNearbyTable='),d=src.indexOf('const oasiLinkedComponent=',c);
assert.ok(a>=0&&b>a&&c>=0&&d>c);
const svg=new Function([
 "const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');",
 src.slice(c,d),
 src.slice(a,b),
 'return floorOpsSvg;'
].join('\n'))();
const t=(id,x,y,w=60,h=80)=>({id,room_id:1,code:String(id),x,y,w,h,seats:8,enabled:1,rotation:0,shape:'square'});
const tables=[t(4,650,100),t(2,650,195),t(3,530,100,60,55),t(5,530,170,60,85),t(6,530,270,60,90)];
const links=[{table_a:4,table_b:2},{table_a:3,table_b:5},{table_a:5,table_b:6},{table_a:4,table_b:5}];
const booking=(id,ids,name)=>({id,status:'confirmed',name,table_ids:ids.join(','),visit_state:'expected'});

test('Sala: 4+2 e 3+5+6 hanno tre ponti verticali e nessuna diagonale',()=>{
 const bookings=[booking(10,[4,2],'Tavolo gruppo'),booking(11,[3,5,6],'Banchetto')];
 const html=svg(tables,[],bookings,[],links);
 assert.equal((html.match(/class="oasi-live-join"/g)||[]).length,3);
 assert.ok(html.includes('Tavolo 4'));
 assert.ok(html.includes('Tavolo 6'));
});
test('Sala: collegamenti senza stessa prenotazione non vengono disegnati',()=>{
 const bookings=[booking(10,[4],'Uno'),booking(11,[2],'Due')];
 const html=svg(tables,[],bookings,[],links);
 assert.equal((html.match(/class="oasi-live-join"/g)||[]).length,0);
});
test('Sala: disponibilità del tavolo resta determinata dalla singola assegnazione',()=>{
 const bookings=[booking(10,[4],'Uno')];
 const html=svg(tables,[],bookings,[],links);
 assert.ok(html.includes('aria-label="Tavolo 4, 8 posti, Uno"'));
 assert.ok(html.includes('aria-label="Tavolo 2, 8 posti, libero"'));
});
