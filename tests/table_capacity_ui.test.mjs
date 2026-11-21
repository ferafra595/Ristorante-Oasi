import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const expression=source.match(/const fitsParty=\(t\)=>\{[^}]+\};/)?.[0];
assert.ok(expression,'Regola di selezione tavoli non trovata nel frontend');
const getFilter=party=>new Function('form',expression.replace(/^const fitsParty=/,'return ')+';')({elements:{party_size:{value:String(party)}}});

test('La modifica per 2 persone propone solo tavoli entro 3 posti',()=>{
 const fits=getFilter(2);
 assert.equal(fits({min_seats:1,seats:1}),true);
 assert.equal(fits({min_seats:1,seats:3}),true);
 assert.equal(fits({min_seats:2,seats:2}),true);
 assert.equal(fits({min_seats:3,seats:3}),false);
 assert.equal(fits({min_seats:1,seats:4}),false);
 assert.equal(fits({min_seats:1,seats:8}),false);
 assert.equal(fits({min_seats:6,seats:8}),false);
});
test('Aggiorna la selezione alle nuove persone e permette tavoli combinati',()=>{
 assert.equal(getFilter(4)({min_seats:3,seats:5}),true);
 assert.equal(getFilter(4)({min_seats:1,seats:8}),false);
 assert.equal(getFilter(12)({min_seats:1,seats:8}),true);
 assert.equal(getFilter(0)({min_seats:1,seats:2}),false);
});
