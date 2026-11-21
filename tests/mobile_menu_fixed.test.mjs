import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const fix=css.slice(css.lastIndexOf('/* Oasi mobile: header sempre raggiungibile'));
test('Il menu del sito è fissato in alto durante lo scroll su smartphone',()=>{
 assert.ok(fix.includes('@media screen and (max-width:1000px)'));
 assert.ok(fix.includes('body.oasi-public{padding-top:68px}'));
 assert.match(fix,/\.nav\.nav-premium\{\s*position:fixed!important/);
 assert.ok(fix.includes('top:0!important;left:0!important;right:0!important'));
});
test('Il pannello aperto è ancorato sotto la barra e scorre indipendentemente',()=>{
 assert.ok(fix.includes('.nav #links.open:not([hidden])'));
 assert.ok(fix.includes('inset:68px 0 auto!important'));
 assert.ok(fix.includes('height:calc(100dvh - 68px)!important'));
 assert.ok(fix.includes('overflow-y:auto!important'));
 assert.ok(fix.includes('overscroll-behavior:contain'));
});
test('Restano accessibili chiusura e navigazione con escape',()=>{
 assert.ok(js.includes("toggle.setAttribute('aria-expanded',String(open))"));
 assert.ok(js.includes("if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')"));
 assert.ok(js.includes("menu.querySelectorAll('a').forEach"));
 assert.ok(fix.includes('.oasi-mobile-book{display:none!important}'));
});
