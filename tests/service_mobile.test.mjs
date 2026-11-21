import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=source.indexOf('const oasiVisitNext=');
const end=source.indexOf('const operationalTable=',start);
assert.ok(start>=0&&end>start,'Mobile service renderer missing');
const chunk=source.slice(start,end);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context={esc:escape,opLabel:{expected:'In attesa',arrived:'Arrivato',seated:'Al tavolo',finished:'Terminato',no_show:'Non presentato'},opSelect:r=>'<select data-op-state="'+Number(r.id)+'"></select>'};
vm.createContext(context);
vm.runInContext(chunk+'\nthis.render=oasiServiceMobileCards;this.transitions=oasiVisitNext;',context);

const row=(state,id=11)=>({id,time:'19:30',name:'Mario Rossi',phone:'3331234567',party_size:2,table_codes:'T2',visit_state:state});
test('Mobile service actions progress one state at a time',()=>{
 const scenarios=[['expected','arrived','Segna arrivato'],['arrived','seated','Accompagna al tavolo'],['seated','finished','Termina servizio']];
 for(const [from,to,text] of scenarios){
  const html=context.render([row(from)]);
  assert.match(html,new RegExp('data-op-next="'+to+'"'));
  assert.ok(html.includes(text));
  assert.ok(html.includes('data-op-guest="11"'));
  assert.ok(html.includes('tel:3331234567'));
  assert.ok(html.includes('data-op-mobile-edit="11"'));
 }
});
test('Finished and no-show guests have no next-step button but retain manual status control',()=>{
 for(const state of ['finished','no_show']){
  const html=context.render([row(state)]);
  assert.ok(!html.includes('data-op-step="11"'));
  assert.ok(html.includes('data-op-state="11"'));
 }
});
test('Guest names are escaped and booking metadata rendered safely',()=>{
 const html=context.render([{...row('expected'),name:'<script>alert(1)</script>'}]);
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
});
test('Mobile service action handlers and backend visit API remain wired',()=>{
 assert.ok(source.includes("document.querySelectorAll('[data-op-step]').forEach"));
 assert.ok(source.includes("api('admin/visits/'+id,'PATCH',{state:value})"));
 assert.ok(source.includes('oasiServiceMobileCards(active)'));
 assert.ok(source.includes('data-op-drawer-next'));
});
