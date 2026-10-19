// Barème éditorial du DataFoot Pulse : points d'impulsion, pas points sur 100.
// Une action pèse plus ou moins selon le poste déclaré par StatsBomb.
export const PULSE_ROLES = Object.freeze([
  {key:'attack',label:'Attaquant',short:'ATT'},
  {key:'midfield',label:'Milieu',short:'MIL'},
  {key:'defense',label:'Défenseur',short:'DÉF'},
  {key:'goalkeeper',label:'Gardien',short:'GAR'}
]);

const row = (key,label,attack,midfield,defense,goalkeeper,note='') =>
  Object.freeze({key,label,points:Object.freeze({attack,midfield,defense,goalkeeper}),note});

export const PULSE_SCORE_ROWS = Object.freeze([
  row('goal','But',28,28,28,28,'Même valeur qu’une passe décisive.'),
  row('assist','Passe décisive',28,28,28,28,'Assist confirmée par les événements StatsBomb.'),
  row('dribble','Dribble réussi',5,5,3,2,'Un geste fort pour un attaquant.'),
  row('interception','Interception',2,3.5,5,2.5,'Aussi valorisée qu’un dribble offensif chez un défenseur.'),
  row('tackle','Tacle réussi',2,3.5,5,2.5,'Sous-type Tackle si disponible dans la source.'),
  row('duel','Autre duel gagné',2.5,3.5,5,2.5,'Duel gagné lorsque le sous-type précis n’est pas connu.'),
  row('recovery','Récupération de balle',2,3.5,4.5,3),
  row('clearance','Dégagement',1,2,4,3.5),
  row('block','Contre défensif',1,2,4,3),
  row('penaltySave','Penalty arrêté',2,2,2,12,'Arrêt sur penalty pendant le jeu, hors séance de tirs au but.'),
  row('save','Arrêt du gardien',2,2,2,7,'Uniquement si le type d’arrêt est identifié.'),
  row('keeperClaim','Ballon capté / maîtrisé',1,1.2,1.5,4.5,'Capture, collecte ou ballon étouffé.'),
  row('keeperPunch','Dégagement aux poings',1,1.2,1.5,3.5),
  row('keeperSweep','Sortie / couverture',1,1.2,1.5,3.5,'Sortie du gardien dans le jeu.'),
  row('keeper','Autre action du gardien',1,1.2,1.5,2.3),
  row('chance','Passe créant un tir',3.2,3.2,2.5,1.5),
  row('pass','Passe réussie',0.8,0.8,0.8,0.7,'La quantité de passes ne doit pas saturer le score.'),
  row('shot','Tir non marqué',3.5,3.5,3,2.5),
  row('pressure','Pressing',1,1.3,1.5,0.7),
  row('carry','Conduite de balle',0.45,0.55,0.45,0.35),
  row('missedDribble','Dribble manqué',0.9,0.9,0.7,0.5,'Tentative valorisée légèrement, mais malus de perte de possession.'),
  row('missedPass','Passe manquée',0.3,0.3,0.3,0.25,'Le malus dépasse l’impulsion brute.'),
  row('lostDuel','Duel perdu',0.6,0.6,0.6,0.5,'Le duel perdu provoque un creux temporaire.')
]);
const rules=Object.fromEntries(PULSE_SCORE_ROWS.map(item=>[item.key,item.points]));
export const pulsePoints=(key,role='midfield')=>(rules[key]??{})[role]??rules[key]?.midfield??0;

export function pulseRole(position='') {
  const p=String(position||'').trim().toLowerCase();
  if(['attack','midfield','defense','goalkeeper'].includes(p))return p;
  if(/goal.?keeper|\bkeeper\b/.test(p))return 'goalkeeper';
  if(/back|defender|sweeper/.test(p))return 'defense';
  if(/midfield|midfielder|half/.test(p))return 'midfield';
  if(/forward|striker|winger|\bwing\b|attacker/.test(p))return 'attack';
  return 'midfield'; // Position non renseignée : barème neutre, sans inventer de poste.
}
export const pulseRoleLabel=(position='')=>PULSE_ROLES.find(r=>r.key===pulseRole(position))?.label??'Milieu';
