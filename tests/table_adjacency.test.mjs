import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../server/api.js',import.meta.url),'utf8');
const frontend=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const begin=server.indexOf('function oasiConnectedTableIds(');
const end=server.indexOf('async function oasiLinkedTables',begin);
assert.ok(begin>=0&&end>begin,'Verifica collegamenti sul server non trovata');
const connected=new Function(server.slice(begin,end)+'return oasiConnectedTableIds;')();
const edge=(a,b)=>({table_a:a,table_b:b});

test('Due tavoli scollegati non possono essere combinati',()=>{
 assert.equal(connected([1,2],[]),false);
 assert.equal(connected([1,2],[edge(1,3)]),false);
 assert.equal(connected([1,2],[edge(1,2)]),true);
});
test('Tre tavoli in catena sono un gruppo valido solo se interamente collegati',()=>{
 assert.equal(connected([1,2,3],[edge(1,2),edge(2,3)]),true);
 assert.equal(connected([1,2,3],[edge(1,2)]),false);
 assert.equal(connected([1,2,3],[edge(1,4),edge(2,3)]),false);
});
test('La verifica è indipendente dal verso dei collegamenti',()=>{
 assert.equal(connected([1,2,3],[edge(3,2),edge(2,1)]),true);
});
test('Il server controlla collegamenti nella creazione, modifica e riassegnazione',()=>{
 assert.ok(server.includes('if(!(await oasiLinkedTables(db,ids)))return null;'));
 assert.ok(server.includes("if(!(await oasiLinkedTables(db,ids)))return 'I tavoli scelti non sono collegabili"));
 assert.ok(server.includes('const candidate=await manualTableCandidate('));
 assert.ok(frontend.includes('oasiConnectedTableIds(selectedTables,tableLinks)'));
});
