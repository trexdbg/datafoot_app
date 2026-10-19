import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankOpponents,MODE_IDS} from '../src/lib/messi-encounters-engine.mjs';
import {monthOrdinal,layoutPlayerNodes} from '../src/lib/pass-wars-engine.mjs';
import fs from 'node:fs';

test('trois modes et top 20 des joueurs, scores par club sans maximum 20',()=>{
 assert.deepEqual(MODE_IDS,['goalkeepers','defenders','clubs']);
 const input=Array.from({length:25},(_,i)=>({
   target_id:i+1,target_name:'Adversaire '+(i+1),kind:'dribble réussi',
 }));
 input.push({target_id:2,target_name:'Adversaire 2',kind:'dribble réussi'});
 assert.equal(rankOpponents(input).length,20);
 assert.equal(rankOpponents(input)[0].id,2);
 assert.equal(rankOpponents(input)[0].count,2);
 assert.equal(rankOpponents(input,1000).length,25);
});

test('buts connus distincts du nombre de tirs opposés',()=>{
 const shots=[
   {target_id:9,target_name:'Gardien',kind:'tir',goal:false},
   {target_id:9,target_name:'Gardien',kind:'tir',goal:true},
   {target_id:9,target_name:'Gardien',kind:'tir',goal:false},
 ];
 const ranks=rankOpponents(shots);
 assert.equal(ranks[0].count,3);
 assert.equal(ranks[0].goals,1);
 const clubs=[{target_id:42,target_name:'Real Madrid',kind:'but'}];
 assert.equal(rankOpponents(clubs)[0].goals,1);
});

test('page Rival Wars préserve les événements réels, le mois/année et les lignes absentes',()=>{
 const page=fs.readFileSync(new URL('../src/pages/joueurs/messi/affrontements.astro',import.meta.url),'utf8');
 const engine=fs.readFileSync(new URL('../src/lib/messi-encounters-engine.mjs',import.meta.url),'utf8');
 for(const mode of MODE_IDS)assert.ok(page.includes('data-me-mode="'+mode+'"'));
 assert.ok(page.includes('id="me-month"'));
 assert.ok(page.includes('MOIS / ANNÉE'));
 assert.ok(page.includes('id="me-canvas"'));
 assert.ok(engine.includes('/data/players/messi-encounters.json'));
 assert.ok(engine.includes("complete_career!==false"));
 assert.ok(!engine.includes('drawEdges('));
 assert.ok(!/ctx\.stroke\s*\(|ctx\.setLineDash|ctx\.lineTo\s*\(/.test(engine));
 assert.equal(monthOrdinal('2015-06-06'),2015*12+5);
 const pos=layoutPlayerNodes([{id:12},{id:14},{id:16}]);
 assert.equal(pos.size,3);
});
