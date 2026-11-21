import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const rules=css.slice(css.indexOf('/* OASI — formati fotografici uniformi'));

test('Foto del sito ritagliate in contenitori standard senza distorsione',()=>{
 assert.match(rules,/object-fit:cover/);
 assert.match(rules,/object-position:center center/);
 assert.ok(rules.includes('.dedicated-gallery-item{display:block;position:relative;aspect-ratio:4/3'));
 assert.ok(rules.includes('.oasi-editorial-photo-grid>a{display:block;position:relative;aspect-ratio:4/5'));
 assert.ok(rules.includes('.event-offer-card>img{aspect-ratio:4/3'));
 assert.ok(rules.includes('.oasi-event-photos>img{aspect-ratio:4/3'));
});
test('Hero e foto editoriali mantengono proporzioni indipendenti dal file',()=>{
 assert.ok(rules.includes('.oasi-editorial-hero>.oasi-hero-photo'));
 assert.ok(rules.includes('.event-hero-photo>img'));
 assert.ok(rules.includes('aspect-ratio:5/4;height:auto'));
 assert.ok(rules.includes('@media(max-width:760px)'));
});
test('Loghi e foto viste a grandezza intera non vengono ritagliati',()=>{
 assert.ok(rules.includes('.gallery-lightbox img{width:auto;height:auto;max-width:100%;max-height:77vh;object-fit:contain'));
 assert.ok(rules.includes('.oasi-media-preview img{object-fit:contain}'));
 assert.ok(!rules.includes('.side-brand img'));
 assert.ok(src.includes('class="gallery-lightbox"'));
});
test('Le immagini caricate mantengono il file originale e usano i contenitori per il ritaglio',()=>{
 assert.ok(src.includes('image_url'));
 assert.ok(src.includes('src="${esc(p.image_url)}"'));
});
