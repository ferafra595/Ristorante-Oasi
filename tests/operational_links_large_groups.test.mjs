import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../server/api.js',import.meta.url),'utf8');
const first=src.indexOf('const oasiNearbyTable='),last=src.indexOf('const oasiLinkedComponent=',first);
assert.ok(first>=0&&last>first);
const near=new Function(src.slice(first,last)+'return oasiNearbyTable;')();
const t=(x,y,w=55,h=110)=>({x,y,w,h});
test('La sala propone tavoli vicini e non altri lontani',()=>{
 assert.equal(near(t(760,130),t(760,310)),true);
 assert.equal(near(t(760,130),t(100,310)),false);
 assert.equal(near(t(760,130),t(865,130)),true);
 assert.equal(near(t(760,130),t(200,200)),false);
});
test('Il pannello Sala consente di salvare i collegamenti direttamente',()=>{
 assert.ok(src.includes('Collega tavoli adiacenti'));
 assert.ok(src.includes("await api('admin/table-links',checked?'POST':'DELETE'"));
 assert.ok(src.includes("close();await refreshAfterAction()"));
});
test('Gruppi grandi richiedono selezione e consenso esplicito',()=>{
 assert.ok(src.includes('id="oasi-large-party"'));
 assert.ok(src.includes('id="oasi-join-confirm"'));
 assert.ok(src.includes('form._oasiLargeValid='));
 assert.ok(src.includes('if(!editing&&!form._oasiLargeValid?.())'));
});
test('Per il banchetto condiviso non vengono bloccate le sale',()=>{
 assert.ok(src.includes('id="oasi-partial-banquet"'));
 assert.ok(src.includes('openNewBookingDrawer({banquet:true})'));
 assert.ok(src.includes('Banchetto con sala condivisa. Riservare solo i tavoli assegnati.'));
});
test('Candidati automatici possono combinare fino a otto tavoli',()=>{
 assert.ok(api.includes('if(group.length>=8)continue'));
 assert.ok(api.includes('if(ids.length<8)queue.push(ids)'));
});
