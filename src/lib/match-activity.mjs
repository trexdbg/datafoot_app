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
  if (kind === 'Pass') return action.outcome === 'Complete' ? 'Passe réussie' : 'Passe non réussie';
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
  activityScale: 14, impactScale: 8
});

export function pulseWeight(action) {
  const kind = action.kind, complete = action.outcome === 'Complete';
  if (kind === 'Pass') return {activity:complete?1:0.45, impact:complete?0.5:0};
  if (kind === 'Dribble') return {activity:complete?5:2.5, impact:complete?3.2:0};
  if (kind === 'Shot') return action.outcome === 'Goal'
    ? {activity:5.5, impact:10}
    : {activity:4, impact:action.outcome === 'Blocked'?0.6:2};
  if (kind === 'Ball Recovery' || kind === 'Interception') return {activity:2, impact:1};
  if (kind === 'Duel') return {activity:1.4, impact:0.45};
  if (kind === 'Pressure') return {activity:0.8, impact:0.25};
  if (kind === 'Carry') return {activity:0.65, impact:0.1};
  if (kind === 'Ball Receipt*') return {activity:0.3, impact:0};
  if (kind === 'Clearance' || kind === 'Block' || kind === 'Goal Keeper')
    return {activity:1.5, impact:0.5};
  if (kind === 'Miscontrol' || kind === 'Foul Committed' || kind === 'Dribbled Past')
    return {activity:0.4, impact:0};
  return {activity:0.3, impact:0};
}

const pulseIndex = (value, scale) => Number((100 * (1 - Math.exp(-Math.max(0,value)/scale))).toFixed(1));

/**
 * Somme d'impulsions exponentielles avec résolution des secondes disponibles.
 * Le score à la minute m correspond à la fin de l'intervalle [m, m+1[ :
 * les événements futurs n'influencent jamais le passé.
 */
export function computePulse(events, duration = 125, {entry = 0, exit = duration + 1} = {}) {
  const byMinute = Array.from({length:duration+1},()=>[]);
  for(const event of events) {
    if(Number.isInteger(event.minute) && event.minute>=0 && event.minute<=duration)
      byMinute[event.minute].push(event);
  }
  const rules=PULSE_RULES;
  const fastDecay=Math.pow(2,-1/rules.shortHalfLife);
  const slowDecay=Math.pow(2,-1/rules.longHalfLife);
  let activityFast=0,activitySlow=0,impactFast=0,impactSlow=0;
  const timeline=byMinute.map((all,minute)=>{
    if(minute<entry || minute>=exit) return {minute,activity:null,impact:null,gain:0,impactGain:0,actions:0,events:[]};
    if(minute>entry){
      activityFast*=fastDecay; activitySlow*=slowDecay;
      impactFast*=fastDecay; impactSlow*=slowDecay;
    }
    const items=all.filter(event=>event.minute>=entry && event.minute<exit);
    let gain=0, impactGain=0;
    for(const event of items){
      const weight=pulseWeight(event);
      // À l'intérieur de la minute, un événement plus tôt a légèrement plus décru.
      const elapsed=1-Math.max(0,Math.min(59,Number(event.second)||0))/60;
      const a=Math.pow(2,-elapsed/rules.shortHalfLife);
      const b=Math.pow(2,-elapsed/rules.longHalfLife);
      activityFast+=weight.activity*a;
      activitySlow+=weight.activity*b;
      impactFast+=weight.impact*a;
      impactSlow+=weight.impact*b;
      gain+=weight.activity;
      impactGain+=weight.impact;
    }
    const mix=rules.shortMix;
    return {
      minute,
      activity:pulseIndex(mix*activityFast+(1-mix)*activitySlow,rules.activityScale),
      impact:pulseIndex(mix*impactFast+(1-mix)*impactSlow,rules.impactScale),
      gain:Number(gain.toFixed(2)),impactGain:Number(impactGain.toFixed(2)),
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
      minute:a.m,second:a.s,kind:a.k,outcome:a.o,playerId:a.p
    }));
    const {timeline} = computePulse(actions,match.duration,{entry:player.entry,exit:player.exit??match.duration+1});
    return {player,actions,timeline};
  });
  const team = Array.from({length:match.duration+1},(_, minute)=>{
    const active=profiles.map(p=>p.timeline[minute]).filter(p=>p.activity!=null);
    return {minute, activity:active.length?Number((active.reduce((sum,p)=>sum+p.activity,0)/active.length).toFixed(1)):0,impact:active.length?Number((active.reduce((sum,p)=>sum+(p.impact??0),0)/active.length).toFixed(1)):0,actions:active.reduce((sum,p)=>sum+p.actions,0),players:active.length};
  });
  return {team, profiles};
}
