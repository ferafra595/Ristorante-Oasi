import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

const helperStart=source.indexOf('// Orario operativo locale:');
const helperEnd=source.indexOf('const esc=v=>',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'Time zone helper not found');
const createTimeHelper=state=>new Function('state',source.slice(helperStart,helperEnd)+'return {oasiItalianToday,oasiItalianService,oasiAutoServiceRefresh}')(state);

const groupStart=source.indexOf('const oasiAgendaGroup=');
const groupEnd=source.indexOf('const opsDateControls=',groupStart);
assert.ok(groupStart>=0&&groupEnd>groupStart,'Simple agenda renderer not found');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const agenda=new Function('esc','opLabel',source.slice(groupStart,groupEnd)+'return oasiAgendaGroup;')(esc,{expected:'In attesa',arrived:'Arrivato',seated:'Al tavolo',finished:'Terminato',no_show:'Non presentato'});

test('Sala switches automatically at 17:00 Italian local time through DST',()=>{
 const {oasiItalianService}=createTimeHelper({});
 for(const [date,expected] of [
  ['2026-11-21T15:59:00Z','lunch'],['2026-11-21T16:00:00Z','dinner'],
  ['2026-06-21T14:59:00Z','lunch'],['2026-06-21T15:00:00Z','dinner'],
  ['2026-11-21T23:30:00Z','lunch']
 ])assert.equal(oasiItalianService(new Date(date)),expected,date);
});
test('Sala and Agenda automatically follow today unless user selects manually',()=>{
 const state={adminView:'service',date:'1999-01-01',opsService:'lunch',opsManualSelection:false,agendaManualSelection:false,reservationService:'dinner'};
 const time=createTimeHelper(state);
 assert.equal(time.oasiAutoServiceRefresh(),true);
 assert.equal(state.date,time.oasiItalianToday());
 assert.equal(state.opsService,time.oasiItalianService());
 state.opsManualSelection=true;state.date='2031-04-01';state.opsService='dinner';
 assert.equal(time.oasiAutoServiceRefresh(),false);
 assert.equal(state.date,'2031-04-01');
 state.adminView='reservations';state.agendaManualSelection=false;state.date='1999-01-01';state.reservationService='lunch';
 assert.equal(time.oasiAutoServiceRefresh(),true);
 assert.equal(state.date,time.oasiItalianToday());
 assert.equal(state.reservationService,'all');
 state.agendaManualSelection=true;state.date='2031-04-01';state.reservationService='dinner';
 assert.equal(time.oasiAutoServiceRefresh(),false);
 assert.equal(state.reservationService,'dinner');
});
test('Agenda separates lunch and dinner, calculates confirmed covers, and keeps actions',()=>{
 const rows=[
 {id:10,service:'lunch',status:'confirmed',time:'13:00',name:'Pranzo',party_size:3,table_codes:'1',source:'staff',phone:'456',visit_state:'arrived'},
 {id:11,service:'dinner',status:'confirmed',time:'20:00',name:'Cena',party_size:2,table_codes:'2',source:'web',phone:'123',visit_state:'expected'},
 {id:12,service:'lunch',status:'cancelled',time:'14:00',name:'Annullata',party_size:4,table_codes:'3',source:'staff'}
 ];
 const lunch=agenda(rows,'lunch'),dinner=agenda(rows,'dinner');
 assert.ok(lunch.includes('<h3>Pranzo</h3>'));assert.ok(dinner.includes('<h3>Cena</h3>'));
 assert.ok(!lunch.includes('>Cena</h4>'));assert.ok(!dinner.includes('>Pranzo</h4>'));
 assert.ok(lunch.includes('<strong>3</strong> coperti'));assert.ok(dinner.includes('<strong>2</strong> coperti'));
 assert.ok(lunch.includes('data-move="10"'));assert.ok(lunch.includes('data-cancel="10"'));
 assert.ok(!lunch.includes('data-cancel="12"'));
});
test('Agenda retains filters, clear Today action and optional print tools',()=>{
 assert.ok(source.includes("state.reservationService='all';state.agendaManualSelection=false"));
 assert.ok(source.includes('oasiAgendaGroup(arr,\\'lunch\\')'));
 assert.ok(source.includes('oasiAgendaGroup(arr,\\'dinner\\')'));
 assert.ok(source.includes('id="reservation-service"'));
 assert.ok(source.includes('id="print-reservations"'));
 assert.ok(source.includes("if(oasiAutoServiceRefresh()){await renderAdmin();return}"));
});
