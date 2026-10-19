/**
 * DataFoot Pulse thermal palette.
 * Only an activity visualization: it does not modify Pulse ratings.
 *
 * Vertical SVG gradients map score (Y, 0–100) directly to color.
 * Never use this palette to distinguish teams in a match comparison,
 * or to style the separate indicative Impact metric.
 */
export const THERMAL_STOPS=Object.freeze([
 Object.freeze({at:0,color:'#F8FCFF',name:'Blanc froid'}),
 Object.freeze({at:20,color:'#FFF4BA',name:'Jaune pâle'}),
 Object.freeze({at:40,color:'#FFD451',name:'Jaune'}),
 Object.freeze({at:60,color:'#FF9B3D',name:'Orange'}),
 Object.freeze({at:75,color:'#FF514F',name:'Rouge'}),
 Object.freeze({at:90,color:'#BF4DFF',name:'Violet'}),
 Object.freeze({at:100,color:'#7739F9',name:'Violet intense'})
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
 if(score<40)return 'Réchauffement';
 if(score<60)return 'Actif';
 if(score<75)return 'Chaud';
 if(score<90)return 'Très chaud';
 return 'En feu';
}
export const THERMAL_GRADIENT='linear-gradient(90deg,'+THERMAL_STOPS.map(stop=>stop.color+' '+stop.at+'%').join(',')+')';
