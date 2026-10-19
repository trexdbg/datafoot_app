/**
 * DataFoot Pulse thermal palette.
 * Only an activity visualization: it does not modify Pulse ratings.
 *
 * Vertical SVG gradients map score (Y, 0–100) directly to color.
 * Never use this palette to distinguish teams in a match comparison,
 * or to style the separate indicative Impact metric.
 */
export const THERMAL_STOPS=Object.freeze([
 Object.freeze({at:0,color:'#4E79EB',name:'Bleu froid'}),
 Object.freeze({at:20,color:'#38A8EC',name:'Bleu azur'}),
 Object.freeze({at:35,color:'#32BCCD',name:'Cyan'}),
 Object.freeze({at:50,color:'#50CC86',name:'Vert équilibré'}),
 Object.freeze({at:63,color:'#D9DA59',name:'Jaune'}),
 Object.freeze({at:75,color:'#FF9B4A',name:'Orange'}),
 Object.freeze({at:87,color:'#F95D69',name:'Rouge'}),
 Object.freeze({at:95,color:'#BA65E9',name:'Violet'}),
 Object.freeze({at:100,color:'#8A50F2',name:'Violet intense'})
]);

function rgb(hex) {
 return [1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
}
export function thermalColor(score) {
 if(score==null||!Number.isFinite(score))return '#34465A';
 const value=Math.max(0,Math.min(100,score));
 const high=THERMAL_STOPS.findIndex(stop=>stop.at>=value);
 if(high<=0)return THERMAL_STOPS[0].color;
 const end=THERMAL_STOPS[high],start=THERMAL_STOPS[high-1];
 const t=(value-start.at)/(end.at-start.at);
 const a=rgb(start.color),b=rgb(end.color);
 return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function thermalLabel(score) {
 if(score==null||!Number.isFinite(score))return 'Hors terrain';
 if(score<20)return 'Froid';
 if(score<35)return 'Frais';
 if(score<60)return 'Équilibré';
 if(score<75)return 'Actif';
 if(score<87)return 'Chaud';
 if(score<95)return 'Très chaud';
 return 'En feu';
}
export const THERMAL_GRADIENT='linear-gradient(90deg,'+THERMAL_STOPS.map(stop=>stop.color+' '+stop.at+'%').join(',')+')';
