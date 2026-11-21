import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const api=readFileSync(new URL('../server/api.js',import.meta.url),'utf8');
const a=src.indexOf('const oasiPhotoPosition=');
const b=src.indexOf('const mediaEditor=',a);
assert.ok(a>0&&b>a);
const evaluate=new Function(src.slice(a,b)+'return {oasiPhotoPosition,oasiFocalRatio};')();
test('Posizione predefinita centrata e coordinate salvate con limiti',()=>{
 const {oasiPhotoPosition}=evaluate;
 assert.equal(oasiPhotoPosition({},'homeStoryImage','X'),50);
 assert.equal(oasiPhotoPosition({},'homeStoryImage','Y'),50);
 assert.equal(oasiPhotoPosition({homeStoryImagePositionX:'18',homeStoryImagePositionY:'83'},'homeStoryImage','X'),18);
 assert.equal(oasiPhotoPosition({homeStoryImagePositionX:'18',homeStoryImagePositionY:'83'},'homeStoryImage','Y'),83);
 assert.equal(oasiPhotoPosition({homeStoryImagePositionX:-20},'homeStoryImage','X'),50);
 assert.equal(oasiPhotoPosition({homeStoryImagePositionX:200},'homeStoryImage','X'),50);
});
test('Formati dell\'anteprima dipendono dal punto della pagina',()=>{
 const {oasiFocalRatio}=evaluate;
 assert.equal(oasiFocalRatio('heroImage'),'16/9');
 assert.equal(oasiFocalRatio('homeGallery1'),'4/5');
 assert.equal(oasiFocalRatio('homeStoryImage'),'5/4');
 assert.equal(oasiFocalRatio('eventWeddingImage'),'4/3');
});
test('Ogni posizione foto passa dall\'ADMIN alla visualizzazione pubblica',()=>{
 assert.ok(src.includes('name="${k}PositionX"'));
 assert.ok(src.includes('name="${k}PositionY"'));
 assert.ok(src.includes('style="object-position:${oasiPhotoPosition(site(),key,'));
 assert.ok(src.includes("editorialImage(story,'Gli ambienti dell’Oasi','',false,'homeStoryImage')"));
 assert.ok(src.includes("editorialImage(hero,'Ristorante Oasi','oasi-hero-photo',true,'heroImage')"));
 assert.ok(src.includes('inputData(e.target)'));
 assert.ok(api.includes("resource==='settings'"));
 assert.ok(api.includes("JSON.stringify(b),key"));
});
test('Anteprima può essere regolata con cursori e tocco senza alterare il file',()=>{
 assert.ok(src.includes('class="oasi-focal-preview"'));
 assert.ok(src.includes("axisX.addEventListener('input',updateFocal)"));
 assert.ok(src.includes("axisY.addEventListener('input',updateFocal)"));
 assert.ok(src.includes("crop.addEventListener('pointerdown'"));
 assert.ok(src.includes("focal.querySelector('.oasi-focal-reset')"));
 assert.ok(css.includes('.oasi-focal-preview img'));
 assert.ok(css.includes('object-fit:cover'));
});
