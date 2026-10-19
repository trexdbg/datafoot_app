/**
 * Rebuild the complete 2022 World Cup dataset from StatsBomb Open Data.
 * Usage: node scripts/build-worldcup-2022.mjs
 * Inputs are always fetched from the public upstream. Never invent events.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const ROOT='https://raw.githubusercontent.com/hudl/open-data/master/data';
const DIR='src/data/worldcup';
const PUBLIC='public/data/worldcup-2022';
async function loadJson(url) {
  let error;
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const res=await fetch(url,{signal:AbortSignal.timeout(60000)});
      if(!res.ok) throw new Error('HTTP '+res.status+' '+url);
      return await res.json();
    } catch(e) {
      error=e;
      await new Promise(resolve=>setTimeout(resolve,600*(attempt+1)));
    }
  }
  throw error;
}
export function compactFixture(m) {
  return {
    id:m.match_id,date:m.match_date,stage:m.competition_stage.name,
    home:m.home_team.home_team_name,away:m.away_team.away_team_name,
    homeCode:m.home_team.country.id,awayCode:m.away_team.country.id,
    homeScore:m.home_score,awayScore:m.away_score,
    group:m.competition_stage.name==='Group Stage'?(m.home_team.home_team_group||m.away_team.away_team_group):null,
    source:'https://github.com/hudl/open-data/blob/master/data/events/'+m.match_id+'.json'
  };
}
export function compactMatch(fixture,raw) {
  const teams=[fixture.home,fixture.away];
  const roster=new Map();
  const add=(player,team,entry=0,position='')=>{
    if(!player?.id)return;
    const existing=roster.get(player.id);
    if(existing){
      // Ne jamais écraser l'entrée d'un remplaçant par un événement ultérieur.
      if(position&&!existing.position)existing.position=position;
      return existing;
    }
    const item={id:player.id,name:player.name,team,entry,exit:null,position};
    roster.set(item.id,item);return item;
  };
  for(const event of raw) {
    if(event.period>4)continue;
    if(event.type?.name==='Starting XI') {
      for(const p of event.tactics?.lineup||[])add(p.player,event.team.name,0,p.position?.name||'');
    }
    if(event.type?.name==='Substitution'){
      const minute=Math.max(0,event.minute+1);
      const leaving=add(event.player,event.team.name,0);
      if(leaving)leaving.exit=minute;
      add(event.substitution?.replacement,event.team.name,minute);
    }
    // A red card ends an individual's activity even without a substitution.
    const card=event.bad_behaviour?.card?.name||event.foul_committed?.card?.name;
    if(card==='Red Card'||card==='Second Yellow'){
      const leaving=add(event.player,event.team?.name,0);
      if(leaving)leaving.exit=event.minute+1;
    }
  }
  const actions=[];
  const goals=[];
  let duration=90;
  for(const e of raw){
    if(e.period>4)continue;
    const minute=e.minute+1;
    duration=Math.max(duration,minute);
    const kind=e.type?.name;
    if(kind==='Shot'&&e.shot?.outcome?.name==='Goal')
      goals.push({minute,second:e.second,playerId:e.player?.id??null,team:e.team?.name,kind:'goal'});
    if(kind==='Own Goal Against')
      goals.push({minute,second:e.second,playerId:e.player?.id??null,team:teams.find(n=>n!==e.team?.name),kind:'own-goal'});
    if(!e.player?.id||!teams.includes(e.team?.name)||kind==='Substitution'||kind==='Player On'||kind==='Player Off')continue;
    add(e.player,e.team.name,0,e.position?.name||'');
    const outcome=kind==='Pass'?(e.pass?.outcome?.name||'Complete')
      :kind==='Dribble'?(e.dribble?.outcome?.name||'Complete')
      :kind==='Shot'?(e.shot?.outcome?.name||'')
      :kind==='Duel'?(e.duel?.outcome?.name||'')
      :kind==='Goal Keeper'?(e.goalkeeper?.type?.name||'')
      :'';
    const location=Array.isArray(e.location)?e.location.slice(0,2).map(Math.round):null;
    const end=kind==='Pass'&&Array.isArray(e.pass?.end_location)?e.pass.end_location.slice(0,2).map(Math.round):null;
    const a={p:e.player.id,m:minute,s:e.second,k:kind,o:outcome};
    // Assists de but validées par StatsBomb : aucune inférence par proximité temporelle.
    // "shot_assist" (passe créant un tir) est une catégorie distincte.
    if(kind==='Duel'&&e.duel?.type?.name)a.t=e.duel.type.name;
    if(kind==='Pass'&&e.pass?.goal_assist===true)a.ga=1;
    else if(kind==='Pass'&&e.pass?.shot_assist===true)a.sa=1;
    if(location)a.l=location;
    if(end)a.e=end;
    if(kind==='Shot'&&Number.isFinite(e.shot?.statsbomb_xg))a.xg=Number(e.shot.statsbomb_xg.toFixed(4));
    actions.push(a);
  }
  const players=[...roster.values()].filter(p=>teams.includes(p.team)).sort((a,b)=>a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
  // An event may contain a substitute without an explicit "Substitution".
  // In that case fall back to its first observed minute, without implying it started.
  for(const player of players) {
    if(player.entry===0 && !raw.some(e=>e.type?.name==='Starting XI'&&e.tactics?.lineup?.some(p=>p.player.id===player.id))){
      const first=actions.find(a=>a.p===player.id);
      if(first)player.entry=first.m;
    }
    if(player.exit!=null&&player.exit<=player.entry)player.exit=null;
  }
  return {id:fixture.id,date:fixture.date,stage:fixture.stage,group:fixture.group,
    home:fixture.home,away:fixture.away,homeScore:fixture.homeScore,awayScore:fixture.awayScore,
    duration,players,actions,goals,source:fixture.source};
}
async function main() {
  const fixtures=(await loadJson(ROOT+'/matches/43/106.json')).map(compactFixture)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  if(fixtures.length!==64)throw new Error('Expected 64 fixtures, got '+fixtures.length);
  await mkdir(path.join(DIR,'2022'),{recursive:true});
  await mkdir(path.join(PUBLIC,'matches'),{recursive:true});
  const teams=[...new Set(fixtures.flatMap(f=>[f.home,f.away]))];
  if(teams.length!==32)throw new Error('Expected 32 teams, got '+teams.length);
  const fixtureIndex={
    version:2,source:'StatsBomb Open Data / Hudl',competition:'2022 FIFA World Cup',
    totalMatches:64,totalCountries:32,
    coverage:'Both teams; periods 1–4 only; penalty shootout excluded',matches:fixtures
  };
  await writeFile(path.join(DIR,'2022-matches.json'),JSON.stringify(fixtureIndex));
  await writeFile(path.join(PUBLIC,'index.json'),JSON.stringify(fixtureIndex));
  const directory=new Map();
  let count=0;
  // Controlled network fanout: lower risk of GitHub rate limits than 64 simultaneous requests.
  for(let start=0;start<fixtures.length;start+=5){
    const group=fixtures.slice(start,start+5);
    const matches=await Promise.all(group.map(async(fixture)=>{
      const events=await loadJson(ROOT+'/events/'+fixture.id+'.json');
      const match=compactMatch(fixture,events);
      const data=JSON.stringify(match);
      await writeFile(path.join(DIR,'2022',fixture.id+'.json'),data);
      await writeFile(path.join(PUBLIC,'matches',fixture.id+'.json'),data);
      return match;
    }));
    for(const match of matches) {
      count++;
      for(const player of match.players) {
        const k=String(player.id);
        if(!directory.has(k))directory.set(k,{id:player.id,name:player.name,country:player.team,matches:[]});
        directory.get(k).matches.push({id:match.id,date:match.date,opponent:match.home===player.team?match.away:match.home});
      }
    }
    console.log('Processed',count,'/',fixtures.length,'matches');
  }
  const directoryJson=JSON.stringify([...directory.values()].sort((a,b)=>a.name.localeCompare(b.name)));
  await writeFile(path.join(DIR,'2022-players.json'),directoryJson);
  await writeFile(path.join(PUBLIC,'players.json'),directoryJson);
  console.log('Full WC 2022:',fixtures.length,'matches,',teams.length,'countries,',directory.size,'players');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error);process.exitCode=1;});
