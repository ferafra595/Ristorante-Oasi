import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankTableOptions} from '../server/recommendations.js';

test('suggestion ranking prefers small single tables for two people',()=>{
 const choices=[
 {ids:[1],room_id:1,capacity:8,code:'1'},
 {ids:[2],room_id:1,capacity:3,code:'2'},
 {ids:[3],room_id:1,capacity:2,code:'3'},
 {ids:[4,5],room_id:1,capacity:2,code:'4+5'}
 ];
 const ranked=rankTableOptions(choices,2);
 assert.deepEqual(ranked.map(x=>x.code),['3','2','4+5','1']);
 assert.equal(choices[0].code,'1','ranking must not mutate the caller array');
});
test('suggestion ranking prefers minimum waste over oversized tables for groups',()=>{
 const choices=[{ids:[1],room_id:1,capacity:12},{ids:[2,3],room_id:1,capacity:6},{ids:[4],room_id:1,capacity:6}];
 assert.deepEqual(rankTableOptions(choices,6).map(x=>x.ids),[[4],[2,3],[1]]);
});
