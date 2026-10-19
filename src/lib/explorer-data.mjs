import raw from '../data/matches/france-world-cup-2022.json' with {type:'json'};
import {computeMatchProfiles} from './match-activity.mjs';

const nations = {Argentina:'Argentine',Australia:'Australie',Denmark:'Danemark',England:'Angleterre',Morocco:'Maroc',Poland:'Pologne',Tunisia:'Tunisie'};
export const country = name => nations[name]||name;
export const games = raw.matches.map(match=>({
 ...match, ...computeMatchProfiles(match)
})).sort((a,b)=>a.date.localeCompare(b.date));
export const mbappeId = 3009;
export const playerList = [...new Map(games.flatMap(g=>g.players).map(p=>[p.id,p])).values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
// Les indices Pulse sont saturés sur 0–100 avec une échelle identique pour tous.
export const teamMbappeScale = 100;
export const playerComparisonScale = () => 100;
export const matchComparisonScale = () => 100;
export const commonScale = 100;
export const pulsePeak = (timeline, metric='activity') => timeline.filter(p=>p[metric]!=null).reduce((best,p)=>!best||p[metric]>best[metric]?p:best,null);
export const pulseAverage = (timeline, metric='activity') => {
 const active=timeline.filter(p=>p[metric]!=null);
 return active.length?Number((active.reduce((n,p)=>n+p[metric],0)/active.length).toFixed(1)):0;
};
export const opposingTeam = game => country(game.home==='France'?game.away:game.home);
export const matchTitle = game => country(game.home)+' '+game.homeScore+'–'+game.awayScore+' '+country(game.away);
export const matchHref = (base,game) => base+'/matchs/coupe-du-monde-2022/'+game.id+'/';
export const playerHref = (base,id) => base+'/joueurs/'+(id===mbappeId?'mbappe':id)+'/';
/** @param {string} base @param {{id:number}} game @param {string|number} [id] */
export const matchProfileHref = (base,game,id='france') => base+'/matchs/coupe-du-monde-2022/'+game.id+'/profils/'+id+'/';
export const formattedDate = date => new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export const getProfile = (game,id) => game.profiles.find(p=>p.player.id===id);
export const teamGoals = game => game.goals.filter(g=>g.team==='France').map(g=>g.minute);
export const playerGoals = (game,id) => game.actions.filter(a=>a.p===id&&a.k==='Shot'&&a.o==='Goal').map(a=>a.m);
export const playedGames = id => games.filter(g=>g.profiles.some(p=>p.player.id===id));
