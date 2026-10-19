import test from 'node:test';
import assert from 'node:assert/strict';
import {pulsePresence} from '../src/lib/pulse-presence.mjs';

test('above-50 time, hot minutes and longest uninterrupted spell count only active players',()=>{
 const samples=[null,50,61,70,76,30,55,77,null,80].map((activity,minute)=>({minute,activity}));
 assert.deepEqual(pulsePresence(samples),{
  played:8,above:6,share:75,strong:3,longest:3,longestStart:2,longestEnd:4
 });
});
test('thresholds are strict, and substitutions never inflate above-50 streaks',()=>{
 const timeline=Array.from({length:20},(_,minute)=>({
  minute,activity:minute<9||minute>=15?null:minute===9?50:minute===10?75:minute===11?75.1:80
 }));
 const p=pulsePresence(timeline);
 assert.equal(p.played,6);
 assert.equal(p.above,5);
 assert.equal(p.strong,4);
 assert.equal(p.share,83);
 assert.equal(p.longest,5);
 assert.equal(p.longestStart,10);
 assert.equal(p.longestEnd,14);
});
test('empty and discontinuous samples return neutral informative values',()=>{
 assert.deepEqual(pulsePresence([]),{
  played:0,above:0,share:0,strong:0,longest:0,longestStart:null,longestEnd:null
 });
 assert.equal(pulsePresence(null).share,0);
 const broken=[{minute:12,activity:80},{minute:14,activity:90},{minute:15,activity:72}];
 const info=pulsePresence(broken);
 assert.equal(info.above,3);
 assert.equal(info.longest,2);
 assert.equal(info.longestStart,14);
});
