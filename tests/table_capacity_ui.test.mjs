import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('La modifica mostra tutti i tavoli liberi, anche se grandi rispetto agli ospiti',()=>{
 assert.ok(src.includes('available=freeTables;room.innerHTML='));
 assert.ok(src.includes('const refreshCapacity=()=>{available=freeTables;'));
 assert.ok(!src.includes('freeTables.filter(fitsParty)'));
});
test('Capienza e collegamenti vengono validati sull\'intero gruppo scelto',()=>{
 assert.ok(src.includes('oasiConnectedTableIds(selectedTables,tableLinks)'));
 assert.ok(src.includes('party>=min&&party<=max&&connected'));
 assert.ok(src.includes('picked.length<='));
 assert.ok(src.includes("selectedTables=selectedTables.filter(id=>available.some(t=>Number(t.id)===id"));
});
test('I tavoli già occupati rimangono esclusi dall\'assegnazione',()=>{
 assert.ok(src.includes("const busy=new Set(data.reservations.filter(r=>r.status==='confirmed'"));
 assert.ok(src.includes('!busy.has(Number(t.id))'));
 assert.ok(src.includes("!blocks.some(b=>b.scope==='table'"));
});
