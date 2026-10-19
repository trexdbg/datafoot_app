import test from 'node:test';
import assert from 'node:assert/strict';
import {compactFixture,compactMatch} from '../scripts/build-worldcup-2022.mjs';

const fixture=compactFixture({
 match_id:1,match_date:'2022-12-01',competition_stage:{name:'Group Stage'},
 home_team:{home_team_name:'Argentina',home_team_group:'C',country:{id:11}},
 away_team:{away_team_name:'France',away_team_group:'D',country:{id:78}},
 home_score:1,away_score:0
});
const starter=(id,name,team)=>({period:1,minute:0,second:0,type:{name:'Starting XI'},team:{name:team},tactics:{lineup:[{player:{id,name},position:{name:'Center Forward'}}]}});
const sample=[
 starter(10,'Joueur A','Argentina'),
 starter(20,'Joueur B','France'),
 {period:1,minute:12,second:15,type:{name:'Pass'},team:{name:'Argentina'},player:{id:10,name:'Joueur A'},pass:{end_location:[110,45]},location:[50,50]},
 {period:1,minute:17,second:39,type:{name:'Pass'},team:{name:'Argentina'},player:{id:10,name:'Joueur A'},pass:{goal_assist:true}},
 {period:1,minute:19,second:10,type:{name:'Pass'},team:{name:'Argentina'},player:{id:10,name:'Joueur A'},pass:{shot_assist:true}},
 {period:1,minute:31,second:2,type:{name:'Substitution'},team:{name:'France'},player:{id:20,name:'Joueur B'},substitution:{replacement:{id:21,name:'Joueur C'}}},
 {period:2,minute:77,second:13,type:{name:'Shot'},team:{name:'France'},player:{id:21,name:'Joueur C'},shot:{outcome:{name:'Goal'},statsbomb_xg:0.6},location:[113,45]},
 {period:2,minute:82,second:11,type:{name:'Bad Behaviour'},team:{name:'Argentina'},player:{id:10,name:'Joueur A'},bad_behaviour:{card:{name:'Second Yellow'}}},
 {period:5,minute:126,second:0,type:{name:'Shot'},team:{name:'France'},player:{id:21,name:'Joueur C'},shot:{outcome:{name:'Goal'}}}
];
test('64-match metadata fields use factual home and away teams',()=>{
 assert.equal(fixture.home,'Argentina');
 assert.equal(fixture.away,'France');
 assert.equal(fixture.group,'C');
 assert.equal(fixture.source,'https://github.com/hudl/open-data/blob/master/data/events/1.json');
});
test('match source generates starters, substitutes, minute and second of events',()=>{
 const m=compactMatch(fixture,sample);
 assert.equal(m.players.find(p=>p.id===20).exit,32);
 assert.equal(m.players.find(p=>p.id===21).entry,32);
 assert.equal(m.players.find(p=>p.id===10).exit,83);
 assert.equal(m.actions.find(a=>a.k==='Pass').m,13);
 assert.deepEqual(m.actions.find(a=>a.k==='Pass').l,[50,50]);
 assert.equal(m.actions.find(a=>a.k==='Shot').xg,0.6);
 assert.equal(m.actions.filter(a=>a.ga).length,1);
 assert.equal(m.actions.filter(a=>a.sa).length,1);
 assert.equal(m.actions.find(a=>a.ga).m,18);
 assert.ok(!m.actions.some(a=>a.ga&&a.sa));
 assert.equal(m.goals.length,1);
 assert.equal(m.goals[0].minute,78);
 assert.equal(m.goals[0].team,'France');
 assert.equal(m.actions.some(a=>a.m===127),false);
});