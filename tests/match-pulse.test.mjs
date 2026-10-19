import test from 'node:test';
import {pulseRole,pulsePoints,PULSE_SCORE_ROWS} from '../src/lib/pulse-scoring.mjs';
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

test('un but lance un temps fort mais l’activité revient progressivement à la normale',()=>{
 assert.equal(PULSE_RULES.shortHalfLife,2.8);
 assert.equal(PULSE_RULES.longHalfLife,9);
 assert.deepEqual(pulseWeight({kind:'Pass',outcome:'Complete'}),{activity:0.8,impact:0.5});
 assert.equal(pulseWeight({kind:'Pass',outcome:'Incomplete'}).impact,0);
 assert.equal(pulseWeight({kind:'Shot',outcome:'Goal'}).activity,28);
 const {timeline}=computePulse([{minute:80,second:5,kind:'Shot',outcome:'Goal'}],90);
 assert.ok(timeline[80].activity>60&&timeline[80].activity<100);
 assert.ok(timeline[83].activity<timeline[80].activity);
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
 assert.equal(PULSE_RULES.entryHalfLife,22);
 const quiet=computePulse([],90).timeline;
 assert.equal(quiet[0].activity,50);
 assert.equal(quiet[22].activity,25);
 assert.ok(quiet[45].activity<25);
 assert.ok(quiet[90].activity>0 && quiet[90].activity<10);
 const sub=computePulse([],90,{entry:61,exit:84}).timeline;
 assert.equal(sub[60].activity,null);
 assert.equal(sub[61].activity,50);
 assert.ok(sub[71].activity<50);
 assert.equal(sub[84].activity,null);
});
test('un geste raté conserve une impulsion d’activité mais subit un faible malus',()=>{
 assert.equal(pulsePenalty({kind:'Pass',outcome:'Incomplete'}),2);
 assert.equal(pulsePenalty({kind:'Dribble',outcome:'Incomplete'}),4.5);
 assert.equal(pulsePenalty({kind:'Dispossessed',outcome:''}),5);
 const fail={minute:20,second:30,kind:'Dribble',outcome:'Incomplete'};
 const success={...fail,outcome:'Complete'};
 const missed=computePulse([fail],60).timeline;
 const won=computePulse([success],60).timeline;
 const quiet=computePulse([],60).timeline;
 assert.ok(missed[20].activity<quiet[20].activity,'un dribble raté crée un creux');
 assert.ok(missed[20].activity<won[20].activity,'la réussite se démarque clairement');
 assert.equal(missed[20].penaltyGain,4.5);
 assert.equal(missed[19].activity,quiet[19].activity,'aucune fuite vers le passé');
 const dispossessed=computePulse([{minute:20,second:30,kind:'Dispossessed',outcome:''}],60).timeline;
 assert.ok(dispossessed[20].activity<quiet[20].activity,'une perte de balle peut faire légèrement descendre le score');
 assert.ok(dispossessed[20].activity<quiet[20].activity-3,'la perte de balle crée une baisse visible');
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

test('une séquence de deux buts fait approcher 100 sans imposer le maximum',()=>{
 const t=computePulse([
  {minute:80,second:24,kind:'Shot',outcome:'Goal'},
  {minute:81,second:59,kind:'Shot',outcome:'Goal'}
 ],125).timeline;
 assert.ok(t[80].activity>75);
 assert.ok(t[81].activity>90 && t[81].activity<100);
 assert.ok(t[90].activity<t[81].activity);
 assert.equal(t[79].activity,Number((50*Math.pow(2,-79/22)).toFixed(1)));
});

test('un ballon perdu cause une chute courte qui se résorbe, sans toucher aux actions passées',()=>{
 const passes=[{minute:10,second:20,kind:'Pass',outcome:'Complete'}];
 const mistake={minute:12,second:58,kind:'Dispossessed',outcome:''};
 const base=computePulse(passes,30).timeline;
 const loss=computePulse([...passes,mistake],30).timeline;
 assert.equal(loss[11].activity,base[11].activity);
 assert.ok(loss[12].activity<=base[12].activity-4);
 assert.ok(loss[13].activity<base[13].activity);
 assert.ok(base[17].activity-loss[17].activity<base[12].activity-loss[12].activity);
 assert.equal(loss[12].penaltyGain,5);
 assert.equal(PULSE_RULES.penaltyHalfLife,1.5);
});
test('une passe décisive vaut exactement un but dans le barème Pulse',()=>{
 const passing={kind:'Pass',outcome:'Complete'};
 assert.deepEqual(pulseWeight(passing),{activity:0.8,impact:0.5});
 assert.equal(pulseWeight({...passing,goalAssist:true}).activity,28);
 assert.equal(pulseWeight({...passing,shotAssist:true}).activity,3.2);
 assert.equal(pulseWeight({kind:'Shot',outcome:'Goal'}).activity,28);
 const event={minute:35,second:44,...passing};
 const regular=computePulse([event],90).timeline;
 const assist=computePulse([{...event,goalAssist:true}],90).timeline;
 const key=computePulse([{...event,shotAssist:true}],90).timeline;
 const goal=computePulse([{minute:35,second:44,kind:'Shot',outcome:'Goal'}],90).timeline;
 assert.ok(assist[35].activity>key[35].activity);
 assert.ok(key[35].activity>regular[35].activity);
 assert.equal(goal[35].activity,assist[35].activity);
 assert.equal(goal[35].impact,assist[35].impact);
 assert.ok(assist[36].activity<assist[35].activity);
 assert.ok(assist.every(p=>p.activity==null||p.activity<=100));
});
test('le profil des joueurs conserve le statut de passe décisive depuis les données brutes',()=>{
 const source={duration:50,players:[{id:3,name:'Passeur',entry:0,exit:null}],actions:[
  {p:3,m:35,s:44,k:'Pass',o:'Complete',ga:1},
  {p:3,m:36,s:2,k:'Pass',o:'Complete',sa:1}
 ]};
 const {profiles}=computeMatchProfiles(source);
 assert.equal(profiles[0].actions[0].goalAssist,true);
 assert.equal(profiles[0].actions[1].shotAssist,true);
 assert.ok(profiles[0].timeline[35].activity>75);
});

test('barème selon le poste : interception/tacle du défenseur = dribble de l’attaquant',()=>{
 assert.equal(pulseRole('Right Center Back'),'defense');
 assert.equal(pulseRole('Left Back'),'defense');
 assert.equal(pulseRole('Left Defensive Midfield'),'midfield');
 assert.equal(pulseRole('Center Forward'),'attack');
 assert.equal(pulseRole('Goalkeeper'),'goalkeeper');
 assert.equal(pulseRole(''),'midfield');
 assert.equal(pulsePoints('interception','defense'),5);
 assert.equal(pulsePoints('tackle','defense'),5);
 assert.equal(pulsePoints('dribble','attack'),5);
 const intercept={kind:'Interception',outcome:''};
 const tackle={kind:'Duel',outcome:'Won',subtype:'Tackle'};
 const dribble={kind:'Dribble',outcome:'Complete'};
 assert.equal(pulseWeight(intercept,'Right Back').activity,pulseWeight(dribble,'Center Forward').activity);
 assert.equal(pulseWeight(tackle,'Right Center Back').activity,pulseWeight(dribble,'Center Forward').activity);
 assert.ok(pulseWeight(intercept,'Center Back').activity>pulseWeight(intercept,'Center Forward').activity);
 assert.equal(pulseWeight({kind:'Pass',outcome:'Complete',goalAssist:true},'Right Back').activity,28);
 assert.equal(pulseWeight({kind:'Shot',outcome:'Goal'},'Right Back').activity,28);
 assert.equal(pulseWeight({kind:'Goal Keeper',outcome:'Shot Saved'},'Goalkeeper').activity,7);
 assert.ok(PULSE_SCORE_ROWS.every(row=>Object.values(row.points).every(n=>n>=0)));
});

test('poste transmis à la timeline et moyenne équipe calculée sur les indices ajustés',()=>{
 const game={duration:15,players:[
  {id:10,name:'DC',position:'Right Center Back',entry:0,exit:null},
  {id:11,name:'BU',position:'Center Forward',entry:0,exit:null}
 ],actions:[
  {p:10,m:5,s:10,k:'Interception',o:''},
  {p:11,m:5,s:10,k:'Interception',o:''}
 ]};
 const {profiles,team}=computeMatchProfiles(game);
 assert.ok(profiles[0].timeline[5].activity>profiles[1].timeline[5].activity);
 assert.equal(team[5].activity,Number(((profiles[0].timeline[5].activity+profiles[1].timeline[5].activity)/2).toFixed(1)));
 assert.equal(profiles[0].timeline[5].gain,5);
 assert.ok(profiles[0].timeline.every(p=>p.activity===null||(p.activity>=0&&p.activity<=100)));
});

test('gardien inactif : 50 neutre à chaque minute, même après prolongations',()=>{
 assert.equal(PULSE_RULES.goalkeeperIdleIndex,50);
 const quiet=computePulse([],125,{position:'Goalkeeper'}).timeline;
 assert.ok(quiet.every(p=>p.activity===50 && p.impact===0));
 const substitute=computePulse([],90,{position:'goalkeeper',entry:55,exit:75}).timeline;
 assert.equal(substitute[54].activity,null);
 assert.equal(substitute[55].activity,50);
 assert.equal(substitute[74].activity,50);
 assert.equal(substitute[75].activity,null);
 // Le modèle des joueurs de champ conserve sa décroissance propre.
 assert.ok(computePulse([],90,{position:'Center Forward'}).timeline[80].activity<10);
});

test('gardien : arrêt, penalty arrêté, ballon capté et sortie sont récompensés sans punir les tirs subis',()=>{
 const weight=outcome=>pulseWeight({kind:'Goal Keeper',outcome},'Goalkeeper');
 assert.equal(weight('Shot Saved').activity,7);
 assert.ok(weight('Penalty Saved').activity>weight('Shot Saved').activity);
 assert.ok(weight('Collected').activity>weight('Keeper Sweeper').activity);
 assert.ok(weight('Keeper Sweeper').activity>weight('Goal Conceded').activity);
 assert.equal(weight('Goal Conceded').activity,0);
 assert.equal(weight('Shot Faced').activity,0);
 assert.equal(weight('Penalty Conceded').impact,0);
 const save=computePulse([{minute:33,second:35,kind:'Goal Keeper',outcome:'Shot Saved'}],125,{position:'Goalkeeper'}).timeline;
 assert.equal(save[32].activity,50);
 assert.ok(save[33].activity>50);
 assert.ok(save[34].activity<save[33].activity);
 assert.ok(save[124].activity>=50 && save[124].activity<50.1);
 const conceded=computePulse([{minute:46,second:5,kind:'Goal Keeper',outcome:'Goal Conceded'}],90,{position:'Goalkeeper'}).timeline;
 assert.equal(conceded[46].activity,50);
 assert.equal(conceded[46].impact,0);
});

test('la moyenne de l’équipe ne gonfle pas à cause du 50 neutre du gardien',()=>{
 const match={duration:90,players:[
  {id:1,name:'Gardien',position:'Goalkeeper',entry:0,exit:null},
  {id:2,name:'Attaquant',position:'Center Forward',entry:0,exit:null}
 ],actions:[{p:1,m:21,s:8,k:'Goal Keeper',o:'Shot Saved'}]};
 const {profiles,team}=computeMatchProfiles(match);
 assert.ok(profiles[0].timeline[80].activity>=50 && profiles[0].timeline[80].activity<50.2,'le souvenir d’un arrêt passé peut dépasser très légèrement 50');
 assert.ok(profiles[1].timeline[80].activity<10);
 assert.equal(team[80].activity,profiles[1].timeline[80].activity);
 assert.equal(team[80].players,1);
 assert.ok(profiles[0].timeline[21].activity>50);
});
