import fixturesRaw from '../data/worldcup/2022-matches.json';
import playersRaw from '../data/worldcup/2022-players.json';
import {computeMatchProfiles} from './match-activity.mjs';

export interface Action {p:number;m:number;s:number;k:string;o:string;l?:number[];e?:number[];xg?:number}
export interface Player {id:number;name:string;team:string;entry:number;exit:number|null;position:string}
export interface Goal {minute:number;second:number;playerId:number|null;team:string;kind:string}
export interface Match {
 id:number;date:string;stage:string;group:string|null;home:string;away:string;
 homeScore:number;awayScore:number;duration:number;players:Player[];
 actions:Action[];goals:Goal[];source:string
}
export interface Point {minute:number;activity:number|null;impact:number|null;actions?:number;players?:number;gain?:number;impactGain?:number}
export interface Profile {player:Player;actions:Array<{minute:number;second:number;kind:string;outcome:string;playerId:number}>;timeline:Point[]}
export interface EnrichedMatch extends Match {profiles:Profile[];team:Point[]}
export interface PlayerIndex {id:number;name:string;country:string;matches:Array<{id:number;date:string;opponent:string}>}
export interface Fixture {id:number;date:string;stage:string;home:string;away:string;homeScore:number;awayScore:number;group:string|null}
const files=import.meta.glob<{default:Match}>('../data/worldcup/2022/*.json',{eager:true});
export const games:EnrichedMatch[]=Object.values(files).map(f=>{
 const game=f.default;
 return {...game,...computeMatchProfiles(game)} as EnrichedMatch;
}).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
export const fixtures:Fixture[]=fixturesRaw.matches;
export const countries=[...new Set(fixtures.flatMap(m=>[m.home,m.away]))].sort((a,b)=>labelCountry(a).localeCompare(labelCountry(b),'fr'));
export const playerIndex=playersRaw as PlayerIndex[];
export const gameMap=new Map(games.map(g=>[g.id,g]));
export const playerMap=new Map(playerIndex.map(p=>[p.id,p]));
const translations:Record<string,string>={
 Argentina:'Argentine',Australia:'Australie',Belgium:'Belgique',Brazil:'Brésil',Cameroon:'Cameroun',
 Canada:'Canada','Costa Rica':'Costa Rica',Croatia:'Croatie',Denmark:'Danemark',
 Ecuador:'Équateur',England:'Angleterre',France:'France',Germany:'Allemagne',Ghana:'Ghana',
 Iran:'Iran',Japan:'Japon',Mexico:'Mexique',Morocco:'Maroc',Netherlands:'Pays-Bas',
 Poland:'Pologne',Portugal:'Portugal',Qatar:'Qatar','Saudi Arabia':'Arabie saoudite',
 Senegal:'Sénégal',Serbia:'Serbie','South Korea':'Corée du Sud',Spain:'Espagne',
 Switzerland:'Suisse',Tunisia:'Tunisie','United States':'États-Unis',Uruguay:'Uruguay',Wales:'Pays de Galles'
};
const flags:Record<string,string>={
 Argentina:'🇦🇷',Australia:'🇦🇺',Belgium:'🇧🇪',Brazil:'🇧🇷',Cameroon:'🇨🇲',Canada:'🇨🇦',
 'Costa Rica':'🇨🇷',Croatia:'🇭🇷',Denmark:'🇩🇰',Ecuador:'🇪🇨',England:'🏴',France:'🇫🇷',
 Germany:'🇩🇪',Ghana:'🇬🇭',Iran:'🇮🇷',Japan:'🇯🇵',Mexico:'🇲🇽',Morocco:'🇲🇦',
 Netherlands:'🇳🇱',Poland:'🇵🇱',Portugal:'🇵🇹',Qatar:'🇶🇦','Saudi Arabia':'🇸🇦',
 Senegal:'🇸🇳',Serbia:'🇷🇸','South Korea':'🇰🇷',Spain:'🇪🇸',Switzerland:'🇨🇭',
 Tunisia:'🇹🇳','United States':'🇺🇸',Uruguay:'🇺🇾',Wales:'🏴'
};
const stageLabels:Record<string,string>={
 'Group Stage':'Phase de groupes','Round of 16':'Huitième de finale','Quarter-finals':'Quart de finale',
 'Semi-finals':'Demi-finale','3rd Place Final':'Petite finale',Final:'Finale'
};
export const labelCountry=(name:string)=>translations[name]||name;
export const flag=(name:string)=>flags[name]||'⚽';
export const stageLabel=(stage:string)=>stageLabels[stage]||stage;
export const slug=(name:string)=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const countryOfSlug=(value:string)=>countries.find(c=>slug(c)===value);
export const dateLabel=(value:string)=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
export const titleMatch=(g:Fixture|Match)=>labelCountry(g.home)+' '+g.homeScore+'–'+g.awayScore+' '+labelCountry(g.away);
export const against=(g:Match,team:string)=>g.home===team?g.away:g.home;
export const matchUrl=(base:string,id:number)=>base+'/mondial-2022/matchs/'+id+'/';
export const playerUrl=(base:string,id:number)=>base+'/mondial-2022/joueurs/'+id+'/';
export const countryUrl=(base:string,team:string)=>base+'/mondial-2022/pays/'+slug(team)+'/';
export const detailUrl=(base:string,matchId:number,playerId:number)=>base+'/mondial-2022/matchs/'+matchId+'/profil/?joueur='+playerId;
export const profile=(game:EnrichedMatch,id:number)=>game.profiles.find(p=>p.player.id===id);
export const peak=(timeline:Point[],key:'activity'|'impact'='activity')=>timeline.filter(p=>p[key]!=null).reduce<Point|null>((a,b)=>!a||(b[key]??0)>(a[key]??0)?b:a,null);
export const mean=(timeline:Point[],key:'activity'|'impact'='activity')=>{
 const active=timeline.filter(p=>p[key]!=null);
 return active.length?Number((active.reduce((s,p)=>s+(p[key]??0),0)/active.length).toFixed(1)):0;
};
export const teamTimeline=(game:EnrichedMatch,teamName:string):Point[]=>
 Array.from({length:game.duration+1},(_,minute)=>{
  const active=game.profiles.filter(p=>p.player.team===teamName).map(p=>p.timeline[minute]).filter(p=>p?.activity!=null);
  const avg=(key:'activity'|'impact')=>active.length?Number((active.reduce((sum,p)=>sum+(p[key]??0),0)/active.length).toFixed(1)):0;
  return {minute,activity:avg('activity'),impact:avg('impact'),players:active.length,actions:active.reduce((sum,p)=>sum+(p.actions??0),0)};
 });
export const teamPlayers=(game:EnrichedMatch,team:string)=>game.profiles.filter(p=>p.player.team===team);
export const teamGoals=(game:EnrichedMatch,team:string)=>game.goals.filter(g=>g.team===team).map(g=>g.minute);
export const countryMatches=(team:string)=>games.filter(g=>g.home===team||g.away===team);
export const countryPlayers=(team:string)=>playerIndex.filter(p=>p.country===team);
export const playerGames=(id:number)=>games.filter(g=>g.players.some(p=>p.id===id));
