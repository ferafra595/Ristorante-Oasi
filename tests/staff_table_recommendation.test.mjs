import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const begin=source.indexOf('const oasiRecommendStaffTables=');
const end=source.indexOf('function openEditBookingDrawer',begin);
assert.ok(begin>=0&&end>begin,'Algoritmo suggerimento mancante');
const recommend=new Function(source.slice(begin,end)+'return oasiRecommendStaffTables;')();
const t=(id,room,seats,min=1)=>({id,room_id:room,seats,min_seats:min});

test('Consiglia tavolo singolo proporzionato senza sprecare posti',()=>{
 assert.deepEqual(recommend([t(1,1,2),t(2,1,3),t(3,1,6)],2),[1]);
 assert.deepEqual(recommend([t(1,1,3),t(2,1,4)],3),[1]);
});
test('Combina solo tavoli della stessa sala quando serve',()=>{
 const result=recommend([t(1,1,3),t(2,1,3),t(3,2,10)],5);
 assert.deepEqual(result,[1,2]);
});
test('Non supera il limite massimo di otto tavoli',()=>{
 assert.equal(recommend(Array.from({length:10},(_,i)=>t(i+1,1,2)),18).length,0);
 assert.equal(recommend(Array.from({length:10},(_,i)=>t(i+1,1,2)),16).length,8);
});
test('Rispetta i minimi di capienza e non suggerisce tavoli non compatibili',()=>{
 assert.deepEqual(recommend([t(1,1,8,6),t(2,1,2)],2),[2]);
 assert.deepEqual(recommend([t(1,1,8,6)],2),[]);
 assert.deepEqual(recommend([t(1,1,2)],0),[]);
});
test('Il suggerimento non modifica i dati originali',()=>{
 const tables=[t(1,1,2),t(2,1,3)];const copy=JSON.stringify(tables);
 recommend(tables,2);assert.equal(JSON.stringify(tables),copy);
});
test('Interfaccia conserva conferma manuale e salvataggio verificato dal server',()=>{
 assert.ok(source.includes('id="oasi-edit-recommend"'));
 assert.ok(source.includes('Combinazione proposta. Controlla e salva per confermare.'));
 assert.ok(source.includes("action:'edit_full',table_ids:selectedTables,expected"));
});
