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

export function computeActivity(events, duration = 125) {
  const byMinute = Array.from({length: duration + 1}, () => []);
  for (const event of events) {
    if (Number.isInteger(event.minute) && event.minute >= 0 && event.minute <= duration)
      byMinute[event.minute].push(event);
  }
  let activity = ACTIVITY_RULES.start;
  const timeline = byMinute.map((items, minute) => {
    if (minute > 0) activity = Math.max(ACTIVITY_RULES.floor, activity - ACTIVITY_RULES.decay);
    const gain = items.reduce((sum, event) => sum + actionImpact(event), 0);
    activity += gain;
    return {minute, activity, gain, actions: items.length, events: items};
  });
  return {timeline, byMinute};
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
