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
 assert.ok(server.includes('if(!banquet&&!(await oasiLinkedTables(db,ids)))return null;'));
 assert.ok(server.includes("if(!banquet&&!(await oasiLinkedTables(db,ids)))return 'I tavoli scelti devono essere collegati in verticale"));
 assert.ok(server.includes('const candidate=await manualTableCandidate('));
 assert.ok(frontend.includes('oasiConnectedTableIds(selectedTables,tableLinks)'));
});

test('Regola server: vieta collegamenti laterali e diagonali, ammette catene verticali',()=>{
 const a=server.indexOf('const oasiVerticalPair='),b=server.indexOf('function oasiConnectedTableIds',a);
 assert.ok(a>=0&&b>a);
 const vertical=new Function(server.slice(a,b)+'return oasiVerticalPair;')();
 const t=(x,y,w=55,h=100)=>({x,y,w,h});
 assert.equal(vertical(t(650,100),t(650,220)),true);
 assert.equal(vertical(t(530,100,55,60),t(530,180,55,90)),true);
 assert.equal(vertical(t(530,180,55,90),t(530,295)),true);
 assert.equal(vertical(t(530,180),t(650,100)),false);
 assert.equal(vertical(t(650,100),t(760,100)),false);
 assert.ok(server.includes('if(!oasiVerticalPair(rows[0],rows[1]))return fail('));
});
