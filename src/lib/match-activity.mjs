import {pulseRole,pulsePoints} from './pulse-scoring.mjs';

// Indice éditorial d'activité d'un joueur, sans données physiques.
export const ACTIVITY_RULES = Object.freeze({start: 50, decay: 1, pass: 5, dribble: 5, goal: 45, floor: 0});

export function actionImpact(action) {
  if (action.kind === 'Pass' && action.outcome === 'Complete') return ACTIVITY_RULES.pass;
  if (action.kind === 'Dribble' && action.outcome === 'Complete') return ACTIVITY_RULES.dribble;
  if (action.kind === 'Shot' && action.outcome === 'Goal') return ACTIVITY_RULES.goal;
  return 0;
}

export function actionLabel(action) {
  const kind = action.kind;
  if (kind === 'Pass') return action.goalAssist ? 'Passe décisive' : action.shotAssist ? 'Passe créant un tir' : (action.outcome === 'Complete' ? 'Passe réussie' : 'Passe non réussie');
  if (kind === 'Dribble') return action.outcome === 'Complete' ? 'Dribble réussi' : 'Dribble manqué';
  if (kind === 'Shot') return action.outcome === 'Goal' ? 'But' : (action.outcome === 'Blocked' ? 'Tir contré' : 'Tir (' + action.outcome + ')');
  return ({
    'Carry': 'Conduite de balle', 'Ball Receipt*': 'Réception', 'Ball Recovery': 'Récupération',
    'Pressure': 'Pressing', 'Miscontrol': 'Contrôle manqué', 'Block': 'Contre',
    'Foul Committed': 'Faute commise',
  })[kind] || kind;
}

export function computeActivity(events, duration = 125, {entry = 0, exit = duration + 1} = {}) {
  const byMinute = Array.from({length: duration + 1}, () => []);
  for (const event of events) {
    if (Number.isInteger(event.minute) && event.minute >= 0 && event.minute <= duration)
      byMinute[event.minute].push(event);
  }
  let activity = ACTIVITY_RULES.start;
  const timeline = byMinute.map((items, minute) => {
    if (minute < entry || minute >= exit) return {minute, activity: null, gain: 0, actions: 0, events: []};
    if (minute > entry) activity = Math.max(ACTIVITY_RULES.floor, activity - ACTIVITY_RULES.decay);
    const gain = items.reduce((sum, event) => sum + actionImpact(event), 0);
    activity += gain;
    return {minute, activity, gain, actions: items.length, events: items};
  });
  return {timeline, byMinute};
}

// DataFoot Pulse V3 : deux mémoires causales, indices 0–100 à échelle fixe.
// Ces poids sont des choix éditoriaux, PAS un modèle xT/VAEP appris.
export const PULSE_RULES = Object.freeze({
  shortHalfLife: 3, longHalfLife: 10, shortMix: 0.65,
  entryIndex: 50, entryHalfLife: 25,
  activityScale: 14, impactScale: 8
});

export function pulseWeight(action, position = '') {
  const role=pulseRole(position),kind=action.kind,complete=action.outcome==='Complete';
  const pt=key=>pulsePoints(key,role);
  if(kind==='Pass') {
    const progress=Array.isArray(action.location)&&Array.isArray(action.endLocation)
      ?Math.max(0,action.endLocation[0]-action.location[0]):0;
    if(complete&&action.goalAssist)return {activity:pt('assist'),impact:10};
    if(complete&&action.shotAssist)return {activity:pt('chance'),impact:Number((1.5+Math.min(1.5,progress/30)).toFixed(2))};
    return {activity:pt(complete?'pass':'missedPass'),impact:complete?Number((0.5+Math.min(2.4,progress/18)).toFixed(2)):0};
  }
  if(kind==='Dribble')return {activity:pt(complete?'dribble':'missedDribble'),impact:complete?3.2:0};
  if(kind==='Shot') {
    const xg=Number.isFinite(action.xg)?Math.min(1,Math.max(0,action.xg)):null;
    // Même impulsion de base pour un but et une passe décisive, à tout poste.
    if(action.outcome==='Goal')return {activity:pt('goal'),impact:10};
    return {activity:pt('shot'),impact:xg==null?(action.outcome==='Blocked'?0.6:2):Number((1.2+7*xg).toFixed(2))};
  }
  if(kind==='Interception')return {activity:pt('interception'),impact:role==='defense'?3.2:1.3};
  if(kind==='Ball Recovery')return {activity:pt('recovery'),impact:role==='defense'?2:1.2};
  if(kind==='Duel') {
    const won=['Won','Won In Play','Success'].includes(action.outcome);
    const key=won?(action.subtype==='Tackle'?'tackle':'duel'):'lostDuel';
    return {activity:pt(key),impact:won?(role==='defense'?3.2:2):0.25};
  }
  if(kind==='Clearance')return {activity:pt('clearance'),impact:role==='defense'?2:0.6};
  if(kind==='Block')return {activity:pt('block'),impact:role==='defense'?2.2:0.6};
  if(kind==='Goal Keeper') {
    const saved=/saved|save|claim|smother/i.test(action.outcome||'');
    return {activity:pt(saved?'save':'keeper'),impact:saved?4:0.8};
  }
  if(kind==='Pressure')return {activity:pt('pressure'),impact:role==='defense'?0.5:0.25};
  if(kind==='Carry')return {activity:pt('carry'),impact:0.1};
  if(kind==='Ball Receipt*')return {activity:0.3,impact:0};
  if(kind==='Miscontrol'||kind==='Foul Committed'||kind==='Dribbled Past')
    return {activity:0.4,impact:0};
  return {activity:0.3,impact:0};
}

// Bandes visuelles : niveaux de l'indice, pas pente mathématique de la courbe.
export const PULSE_BANDS = Object.freeze({
  low: Object.freeze({max:25,color:'#8A9DB8',label:'Rythme discret'}),
  steady: Object.freeze({min:25,max:75,color:'#52D3EF',label:'Dans le jeu'}),
  high: Object.freeze({min:75,color:'#B8F27C',label:'Temps fort'})
});
export function pulseBand(value) {
  if(value == null) return 'off';
  if(value < 25) return 'low';
  if(value > 75) return 'high';
  return 'steady';
}

/**
 * Les erreurs sont de petites résistances, pas des pénalités de performance.
 * Une tentative ratée reste de l'activité : le malus NE remplace PAS son impulsion.
 * Un seul malus par événement (pas de double comptage).
 */
export function pulsePenalty(action) {
  if(action.kind==='Pass' && action.outcome!=='Complete') return 0.15;
  if(action.kind==='Dribble' && action.outcome!=='Complete') return 0.65;
  if(action.kind==='Shot' && action.outcome!=='Goal') return action.outcome==='Blocked'?0.12:0.2;
  if(action.kind==='Miscontrol') return 0.3;
  if(action.kind==='Dispossessed') return 0.45;
  if(action.kind==='Foul Committed') return 0.3;
  if(action.kind==='Dribbled Past') return 0.3;
  if(action.kind==='Duel' && (action.outcome==='Lost'||action.outcome==='Lost In Play')) return 0.25;
  return 0;
}

const pulseIndex = (value, scale) => Number((100 * (1 - Math.exp(-Math.max(0,value)/scale))).toFixed(1));

/**
 * Somme d'impulsions exponentielles avec résolution des secondes disponibles.
 * Le score à la minute m correspond à la fin de l'intervalle [m, m+1[ :
 * les événements futurs n'influencent jamais le passé.
 */
export function computePulse(events, duration = 125, {entry = 0, exit = duration + 1, position = ''} = {}) {
  const byMinute = Array.from({length:duration+1},()=>[]);
  for(const event of events) {
    if(Number.isInteger(event.minute) && event.minute>=0 && event.minute<=duration)
      byMinute[event.minute].push(event);
  }
  const rules=PULSE_RULES;
  const fastDecay=Math.pow(2,-1/rules.shortHalfLife);
  const slowDecay=Math.pow(2,-1/rules.longHalfLife);
  let activityFast=0,activitySlow=0,impactFast=0,impactSlow=0;
  let penaltyFast=0,penaltySlow=0;
  const timeline=byMinute.map((all,minute)=>{
    if(minute<entry || minute>=exit) return {minute,activity:null,impact:null,gain:0,penaltyGain:0,impactGain:0,actions:0,events:[]};
    if(minute>entry){
      activityFast*=fastDecay; activitySlow*=slowDecay;
      impactFast*=fastDecay; impactSlow*=slowDecay;
      penaltyFast*=fastDecay; penaltySlow*=slowDecay;
    }
    const items=all.filter(event=>event.minute>=entry && event.minute<exit);
    let gain=0, penaltyGain=0, impactGain=0;
    for(const event of items){
      const weight=pulseWeight(event,position);
      const penalty=pulsePenalty(event);
      // À l'intérieur de la minute, un événement plus tôt a légèrement plus décru.
      const elapsed=1-Math.max(0,Math.min(59,Number(event.second)||0))/60;
      const a=Math.pow(2,-elapsed/rules.shortHalfLife);
      const b=Math.pow(2,-elapsed/rules.longHalfLife);
      activityFast+=weight.activity*a;
      activitySlow+=weight.activity*b;
      impactFast+=weight.impact*a;
      impactSlow+=weight.impact*b;
      penaltyFast+=penalty*a;
      penaltySlow+=penalty*b;
      penaltyGain+=penalty;
      gain+=weight.activity;
      impactGain+=weight.impact;
    }
    const mix=rules.shortMix;
    const activityEnergy=mix*(activityFast-penaltyFast)+(1-mix)*(activitySlow-penaltySlow);
    // Chaque joueur ENTRE à 50/100. Sans actions ce capital décroît naturellement.
    // Les impulsions occupent l'espace restant vers 100 ; un excès de malus
    // peut diminuer légèrement le score même en absence de gestes réussis.
    const initialEnergy=rules.entryIndex*Math.pow(2,-Math.max(0,minute-entry)/rules.entryHalfLife);
    const activityIndex=activityEnergy>=0
      ?initialEnergy+(100-initialEnergy)*(1-Math.exp(-activityEnergy/rules.activityScale))
      :initialEnergy*Math.exp(activityEnergy/rules.activityScale);
    return {
      minute,
      activity:Number(Math.max(0,Math.min(100,activityIndex)).toFixed(1)),
      impact:pulseIndex(mix*impactFast+(1-mix)*impactSlow,rules.impactScale),
      gain:Number(gain.toFixed(2)),penaltyGain:Number(penaltyGain.toFixed(2)),impactGain:Number(impactGain.toFixed(2)),
      actions:items.length,events:items
    };
  });
  return {timeline,byMinute};
}

// Interpolation cubique monotone : évite les dépassements sous 0 ou entre
// les points, tout en conservant EXACTEMENT les valeurs à chaque minute.
export function monotonePath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / (p.x - points[i].x));
  const tangent = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes.at(-1);
    const a = slopes[i - 1], b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i], q = points[i+1], third = (q.x-p.x)/3;
    path += ` C ${(p.x+third).toFixed(2)} ${(p.y+tangent[i]*third).toFixed(2)} ${(q.x-third).toFixed(2)} ${(q.y-tangent[i+1]*third).toFixed(2)} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
  }
  return path;
}


/** Lissage du TRACÉ seulement : le curseur et la donnée restent exacts. */
export function smoothVisual(timeline, sigma = 1.55) {
  const radius = Math.ceil(3 * sigma);
  return timeline.map((p, i) => {
    if (p.activity == null) return {...p};
    let total = 0, weight = 0;
    for(let j = Math.max(0,i-radius);j<=Math.min(timeline.length-1,i+radius);j++) {
      if(timeline[j].activity == null) continue;
      const w = Math.exp(-0.5*((i-j)/sigma)**2);
      total+=timeline[j].activity*w;weight+=w;
    }
    return {...p, activity:Math.max(0,total/weight)};
  });
}

/** Reconstitution d'un profil par joueur et de la moyenne des joueurs présents. */
export function computeMatchProfiles(match) {
  const profiles = match.players.map(player => {
    const actions = match.actions.filter(a=>a.p===player.id).map(a=>({
      minute:a.m,second:a.s,kind:a.k,outcome:a.o,playerId:a.p,
      location:a.l,endLocation:a.e,xg:a.xg,goalAssist:a.ga===1,shotAssist:a.sa===1,subtype:a.t
    }));
    const {timeline} = computePulse(actions,match.duration,{entry:player.entry,exit:player.exit??match.duration+1,position:player.position??''});
    return {player,actions,timeline};
  });
  const team = Array.from({length:match.duration+1},(_, minute)=>{
    const active=profiles.map(p=>p.timeline[minute]).filter(p=>p.activity!=null);
    return {minute, activity:active.length?Number((active.reduce((sum,p)=>sum+p.activity,0)/active.length).toFixed(1)):0,impact:active.length?Number((active.reduce((sum,p)=>sum+(p.impact??0),0)/active.length).toFixed(1)):0,actions:active.reduce((sum,p)=>sum+p.actions,0),players:active.length};
  });
  return {team, profiles};
}
