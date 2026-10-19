import raw from '../data/matches/france-world-cup-2022.json' with {type:'json'};
import {computeMatchProfiles} from './match-activity.mjs';

const nations = {Argentina:'Argentine',Australia:'Australie',Denmark:'Danemark',England:'Angleterre',Morocco:'Maroc',Poland:'Pologne',Tunisia:'Tunisie'};
export const country = name => nations[name]||name;
export const games = raw.matches.map(match=>({
 ...match, ...computeMatchProfiles(match)
})).sort((a,b)=>a.date.localeCompare(b.date));
export const mbappeId = 3009;
export const playerList = [...new Map(games.flatMap(g=>g.players).map(p=>[p.id,p])).values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
const scaleFor = values => Math.max(150,Math.ceil(Math.max(...values)/50)*50);
export const teamMbappeScale = scaleFor(games.flatMap(g=>[...g.team.map(p=>p.activity),...(g.profiles.find(p=>p.player.id===mbappeId)?.timeline.map(p=>p.activity||0)||[])]));
export const playerComparisonScale = id => scaleFor(games.flatMap(g=>[...g.team.map(p=>p.activity),...(g.profiles.find(p=>p.player.id===id)?.timeline.map(p=>p.activity||0)||[])]));
export const matchComparisonScale = game => scaleFor([...game.team.map(p=>p.activity),...game.profiles.flatMap(p=>p.timeline.map(t=>t.activity||0))]);
export const commonScale = teamMbappeScale;
export const opposingTeam = game => country(game.home==='France'?game.away:game.home);
export const matchTitle = game => country(game.home)+' '+game.homeScore+'–'+game.awayScore+' '+country(game.away);
export const matchHref = (base,game) => base+'/matchs/coupe-du-monde-2022/'+game.id+'/';
export const playerHref = (base,id) => base+'/joueurs/'+(id===mbappeId?'mbappe':id)+'/';
export const formattedDate = date => new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export const getProfile = (game,id) => game.profiles.find(p=>p.player.id===id);
export const teamGoals = game => game.goals.filter(g=>g.team==='France').map(g=>g.minute);
export const playerGoals = (game,id) => game.actions.filter(a=>a.p===id&&a.k==='Shot'&&a.o==='Goal').map(a=>a.m);
export const playedGames = id => games.filter(g=>g.profiles.some(p=>p.player.id===id));
