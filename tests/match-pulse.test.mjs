import test from 'node:test';
import assert from 'node:assert/strict';
import {computePulse,pulseWeight,pulsePenalty,pulseBand,PULSE_BANDS,PULSE_RULES,computeMatchProfiles} from '../src/lib/match-activity.mjs';

test('des actions passées créent des impulsions, pas les futures',()=>{
 const events=[{minute:15,second:30,kind:'Dribble',outcome:'Complete'}];
 const {timeline}=computePulse(events,90);
 assert.equal(timeline[0].activity,50);
 assert.ok(timeline[14].activity>25 && timeline[14].activity<50);
 assert.ok(timeline[15].activity>0);
 assert.ok(timeline[15].impact>0);
 assert.ok(timeline[16].activity<timeline[15].activity);
 assert.ok(timeline[30].activity<timeline[16].activity);
 assert.ok(timeline.every(p=>p.activity>=0&&p.activity<=100&&p.impact>=0&&p.impact<=100));
});

test('les secondes influencent la contribution à la fin de minute',()=>{
 const pass=(second)=>computePulse([{minute:10,second,kind:'Pass',outcome:'Complete'}],90).timeline;
 assert.ok(pass(59)[10].activity>pass(0)[10].activity);
 assert.ok(pass(0)[9].activity>0 && pass(0)[9].activity<50);
 assert.equal(pass(0)[10].gain,1);
});

test('activité et impact sont distincts, et un but ne vaut pas 45 points',()=>{
 assert.equal(PULSE_RULES.shortHalfLife,3);
 assert.equal(PULSE_RULES.longHalfLife,10);
 assert.deepEqual(pulseWeight({kind:'Pass',outcome:'Complete'}),{activity:1,impact:0.5});
 assert.equal(pulseWeight({kind:'Pass',outcome:'Incomplete'}).impact,0);
 assert.equal(pulseWeight({kind:'Shot',outcome:'Goal'}).activity,5.5);
 const {timeline}=computePulse([{minute:80,second:5,kind:'Shot',outcome:'Goal'}],90);
 assert.ok(timeline[80].activity>0&&timeline[80].activity<45);
 assert.ok(timeline[80].impact>timeline[79].impact);
});

test('le profil n’existe qu’entre l’entrée et la sortie',()=>{
 const timeline=computePulse([{minute:2,second:12,kind:'Pass',outcome:'Complete'},{minute:61,second:1,kind:'Pass',outcome:'Complete'}],90,{entry:60,exit:70}).timeline;
 assert.equal(timeline[59].activity,null);
 assert.equal(timeline[60].activity,50);
 assert.ok(timeline[61].activity>0);
 assert.equal(timeline[70].activity,null);
 assert.equal(timeline[90].impact,null);
});

test('la vue équipe est autonome et moyenne seulement les joueurs présents',()=>{
 const match={duration:6,players:[{id:1,name:'A',entry:0,exit:null},{id:2,name:'B',entry:3,exit:5}],actions:[
  {p:1,m:1,s:0,k:'Dribble',o:'Complete'},
  {p:2,m:3,s:0,k:'Pass',o:'Complete'}
 ]};
 const {team,profiles}=computeMatchProfiles(match);
 assert.equal(profiles.length,2);
 assert.equal(team[1].players,1);
 assert.equal(team[3].players,2);
 assert.equal(team[5].players,1);
 assert.equal(profiles[1].timeline[2].activity,null);
 assert.equal(team[3].activity,Number(((profiles[0].timeline[3].activity+profiles[1].timeline[3].activity)/2).toFixed(1)));
});
test('au coup d’envoi et à chaque entrée, chaque joueur commence à 50, puis redescend si le jeu est calme',()=>{
 assert.equal(PULSE_RULES.entryIndex,50);
 assert.equal(PULSE_RULES.entryHalfLife,25);
 const quiet=computePulse([],90).timeline;
 assert.equal(quiet[0].activity,50);
 assert.equal(quiet[25].activity,25);
 assert.ok(quiet[45].activity<25);
 assert.ok(quiet[90].activity>0 && quiet[90].activity<10);
 const sub=computePulse([],90,{entry:61,exit:84}).timeline;
 assert.equal(sub[60].activity,null);
 assert.equal(sub[61].activity,50);
 assert.ok(sub[71].activity<50);
 assert.equal(sub[84].activity,null);
});
test('un geste raté conserve une impulsion d’activité mais subit un faible malus',()=>{
 assert.equal(pulsePenalty({kind:'Pass',outcome:'Incomplete'}),0.15);
 assert.equal(pulsePenalty({kind:'Dribble',outcome:'Incomplete'}),0.65);
 assert.equal(pulsePenalty({kind:'Dispossessed',outcome:''}),0.45);
 const fail={minute:20,second:30,kind:'Dribble',outcome:'Incomplete'};
 const success={...fail,outcome:'Complete'};
 const missed=computePulse([fail],60).timeline;
 const won=computePulse([success],60).timeline;
 const quiet=computePulse([],60).timeline;
 assert.ok(missed[20].activity>quiet[20].activity,'tenter un dribble reste de l’activité');
 assert.ok(missed[20].activity<won[20].activity,'la réussite a un léger avantage');
 assert.equal(missed[20].penaltyGain,0.65);
 assert.equal(missed[19].activity,quiet[19].activity,'aucune fuite vers le passé');
 const dispossessed=computePulse([{minute:20,second:30,kind:'Dispossessed',outcome:''}],60).timeline;
 assert.ok(dispossessed[20].activity<quiet[20].activity,'une perte de balle peut faire légèrement descendre le score');
 assert.ok(dispossessed[20].activity>quiet[20].activity-2,'le malus reste modéré');
});
test('bandes visuelles stables sur des seuils 25 et 75, tous scores bornés',()=>{
 assert.equal(pulseBand(null),'off');
 assert.equal(pulseBand(0),'low');
 assert.equal(pulseBand(24.99),'low');
 assert.equal(pulseBand(25),'steady');
 assert.equal(pulseBand(75),'steady');
 assert.equal(pulseBand(75.01),'high');
 assert.equal(PULSE_BANDS.high.min,75);
 const pile=Array.from({length:200},(_,i)=>({minute:4,second:i%60,kind:'Dispossessed',outcome:''}));
 assert.ok(computePulse(pile,90).timeline.every(p=>p.activity>=0 && p.activity<=100));
});
