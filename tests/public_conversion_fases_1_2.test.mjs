import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const begin=js.indexOf('const menupage=()=>');
const end=js.indexOf('const privacy=()=>',begin);
assert.ok(begin>=0&&end>begin);
const buildMenu=new Function('state','nav','footer','editorialImage','publicMedia','editorialPhoto','esc',
 js.slice(begin,end)+'return menupage;');
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const renderMenu=data=>buildMenu({data},()=>'<nav>Nav</nav>',()=>'<footer>Footer</footer>',()=>'<img>',()=>'',()=>'',
 esc)();

test('Menù: usa soltanto i piatti disponibili e non inventa prezzi',()=>{
 const html=renderMenu({menu:[
  {id:1,section:'piatti',category:'Primi',name:'Pasta di prova',description:'Descrizione',price:'€ 12',allergens:'glutine',available:1},
  {id:2,section:'pizze',category:'Rosse',name:'Pizza di prova',price:'€ 9',available:1},
  {id:3,section:'piatti',name:'Non disponibile',price:'€ 300',available:0}
 ]});
 assert.ok(html.includes('Pasta di prova'));
 assert.ok(html.includes('Pizza di prova'));
 assert.ok(html.includes('€ 12'));
 assert.ok(html.includes('Allergeni: glutine'));
 assert.ok(!html.includes('Non disponibile'));
 assert.ok(!html.includes('€ 300'));
 assert.ok(html.includes('data-public-menu-section="0"'));
});
test('Menù: il PDF rimane disponibile se presente e il catalogo non appare vuoto',()=>{
 const html=renderMenu({menu:[],menuPdf:true});
 assert.ok(html.includes('href="/api/menu-pdf"'));
 assert.ok(html.includes('href="/api/menu-pdf?download=1"'));
 assert.ok(!html.includes('data-public-menu-section'));
});
test('Menù: testi escapati prima della visualizzazione',()=>{
 const html=renderMenu({menu:[{section:'Primi',name:'<script>test</script>',price:'12 & 50',available:1}]});
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(html.includes('12 &amp; 50'));
});
test('Prenotazioni: riepilogo, verifica obbligatoria e conferma validata dal server',()=>{
 assert.ok(js.includes('id="oasi-book-summary"'));
 assert.ok(js.includes('const bookingSignature=()=>'));
 assert.ok(js.includes("lastVerified=o.available?bookingSignature():''"));
 assert.ok(js.includes('submit.disabled=!o.available'));
 assert.ok(js.includes('lastVerified!==bookingSignature()'));
 assert.ok(js.includes("await api('book','POST',inputData(f))"));
 assert.ok(css.includes('.oasi-book-summary'));
});
test('Eventi: modulo WhatsApp guidato, senza falsa conferma lato sito',()=>{
 assert.ok(js.includes('<form id="event-request"'));
 assert.ok(js.includes('data-event-type="Matrimonio"'));
 assert.ok(js.includes('data-event-type="Comunione o cresima"'));
 assert.ok(js.includes("evtForm.reportValidity()"));
 assert.ok(js.includes("https://wa.me/393387036868?text="));
 assert.ok(js.includes('La richiesta non costituisce una prenotazione'));
});
test('Galleria: comandi, filtro e modalità tastiera accessibile',()=>{
 for(const s of ['oasi-gallery-prev','oasi-gallery-next','oasi-gallery-counter','aria-pressed','ArrowLeft','ArrowRight','Escape','returnFocus?.focus'])
  assert.ok(js.includes(s),s);
 assert.ok(css.includes('.oasi-gallery-arrow'));
});
test('Homepage: accessi rapidi e storia priva di segnaposto editoriali',()=>{
 assert.ok(js.includes('oasi-public-quicklinks'));
 assert.ok(js.includes('oasi-hero-assurance'));
 assert.ok(!js.includes('Presto racconteremo qui ogni dettaglio della nostra esperienza.'));
});

test('Storia: i segnaposto in D1 sono sostituiti solo a video',()=>{
 const start=js.indexOf('const oasiPublicStory='),end=js.indexOf('const editorialPhoto=',start);
 assert.ok(start>=0&&end>start);
 const story=new Function(js.slice(start,end)+'return oasiPublicStory;')();
 assert.ok(!story('La nostra storia: aggiungi qui il tuo racconto dall’area ADMIN.').includes('aggiungi qui'));
 assert.equal(story('La storia del ristorante scritta dal cliente.'),'La storia del ristorante scritta dal cliente.');
 assert.ok(js.includes('oasiPublicStory(d.story)'));
});
