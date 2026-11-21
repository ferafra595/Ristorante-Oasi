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
 assert.equal(near(t(760,130),t(865,130)),false);
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
 assert.ok(src.includes('if(!editing&&!banquet&&!form._oasiLargeValid?.())'));
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

test('La prenotazione in Sala aggiorna i collegamenti dal server, senza usare la lista iniziale',()=>{
 assert.ok(src.includes('const reloadLinkedTables=async()=>'));
 assert.ok(src.includes("await api('admin/operations?'"));
 assert.ok(src.includes('additional=oasiLinkedOptions(d)'));
 assert.ok(src.includes('id="oasi-linked-table-choices"'));
 assert.ok(src.includes('id="oasi-reload-linked-tables"'));
});
test('La scelta guidata può proporre più tavoli senza confermare in automatico',()=>{
 assert.ok(src.includes('id="oasi-pick-joined-tables"'));
 assert.ok(src.includes('oasiRecommendStaffTables([table,...additional],party,d.links||[])'));
 assert.ok(src.includes('updateCapacity();'));
 assert.ok(src.includes("await api('admin/reservations','POST',payload)"));
});

test('Allineamento verticale: 4+2 e 3+5+6 sono permessi; 5+4 laterale no',()=>{
 const row4=t(660,110,55,120),row2=t(660,250,55,120);
 const row3=t(530,110,55,55),row5=t(530,185,55,85),row6=t(530,298,55,90);
 assert.equal(near(row4,row2),true);
 assert.equal(near(row3,row5),true);
 assert.equal(near(row5,row6),true);
 assert.equal(near(row4,row5),false);
});

test('Il banchetto condiviso supporta più gruppi di tavoli senza blocco sala',()=>{
 assert.ok(src.includes('id="oasi-banquet-list"'));
 assert.ok(src.includes('form._oasiBanquetSelection='));
 assert.ok(src.includes('if(banquet)payload.banquet_shared=true'));
});
