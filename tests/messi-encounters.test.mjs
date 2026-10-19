import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankOpponents,MODE_IDS,opponentDisplayName} from '../src/lib/messi-encounters-engine.mjs';
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


test('identifiants StatsBomb : affichage des noms usuels sans modifier les comptages',()=>{
 assert.equal(opponentDisplayName(26070,'Antonio Rodríguez Martínez'),'Toño');
 assert.equal(opponentDisplayName(25144,'Diego Alves Carreira'),'Diego Alves');
 assert.equal(opponentDisplayName(6320,'Filipe Luís Kasmirski'),'Filipe Luís');
 assert.equal(opponentDisplayName(11179,'Iker Casillas Fernández'),'Iker Casillas');
 assert.equal(opponentDisplayName(999999,'Gardien inconnu'),'Gardien inconnu');
 assert.equal(rankOpponents([{target_id:26070,target_name:'Antonio Rodríguez Martínez',kind:'tir'}])[0].name,'Toño');
});

test('le fichier de données réelles est disponible pour le déploiement Pages',()=>{
 const source=fs.readFileSync(new URL('../src/data/players/messi-encounters.json',import.meta.url),'utf8');
 const exposed=fs.readFileSync(new URL('../public/data/players/messi-encounters.json',import.meta.url),'utf8');
 const data=JSON.parse(source),pub=JSON.parse(exposed);
 assert.equal(data.schema_version,1);
 assert.equal(data.scope.complete_career,false);
 assert.ok(data.scope.liga_matches>0&&data.scope.ucl_matches>0);
 assert.ok(data.modes.goalkeepers.count>0);
 assert.ok(data.modes.defenders.count>0);
 assert.ok(data.modes.clubs.count>0);
 assert.deepEqual(data,pub);
});


test('602 matchs publics : Rival Wars peut parcourir tous les clubs sur plusieurs pages',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../src/data/players/messi-encounters.json',import.meta.url),'utf8'));
 const page=fs.readFileSync(new URL('../src/pages/joueurs/messi/affrontements.astro',import.meta.url),'utf8');
 const engine=fs.readFileSync(new URL('../src/lib/messi-encounters-engine.mjs',import.meta.url),'utf8');
 assert.equal(data.scope.full_open_data_scan,true);
 assert.ok(data.scope.matches_count>=54);
 assert.equal(data.scope.complete_career,false);
 assert.equal(data.modes.clubs.count,data.modes.clubs.events.length);
 assert.ok(data.modes.clubs.leaders.length>20,'Le classement des équipes doit dépasser une page');
 for(const id of ['me-pages','me-prev','me-next','me-page-label','me-global-totals'])
   assert.ok(page.includes('id="'+id+'"'),id+' absent');
 assert.ok(engine.includes('allLeaders=rankOpponents(source,1000000)'));
 assert.ok(engine.includes('leaders=allLeaders.slice(page*perPage,(page+1)*perPage)'));
 assert.ok(engine.includes("say('me-global-totals'"));
});
