import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const begin=src.indexOf('const oasiRecommendBanquetTables=');
const end=src.indexOf('function openEditBookingDrawer',begin);
assert.ok(begin>=0&&end>begin,'Suggerimento banchetti non presente');
const recommend=new Function(src.slice(begin,end)+'return oasiRecommendBanquetTables;')();
const t=(id,room,seats,min=1)=>({id,room_id:room,seats,min_seats:min,enabled:1});

test('12 ospiti: propone due tavoli da 8 e non tre tavoli',()=>{
 const rows=[t(4,1,8),t(2,1,8),t(3,1,3),t(5,1,8),t(6,1,8)];
 const ids=recommend(rows,12,[]);
 assert.equal(ids.length,2);
 assert.ok(ids.every(id=>[4,2,5,6].includes(id)));
});
test('30 ospiti: selezione multipla di quattro tavoli, senza attraversare sale',()=>{
 const rows=[t(4,1,8),t(2,1,8),t(5,1,8),t(6,1,8),t(9,2,20)];
 const ids=recommend(rows,30,[]);
 assert.equal(ids.length,4);
 assert.ok(ids.every(id=>[4,2,5,6].includes(id)));
});
test('Capienza minima e tavoli disattivati sono rispettati',()=>{
 assert.deepEqual(recommend([t(1,1,8,6)],2),[]);
 assert.deepEqual(recommend([{...t(1,1,8),enabled:0},t(2,1,5)],4),[2]);
 assert.deepEqual(recommend([t(1,1,8)],200),[]);
});
test('Il suggerimento non modifica l\'elenco originale',()=>{
 const rows=[t(4,1,8),t(2,1,8)];
 const before=JSON.stringify(rows);
 recommend(rows,12,[]);
 assert.equal(JSON.stringify(rows),before);
});
test('La selezione resta confermata dall\'operatore',()=>{
 assert.ok(src.includes('id="oasi-banquet-suggest"'));
 assert.ok(src.includes('id="oasi-banquet-clear"'));
 assert.ok(src.includes('form._oasiBanquetSelection='));
 assert.ok(src.includes('if(banquet)payload.banquet_shared=true'));
 assert.ok(src.includes("await api('admin/reservations','POST',payload)"));
});
test('Agenda e Sala espongono stampe e apertura banchetto',()=>{
 for(const id of ['agenda-new-banquet','oasi-service-print','print-reservation-plan'])assert.ok(src.includes('id="'+id+'"'),id);
 assert.ok(src.includes("$('#agenda-new-banquet')?.addEventListener"));
 assert.ok(src.includes("$('#oasi-service-print')?.addEventListener"));
 assert.ok(src.includes('Banchetto · sala condivisa'));
});
