import { MESSI_ID, displayPlayerName, playerInitials, photoFor, photoCredits } from './messi-player-profiles.mjs';

/** Messi Pass Wars — Canvas 2D, événements StatsBomb réels seulement. */
// Critère : PLUS de 500 passes envoyées PAR MESSI VERS chaque partenaire.
// Le flux source conserve tous les partenaires ; seules les cibles éligibles
// apparaissent dans l'arène et sont animées dans les deux sens.
export const MIN_PARTNER_PASSES = 501;

export function eligiblePartners(events, minimum=MIN_PARTNER_PASSES, maximum=30){
  const tally = new Map();
  for(const e of events){
    if(e.direction!=='given' && e.direction!=='received') continue;
    const previous = tally.get(e.partner_id) || {
      id:e.partner_id,name:e.partner_name,given:0,received:0,total:0
    };
    previous[e.direction]++;
    previous.total++;
    tally.set(e.partner_id, previous);
  }
  return Array.from(tally.values())
    .filter(p=>p.given>=minimum)
    .sort((a,b)=>b.given-a.given || b.total-a.total || String(a.name).localeCompare(String(b.name)) || a.id-b.id)
    .slice(0,maximum);
}

// Identité chromatique indépendante du tri et des filtres.
// Utilise le numéro StatsBomb, jamais le classement : un même partenaire
// garde sa couleur entre la vue globale, les saisons et les compétitions.
export function playerColor(id){
  const value=Number(id);
  if(!Number.isFinite(value)) return '#cbe9f5';
  const n=Math.abs(Math.trunc(value));
  const hue=((n*137.50776405)%360).toFixed(3);
  const saturation=82+(n%4)*3;
  const lightness=58+(Math.floor(n/4)%4)*3;
  return 'hsl('+hue+' '+saturation+'% '+lightness+'%)';
}

// La palette générale est figée à partir des partenaires du jeu complet
// (tous les matchs publiés), et non du filtre en cours. L'espacement
// angulaire doré assure que Xavi, Busquets, Iniesta, etc. ne se ressemblent
// pas visuellement comme avec un hash direct de leurs identifiants.
export function createPlayerPalette(partners){
  const all=[...partners].sort((a,b)=>b.total-a.total||
    String(a.name).localeCompare(String(b.name))||a.id-b.id);
  return new Map(all.map((partner,index)=>{
    const hue=((15+index*137.50776405)%360).toFixed(3);
    const saturation=86+(index%3)*4;
    const lightness=59+(Math.floor(index/3)%3)*3;
    return [partner.id,'hsl('+hue+' '+saturation+'% '+lightness+'%)'];
  }));
}

/**
 * Disposition organique, indépendante du classement. Le sel de chargement
 * change le terrain à chaque visite mais reste fixe durant la lecture.
 * Portraits, capsules et noms restent dans l'arène sans chevauchement.
 * Aucun trait, aucune couronne régulière ni classement en horloge.
 */
export function layoutPlayerNodes(players, W=1200, H=780, CX=W/2, CY=H/2, sessionSeed=0){
  const result=new Map();
  const ids=[...players].sort((a,b)=>Number(a.id)-Number(b.id));
  const paddingX=105,paddingY=112;
  const salt=Number(sessionSeed)>>>0;
  for(const p of ids){
    let seed=(Math.imul(Number(p.id)||1,2654435761)^0x9e3779b9^salt)>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    let best=null,bestGap=-Infinity;
    for(let attempt=0;attempt<1800;attempt++){
      const x=paddingX+random()*(W-2*paddingX);
      const y=paddingY+random()*(H-2*paddingY);
      if(Math.hypot(x-CX,y-CY)<195)continue;
      const existing=[...result.values()];
      const closest=existing.length
        ? Math.min(...existing.map(point=>Math.hypot(x-point.x,y-point.y)))
        : 1000;
      const border=Math.min(x-paddingX,W-paddingX-x,y-paddingY,H-paddingY-y);
      const quality=closest+border*.1;
      if(quality>bestGap){bestGap=quality;best={x,y};}
      if(closest>=155&&border>17){best={x,y};break;}
    }
    if(best)result.set(p.id,best);
  }
  return result;
}

/**
 * La chronologie suit les mois réels couverts par les événements, et non
 * un faux calendrier de 57 matchs uniformément espacés.
 * Le slider peut traverser un mois sans aucun match : les totaux n'y changent pas.
 */
export function monthOrdinal(isoDate){
  const match=/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(String(isoDate??''));
  return match?Number(match[1])*12+Number(match[2])-1:null;
}
export function monthYearLabel(ordinal){
  if(ordinal===null||!Number.isInteger(ordinal)||ordinal<0)return '--/----';
  const year=Math.floor(ordinal/12),month=ordinal%12+1;
  return String(month).padStart(2,'0')+'/'+String(year).padStart(4,'0');
}
export function eventCalendarPosition(isoDate){
  const month=monthOrdinal(isoDate);
  if(month===null)return null;
  const date=/^\d{4}-\d{2}-(\d{2})$/.exec(String(isoDate));
  if(!date)return month;
  const days=new Date(Date.UTC(Math.floor(month/12),month%12+1,0)).getUTCDate();
  const day=Number(date[1]);
  return month+Math.max(0,Math.min(1,(day-1)/days));
}
/**
 * Un ID StatsBomb -> une courbure reproductible, indépendante du rechargement.
 * Le tir finit TOUJOURS au centre du bon destinataire.
 */
export function passEventSeed(event){
  const key=String(event?.id??event?.event_id??(
    String(event?.match_id??0)+':'+String(event?.index??0)+':'+String(event?.partner_id??0)));
  let hash=2166136261;
  for(let i=0;i<key.length;i++)
    hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;
  return hash;
}
export function curvedPassPoint(from,to,progress,seed){
  const p=Math.max(0,Math.min(1,Number(progress)||0));
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
  // Point de contrôle de Bézier : amplitude et côté pseudo-aléatoires.
  const magnitude=Math.min(72,length*.21)*(0.35+((seed>>>8)&255)/255*.65);
  const side=(seed&1)?1:-1;
  const cx=(from.x+to.x)/2+(-dy/length)*magnitude*side;
  const cy=(from.y+to.y)/2+(dx/length)*magnitude*side;
  const inv=1-p;
  return {x:inv*inv*from.x+2*inv*p*cx+p*p*to.x,
          y:inv*inv*from.y+2*inv*p*cy+p*p*to.y};
}

export function eventsThroughMonth(events,ordinal){
  if(!Number.isInteger(ordinal))return 0;
  // Borne supérieure pour inclure TOUS les événements du mois affiché.
  // Le flux StatsBomb est trié par match et date.
  let lo=0,hi=events.length;
  while(lo<hi){
    const mid=(lo+hi)>>1,m=monthOrdinal(events[mid].date);
    if(m!==null&&m<=ordinal)lo=mid+1;
    else hi=mid;
  }
  return lo;
}

export function bootPassWars(){
  const root=document.querySelector('[data-pass-wars]');
  if(!root)return;
  const $=id=>document.getElementById(id),canvas=$('pw-canvas'),ctx=canvas?.getContext('2d');
  if(!ctx)return;
  const W=1200,H=780,CX=600,CY=385,CYAN='#50e7ff';
  const source=root.dataset.base+'/data/players/';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let meta,original=[],filtered=[],events=[],players=[],positions=new Map(),counts=new Map(),palette=new Map();
  let careerReceiverIds=new Set();
  const colorOf=id=>palette.get(id)||playerColor(id);
  let cursor=0,calendarPosition=0,timelineFirst=null,timelineLast=null;
  let prev=0,lastText=0,playing=false,battle=false,speed=4,focus=null,sort='total',selectedMonth=null;
  // Un nouveau placement par chargement ; un même joueur ne saute pas de place
  // pendant les filtres, la lecture ou les déplacements dans la chronologie.
  const layoutSalt=(()=>{
    const bytes=new Uint32Array(1);
    if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
    else bytes[0]=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;
    return bytes[0];
  })();
  // Pas de tableau de doublons ni d'échantillonnage : events est LA file.
  // releaseCursor n'avance qu'après le lancement réel de chaque mini-bille.
  let balls=[],releaseCursor=0,emitted=0,flightCredit=0;
  const MAX_ACTIVE_BALLS=1200;
  const PARTICLE_RADIUS=1.4;
  // Photos Commons préchargées une seule fois par joueur ; si erreur réseau,
  // le Canvas et le classement conservent un monogramme coloré.
  const portraits=new Map();
  function preloadPortrait(id){
    if(portraits.has(id))return;
    const url=photoFor(id,180);
    if(!url){portraits.set(id,null);return;}
    const img=new Image();
    const state={image:img,ready:false};
    portraits.set(id,state);
    img.onload=()=>{state.ready=img.naturalWidth>0&&img.naturalHeight>0;};
    img.onerror=()=>{state.ready=false;};
    img.decoding='async';
    img.src=url;
  }
  function drawPortrait(id,x,y,r){
    const entry=portraits.get(id);
    if(!entry?.ready)return false;
    const img=entry.image,w=img.naturalWidth,h=img.naturalHeight;
    if(!w||!h)return false;
    // Carré central recadré dans un disque : pas de traits de liaison.
    const side=Math.min(w,h),sx=(w-side)/2,sy=Math.max(0,(h-side)*.18);
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
    ctx.drawImage(img,sx,sy,side,side,x-r,y-r,r*2,r*2);
    ctx.restore();return true;
  }
  function drawMonogram(id,raw,x,y,size){
    const chars=playerInitials(id,raw);
    ctx.save();ctx.fillStyle='#edf9ff';ctx.textAlign='center';
    ctx.font='800 '+size+'px system-ui';ctx.fillText(chars,x,y+size*.34);
    ctx.restore();
  }
  function renderPhotoCredits(){
    const list=$('pw-photos-list');if(!list)return;
    list.replaceChildren();
    for(const p of [{id:MESSI_ID,name:'Lionel Messi'},...players]){
      const credit=photoCredits(p.id);
      if(!credit)continue;
      const a=document.createElement('a');
      a.href=credit.source;a.target='_blank';a.rel='noopener noreferrer';
      a.textContent=credit.name+' — '+credit.author+' ('+credit.license+') ↗';
      a.title=credit.modified+' ; licence et détails sur Wikimedia Commons';
      list.append(a);
    }
  }
  // Toile de peinture persistante : une passe laisse une éclaboussure à l'impact.
  // La couche est réinitialisée en changeant de filtre / au redémarrage.
  const paintCanvas=document.createElement('canvas');
  paintCanvas.width=W;paintCanvas.height=H;
  const paint=paintCanvas.getContext('2d');
  if(!paint)return;
  const stars=Array.from({length:120},(_,i)=>({x:(i*239.73)%W,y:(i*159.17)%H,r:i%7?.65:1.3,a:.1+(i%5)*.035}));
  const format=n=>Number(n||0).toLocaleString('fr-FR');
  const set=(id,s)=>$(id).textContent=String(s);
  const empty=()=>({given:0,received:0,total:0});
  const score=id=>counts.get(id)||empty();
  const comparator=(a,b,key='total')=>key==='ratio'
    ? (b.given/(b.total||1)-a.given/(a.total||1))||b.total-a.total||a.name.localeCompare(b.name)
    : (b[key]-a[key])||b.total-a.total||a.name.localeCompare(b.name);
  function choices(id,values){
    for(const value of values){const el=document.createElement('option');el.value=value;el.textContent=value;$(id).append(el);}
  }
  function tally(list){ return eligiblePartners(list); }
  function locate(){positions=layoutPlayerNodes(players,W,H,CX,CY,layoutSalt);}
  function renderMonthTicks(first,last){
    const ticks=$('pw-month-ticks');ticks.replaceChildren();
    if(first===null||last===null){
      for(const label of ['--/----','--/----']){
        const el=document.createElement('span');el.textContent=label;ticks.append(el);
      }
      return;
    }
    const steps=last===first?1:6;
    const ordinals=new Set(Array.from({length:steps},(_,i)=>
      Math.round(first+(last-first)*(i/(steps-1||1)))));
    for(const month of ordinals){
      const tick=document.createElement('span');
      tick.textContent=monthYearLabel(month);
      tick.style.left=(last>first?100*(month-first)/(last-first):0)+'%';
      ticks.append(tick);
    }
  }
  function configureMonthTimeline(){
    const scrub=$('pw-month-scrub');
    // La période de l'axe vient de TOUS les matchs filtrés, et non
    // seulement des partenaires ayant atteint le seuil des 96 passes.
    const first=filtered[0]?monthOrdinal(filtered[0].date):null;
    const last=filtered.length?monthOrdinal(filtered.at(-1).date):null;
    timelineFirst=first;timelineLast=last;
    scrub.min=String(first??0);
    scrub.max=String(last??Math.max(1,first??0));
    scrub.value=String(first??0);
    scrub.disabled=first===null||last===null||first===last;
    renderMonthTicks(first,last);
  }
  function renderCurrentMonth(){
    // L'affichage suit le calendrier de façon linéaire, y compris les
    // mois où les données publiques ne contiennent aucune rencontre.
    const month=selectedMonth??(timelineFirst===null?null:
      Math.max(timelineFirst,Math.min(timelineLast,Math.floor(calendarPosition))));
    set('pw-now',monthYearLabel(month));
    const scrub=$('pw-month-scrub');
    if(month!==null){
      scrub.value=String(month);
      scrub.setAttribute('aria-valuetext',monthYearLabel(month));
      const first=Number(scrub.min),last=Number(scrub.max);
      const progress=last>first?(month-first)/(last-first)*100:0;
      scrub.style.setProperty('--pw-date-progress',Math.max(0,Math.min(100,progress))+'%');
    }else{
      scrub.style.setProperty('--pw-date-progress','0%');
    }
  }
  function build(){
    const team=$('pw-team').value,season=$('pw-season').value,competition=$('pw-competition').value;
    filtered=original.filter(e=>(!team||e.team===team)&&(!season||e.season===season)&&(!competition||e.competition===competition));
    // Les 501 passes reçues sont un seuil de PARCOURS, pas un seuil par saison.
    // Les filtres modifient les volumes, jamais la définition des partenaires.
    players=eligiblePartners(filtered,0,Infinity)
      .filter(p=>careerReceiverIds.has(p.id)).slice(0,30);
    locate();
    preloadPortrait(MESSI_ID);
    players.forEach(p=>preloadPortrait(p.id));
    renderPhotoCredits();
    const ids=new Set(players.map(p=>p.id));
    events=filtered.filter(e=>ids.has(e.partner_id));
    configureMonthTimeline();focus=null;reset();
    set('pw-coverage',new Set(filtered.map(e=>e.match_id)).size+' MATCHS · '+players.length+' PARTENAIRES (>500 PASSES DE MESSI)');
    $('pw-play').disabled=events.length===0;
    $('pw-battle').disabled=events.length===0;
    set('pw-dates',monthYearLabel(monthOrdinal(filtered[0]?.date))+' → '+monthYearLabel(monthOrdinal(filtered.at(-1)?.date))+' · '+format(filtered.length)+' PASSES SOURCÉES');
    set('pw-message',players.length===0
      ? 'Aucun partenaire ayant reçu plus de 500 passes de Messi dans cette sélection. Élargissez la saison ou la compétition.'
      : 'Chaque mini-bille est une vraie passe StatsBomb entre Messi et un partenaire ayant reçu plus de 500 de ses passes. '+
        'Toutes les passes éligibles sont animées, dans les deux sens, sans suppression et avec des trajectoires courbes variées. '+
        meta.scope.coverage_note);
  }
  function reset(){
    playing=false;cursor=0;calendarPosition=timelineFirst??0;
    counts=new Map();balls=[];releaseCursor=0;emitted=0;flightCredit=0;selectedMonth=null;
    paint.clearRect(0,0,W,H);
    updatePlay();renderBoard();renderLeaderboard();
  }
  function updatePlay(){
    $('pw-play').textContent=playing?'Ⅱ':'▶';
    $('pw-play').setAttribute('aria-label',playing?'Mettre en pause':'Reprendre la lecture');
    $('pw-battle').classList.toggle('active',battle);
    $('pw-battle').setAttribute('aria-pressed',String(battle));
  }
  function count(e){
    const q=counts.get(e.partner_id)||empty();q[e.direction]++;q.total++;counts.set(e.partner_id,q);
  }
  function launchDuePasses(dt,t){
    if(releaseCursor>=cursor)return;
    const monthSpan=Math.max(1,(timelineLast??timelineFirst??0)-(timelineFirst??0)+1);
    const rate=Math.min(1850,Math.max(70,
      events.length*(battle?24:speed)/monthSpan*1.22));
    // Crédit d'animation : débit constant, indépendant des paquets de dates.
    // On ne saute jamais une passe pour rattraper le calendrier.
    flightCredit=Math.min(160,flightCredit+dt*rate);
    let budget=Math.min(battle?70:40,Math.floor(flightCredit),
      MAX_ACTIVE_BALLS-balls.length);
    while(budget>0&&releaseCursor<cursor){
      const event=events[releaseCursor++];
      // Le focus est un filtre visuel volontaire, sans perte de statistiques.
      if(focus!==null&&event.partner_id!==focus)continue;
      const seed=passEventSeed(event);
      const target=positions.get(event.partner_id);
      if(!target)continue;
      balls.push({id:event.partner_id,direction:event.direction,
        index:event.index,seed,start:t,duration:430+(seed%210),
        radius:PARTICLE_RADIUS+((seed>>>16)%12)/12,hit:false});
      emitted++;flightCredit--;budget--;
    }
    // En focus : ignorer rapidement les autres événements sans surcharger la file.
    if(focus!==null&&budget===0){
      while(releaseCursor<cursor&&events[releaseCursor].partner_id!==focus)
        releaseCursor++;
    }
  }
  function seek(n,month=null){
    const end=Math.max(0,Math.min(events.length,Number(n)||0));
    selectedMonth=month;
    // Le mois sélectionné est entièrement inclus ; lecture suivante = mois suivant.
    calendarPosition=month===null?(timelineFirst??0):Math.min((timelineLast??month)+1,month+.999);
    playing=false;cursor=0;counts=new Map();balls=[];
    releaseCursor=0;emitted=0;flightCredit=0;
    paint.clearRect(0,0,W,H);
    while(cursor<end)count(events[cursor++]);
    // Un saut explicite dans le temps marque les passes précédentes comme déjà vues.
    releaseCursor=cursor;
    // État visuel après scrubbing : un condensé des impacts précédents,
    // calculé à partir des vrais compteurs (aucun événement inventé).
    for(const p of players){
      const q=score(p.id);
      for(const direction of ['given','received']){
        const n=Math.min(12,Math.ceil(Math.sqrt(q[direction])*1.1));
        for(let i=0;i<n;i++) stampPaint(p.id,direction,i+1,0.55);
      }
    }
    updatePlay();renderBoard();draw(performance.now());
  }
  function renderBoard(){
    const ids=focus===null?players.map(p=>p.id):[focus];
    let given=0,received=0;
    ids.forEach(id=>{given+=score(id).given;received+=score(id).received;});
    set('pw-total',format(given+received));set('pw-given',format(given));set('pw-received',format(received));
    const share=(given+received)?100*given/(given+received):50;
    $('pw-ratio-given').style.width=share+'%';$('pw-ratio-received').style.width=(100-share)+'%';
    const p=players.find(p=>p.id===focus);
    set('pw-focus',p?displayPlayerName(p.id,p.name).toUpperCase()+' — '+score(p.id).given+' ENVOYÉES / '+score(p.id).received+' REÇUES':
      'TOUS LES JOUEURS · CLIQUEZ SUR UN NŒUD OU UN NOM POUR L’ISOLER.');
    renderCurrentMonth();
    set('pw-progress-text',format(emitted)+' BILLES LANCÉES · '+format(cursor)+' / '+format(events.length)+' PASSES');
    for(const el of $('pw-leader').querySelectorAll('[data-count]'))el.textContent=format(score(Number(el.dataset.count)).total);
  }
  function selectPlayer(id){
    focus=focus===id?null:id;
    // Le filtre de partenaire reste purement visuel : aucun événement source perdu.
    flightCredit=0;
    renderBoard();
    $('pw-leader').querySelectorAll('[data-partner]').forEach(el=>{
      el.classList.toggle('chosen',Number(el.dataset.partner)===focus);
    });
    $('pw-leader').querySelector('.pw-all')?.classList.toggle('chosen',focus===null);
  }
  function renderLeaderboard(){
    const list=$('pw-leader');list.replaceChildren();
    const all=document.createElement('button');all.type='button';all.className='pw-all'+(focus===null?' chosen':'');
    all.textContent='◉  TOUTES LES CONNEXIONS';all.addEventListener('click',()=>selectPlayer(null));list.append(all);
    [...players].sort((a,b)=>comparator(a,b,sort)).forEach((p,i)=>{
      const button=document.createElement('button');button.type='button';button.className='pw-partner';
      button.dataset.partner=String(p.id);button.title='Isoler les passes avec '+displayPlayerName(p.id,p.name);
      const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');
      const content=document.createElement('div');content.className='pw-partner-main';
      const label=document.createElement('span');
      label.textContent=displayPlayerName(p.id,p.name);
      label.title=p.name===label.textContent?p.name:p.name+' (nom source StatsBomb)';
      content.append(label);
      const bars=document.createElement('span');bars.className='pw-partner-min';
      bars.style.setProperty('--player-color',colorOf(p.id));
      for(const key of ['given','received']){
        const bar=document.createElement('i');
        bar.style.width=100*p[key]/p.total+'%';
        bars.append(bar);
      }
      content.append(bars);
      const details=document.createElement('span');
      details.className='pw-direction-counts';
      details.textContent='↗ '+p.given+'  ·  ↙ '+p.received;
      content.append(details);
      n.style.color=colorOf(p.id);
      button.style.setProperty('--player-color',colorOf(p.id));
      const total=document.createElement('strong');total.dataset.count=String(p.id);total.textContent='0';
      const portrait=document.createElement('span');portrait.className='pw-rank-avatar';
      portrait.style.setProperty('--player-color',colorOf(p.id));
      const fallback=document.createElement('span');
      fallback.className='pw-rank-initials';fallback.textContent=playerInitials(p.id,p.name);
      portrait.append(fallback);
      const url=photoFor(p.id,112);
      if(url){
        const photo=document.createElement('img');
        photo.alt='Portrait de '+displayPlayerName(p.id,p.name);
        photo.width=44;photo.height=44;photo.loading='lazy';
        photo.style.objectPosition='50% 20%';
        photo.referrerPolicy='no-referrer';
        photo.addEventListener('load',()=>{
          if(photo.naturalWidth>0){photo.classList.add('loaded');fallback.hidden=true;}
        });
        photo.addEventListener('error',()=>{photo.remove();fallback.hidden=false;});
        photo.src=url;portrait.append(photo);
      }
      button.append(n,portrait,content,total);
      button.addEventListener('click',()=>selectPlayer(p.id));list.append(button);
    });
    renderBoard();
  }
  function background(){
    ctx.fillStyle='#07101e';ctx.fillRect(0,0,W,H);
    const grad=ctx.createRadialGradient(CX,CY,20,CX,CY,630);
    grad.addColorStop(0,'#173850');grad.addColorStop(.56,'#091b2e');grad.addColorStop(1,'#050c18');
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    for(const s of stars){ctx.globalAlpha=s.a;ctx.fillStyle='#c9eaff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();}
    ctx.globalAlpha=1;ctx.font='11px monospace';ctx.fillStyle='#87a8c0';
    ctx.fillText('PASS WARS / REAL EVENTS',25,28);ctx.textAlign='right';
    ctx.fillText(players.length+' PLAYER NODES',W-25,28);ctx.textAlign='left';
  }
  // Hash déterministe -> formes différentes pour chaque impact, sans RNG
  // dans la boucle de rendu. Ce sont des effets graphiques, pas de la data.
  function randomSeed(seed){
    let value=seed>>>0;
    return ()=>{
      value=(Math.imul(value,1664525)+1013904223)>>>0;
      return value/4294967296;
    };
  }
  function impactPosition(id,direction){
    return direction==='given'?positions.get(id):{x:CX,y:CY};
  }
  function stampPaint(id,direction,index,opacity=1){
    const target=impactPosition(id,direction);
    if(!target)return;
    const rng=randomSeed((Math.imul(Number(id)||1,2654435761)+Math.imul(Number(index)||0,374761393)+(direction==='given'?101:303))>>>0);
    const color=colorOf(id);
    const x=target.x+(rng()-.5)*58,y=target.y+(rng()-.5)*58;
    const radius=12+rng()*16;
    paint.save();paint.translate(x,y);paint.rotate(rng()*Math.PI*2);
    paint.fillStyle=color;paint.globalAlpha=.20*opacity;
    // Tache principale irrégulière, comme de la peinture écrasée.
    paint.beginPath();
    for(let j=0;j<=15;j++){
      const a=j/15*Math.PI*2, r=radius*(.65+rng()*.65);
      const px=Math.cos(a)*r,py=Math.sin(a)*r;
      if(j===0)paint.moveTo(px,py);else paint.lineTo(px,py);
    }
    paint.closePath();paint.fill();
    // Gouttelettes projetées dans plusieurs directions.
    for(let j=0;j<9;j++){
      const a=rng()*Math.PI*2,d=radius*(.85+rng()*2.1);
      const rad=1.8+rng()*5.5;
      paint.globalAlpha=(.27+rng()*.35)*opacity;
      paint.beginPath();paint.arc(Math.cos(a)*d,Math.sin(a)*d,rad,0,Math.PI*2);paint.fill();
    }
    paint.restore();
  }
  function stampMiniImpact(ball,destination){
    // Une petite trace discrète par passe : pas d'explosion coûteuse à 600/s.
    const offsetX=((ball.seed>>>5)&31)-15;
    const offsetY=((ball.seed>>>12)&31)-15;
    paint.globalAlpha=.10;
    paint.fillStyle=colorOf(ball.id);
    paint.beginPath();
    paint.arc(destination.x+offsetX,destination.y+offsetY,
      1+((ball.seed>>>21)&7)*.32,0,Math.PI*2);
    paint.fill();
    paint.globalAlpha=1;
  }
  function drawParticles(t){
    const survivors=[];
    for(const p of balls){
      const destination=positions.get(p.id);
      if(!destination)continue;
      const age=(t-p.start)/p.duration;
      const from=p.direction==='given'?{x:CX,y:CY}:destination;
      const to=p.direction==='given'?destination:{x:CX,y:CY};
      if(age>=1){
        // Chaque projectile atteint sa destination avant d'être éliminé.
        if(!p.hit){p.hit=true;stampMiniImpact(p,to);}
        continue;
      }
      survivors.push(p);
      if(age<0||(focus!==null&&focus!==p.id))continue;
      const point=curvedPassPoint(from,to,age,p.seed);
      ctx.globalAlpha=.60+Math.sin(Math.PI*age)*.35;
      ctx.fillStyle=colorOf(p.id);
      ctx.beginPath();
      ctx.arc(point.x,point.y,p.radius,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
    balls=survivors;
  }
  function drawNodes(){
    for(const p of players){
      const pos=positions.get(p.id),amount=score(p.id).total,active=focus===null||focus===p.id;
      const r=23+Math.min(7,Math.sqrt(amount)*.7);
      const color=colorOf(p.id);
      ctx.save();ctx.globalAlpha=active?1:.18;
      ctx.shadowColor=color;ctx.shadowBlur=amount?25:12;
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(pos.x,pos.y,r+3,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#12304b';ctx.beginPath();ctx.arc(pos.x,pos.y,r-1,0,Math.PI*2);ctx.fill();
      if(!drawPortrait(p.id,pos.x,pos.y,r-2))drawMonogram(p.id,p.name,pos.x,pos.y,14);
      // Le compteur reste lisible dans une capsule sous la photo.
      const countText=String(amount),pillX=pos.x+r*.68,pillY=pos.y+r*.60;
      const badgeW=Math.max(25,12+countText.length*9);
      ctx.fillStyle='#081827';ctx.beginPath();
      ctx.roundRect(pillX-badgeW/2,pillY-10,badgeW,21,10);ctx.fill();
      ctx.fillStyle=color;ctx.textAlign='center';ctx.font='800 13px system-ui';
      ctx.fillText(countText,pillX,pillY+5);
      if(focus===p.id){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pos.x+r*.75,pos.y-r*.65,5,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#e7f5ff';ctx.textAlign='center';ctx.font='800 13px system-ui';
      const name=displayPlayerName(p.id,p.name);
      ctx.fillText(name.length>18?name.slice(0,17)+'…':name,pos.x,pos.y+r+25);
      ctx.restore();
    }
    ctx.save();ctx.shadowBlur=32;ctx.shadowColor=CYAN;
    ctx.fillStyle='#96eeff';ctx.beginPath();ctx.arc(CX,CY,68,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#0a304e';
    ctx.beginPath();ctx.arc(CX,CY,64,0,Math.PI*2);ctx.fill();
    if(!drawPortrait(MESSI_ID,CX,CY,62))drawMonogram(MESSI_ID,'Lionel Messi',CX,CY,23);
    ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#fff';
    ctx.font='900 16px system-ui';ctx.fillText('MESSI',CX,CY+86);
    ctx.fillStyle=CYAN;ctx.font='800 11px monospace';ctx.fillText('N° 10',CX,CY+102);
    ctx.textAlign='left';
  }
  function draw(t){
    background();
    // La peinture demeure sur la piste, même après la disparition des projectiles.
    ctx.drawImage(paintCanvas,0,0);
    drawParticles(t);drawNodes();
    if(players.length===0 && meta){
      ctx.fillStyle='#c4d9e9';ctx.textAlign='center';
      ctx.font='bold 21px system-ui';
      ctx.fillText('AUCUN PARTENAIRE AU-DESSUS DE 95 PASSES',CX,CY+110);
      ctx.font='14px system-ui';
      ctx.fillText('Élargissez la période pour afficher des joueurs.',CX,CY+140);
      ctx.textAlign='left';
    }
  }
  function frame(t){
    const dt=prev?Math.min(.13,Math.max(0,(t-prev)/1000)):0;prev=t;
    if(playing&&events.length&&timelineLast!==null){
      selectedMonth=null;
      // Frise réellement calendaire : mêmes distances pour chaque mois.
      // Chaque événement réel compte, mais les projectiles sont distribués
      // à cadence visuellement lisible plutôt que tirés tous à la fois.
      const end=timelineLast+1;
      calendarPosition=Math.min(end,calendarPosition+dt*(battle?24:speed));
      while(cursor<events.length &&
            eventCalendarPosition(events[cursor].date)<calendarPosition)
        count(events[cursor++]);
      if(calendarPosition>=end){
        while(cursor<events.length)count(events[cursor++]);
      }
      launchDuePasses(dt,t);
      if(calendarPosition>=end&&releaseCursor>=events.length&&balls.length===0){
        playing=false;updatePlay();
      }
      if(t-lastText>90){lastText=t;renderBoard();}
    }
    draw(t);requestAnimationFrame(frame);
  }
  canvas.addEventListener('click',event=>{
    const b=canvas.getBoundingClientRect(),x=(event.clientX-b.left)/b.width*W,y=(event.clientY-b.top)/b.height*H;
    const hit=players.find(p=>{const xy=positions.get(p.id);return Math.hypot(x-xy.x,y-xy.y)<37;});
    if(hit)selectPlayer(hit.id);else if(Math.hypot(x-CX,y-CY)<70)selectPlayer(null);
  });
  ['pw-team','pw-season','pw-competition'].forEach(id=>$(id).addEventListener('change',build));
  $('pw-sort').addEventListener('change',e=>{sort=e.target.value;renderLeaderboard();});
  $('pw-play').addEventListener('click',()=>{
    if(timelineLast!==null&&calendarPosition>=timelineLast+1 && releaseCursor>=events.length&&balls.length===0)reset();
    playing=!playing;flightCredit=0;updatePlay();
  });
  $('pw-reset').addEventListener('click',reset);
  $('pw-battle').addEventListener('click',()=>{
    battle=!battle;if(battle&&timelineLast!==null&&calendarPosition>=timelineLast+1&&releaseCursor>=events.length&&balls.length===0)reset();
    if(battle)playing=true;flightCredit=0;updatePlay();
  });
  $('pw-speed').addEventListener('change',e=>speed=Number(e.target.value));
  $('pw-month-scrub').addEventListener('input',e=>{
    const month=Number(e.target.value);
    seek(eventsThroughMonth(events,month),month);
  });
  const load=async name=>{
    const response=await fetch(source+name);
    if(!response.ok)throw Error(name+' : HTTP '+response.status);
    return response.json();
  };
  Promise.all([load('messi-pass-wars.json'),load('messi-pass-wars-events.json')])
    .then(([info,stream])=>{
      if(info.schema_version!==2||stream.schema_version!==2||
         stream.scope_id!==info.scope.id||!Array.isArray(stream.events)||
         info.summary.total!==stream.events.length||info.scope.complete_career!==false)
        throw Error('Données de provenance ou de structure invalides');
      meta=info;original=stream.events;
      careerReceiverIds=new Set(meta.partners.filter(p=>p.given>=MIN_PARTNER_PASSES).map(p=>p.id));
      palette=createPlayerPalette(meta.partners);
      choices('pw-team',meta.filters.teams);choices('pw-season',meta.filters.seasons);
      choices('pw-competition',meta.filters.competitions);
      set('pw-state','● '+meta.scope.matches_count+' MATCHS RÉELS / STATSBOMB');
      build();if(!reduced && events.length){playing=true;updatePlay();}
    }).catch(error=>{
      set('pw-state','DONNÉES INDISPONIBLES');
      set('pw-message','Chargement des passes réelles impossible : '+error.message+
        '. Aucun faux chiffre de carrière ne sera simulé.');
      $('pw-message').classList.add('error');
      $('pw-play').disabled=true;$('pw-battle').disabled=true;
    });
  requestAnimationFrame(frame);
}
