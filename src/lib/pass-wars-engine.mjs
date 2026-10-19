import { MESSI_ID, displayPlayerName, playerInitials, photoFor, photoCredits } from './messi-player-profiles.mjs';

/** Messi Pass Wars — Canvas 2D, événements StatsBomb réels seulement. */
// Critère d'affichage : passes réussies ENVOYÉES + REÇUES dans le filtre actif.
// Les 118 partenaires restent dans le JSON source ; seuls les éligibles sont dessinés.
export const MIN_PARTNER_PASSES = 96;

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
    .filter(p=>p.total>=minimum)
    .sort((a,b)=>b.total-a.total || String(a.name).localeCompare(String(b.name)) || a.id-b.id)
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
 * Disposition organique reproductible. Le placement ne dépend PAS du rang des
 * passes : chaque joueur reçoit des coordonnées via sa propre graine.
 * Rejet des collisions avec le portrait central et les autres joueurs.
 * Pas de lignes, pas de couronne régulière, pas de classement en horloge.
 */
export function layoutPlayerNodes(players, W=1200, H=780, CX=W/2, CY=H/2){
  const result=new Map();
  const ids=[...players].sort((a,b)=>Number(a.id)-Number(b.id));
  const paddingX=92,paddingY=105;
  for(const p of ids){
    let seed=(Math.imul(Number(p.id)||1,2654435761)^0x9e3779b9)>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    let best=null,bestDistance=-Infinity;
    for(let attempt=0;attempt<700;attempt++){
      const x=paddingX+random()*(W-2*paddingX);
      const y=paddingY+random()*(H-2*paddingY);
      const dCenter=Math.hypot(x-CX,y-CY);
      if(dCenter<185)continue;
      const existing=[...result.values()];
      const closest=existing.length
        ? Math.min(...existing.map(point=>Math.hypot(x-point.x,y-point.y)))
        : 1000;
      const border=Math.min(x-paddingX,W-paddingX-x,y-paddingY,H-paddingY-y);
      const quality=closest+border*.13;
      if(quality>bestDistance){bestDistance=quality;best={x,y};}
      // Première position viable, semée différemment pour chaque ID.
      if(closest>146&&border>22){best={x,y};break;}
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
  const colorOf=id=>palette.get(id)||playerColor(id);
  let cursor=0,position=0,prev=0,lastText=0,playing=false,battle=false,speed=28,focus=null,sort='total',selectedMonth=null;
  let balls=[],ripples=[];
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
  function locate(){positions=layoutPlayerNodes(players,W,H,CX,CY);}
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
      tick.textContent=monthYearLabel(month);ticks.append(tick);
    }
  }
  function configureMonthTimeline(){
    const scrub=$('pw-month-scrub');
    const first=events[0]?monthOrdinal(events[0].date):null;
    const last=events.length?monthOrdinal(events.at(-1).date):null;
    scrub.min=String(first??0);
    scrub.max=String(last??Math.max(1,first??0));
    scrub.value=String(first??0);
    scrub.disabled=first===null||last===null||first===last;
    renderMonthTicks(first,last);
  }
  function renderCurrentMonth(){
    const sourceMonth=cursor>0?monthOrdinal(events[cursor-1].date):
      events.length?monthOrdinal(events[0].date):null;
    const month=selectedMonth??sourceMonth;
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
    players=tally(filtered);locate();
    preloadPortrait(MESSI_ID);
    players.forEach(p=>preloadPortrait(p.id));
    renderPhotoCredits();
    const ids=new Set(players.map(p=>p.id));
    events=filtered.filter(e=>ids.has(e.partner_id));
    configureMonthTimeline();focus=null;reset();
    set('pw-coverage',new Set(filtered.map(e=>e.match_id)).size+' MATCHS · '+players.length+' PARTENAIRES (96+ PASSES)');
    $('pw-play').disabled=events.length===0;
    $('pw-battle').disabled=events.length===0;
    set('pw-dates',(filtered[0]?.date||'—')+' → '+(filtered.at(-1)?.date||'—')+' · '+format(filtered.length)+' PASSES SOURCÉES');
    set('pw-message',players.length===0
      ? 'Aucun partenaire avec plus de 95 passes échangées sur cette sélection. Change de saison ou élargis les filtres.'
      : 'StatsBomb Open Data : '+meta.scope.matches_count+' matchs couverts. '+meta.scope.coverage_note+
        ' Seuls les partenaires totalisant plus de 95 passes envoyées + reçues dans cette sélection apparaissent.');
  }
  function reset(){
    playing=false;cursor=0;position=0;counts=new Map();balls=[];ripples=[];selectedMonth=null;
    paint.clearRect(0,0,W,H);
    updatePlay();renderBoard();renderLeaderboard();
  }
  function updatePlay(){
    $('pw-play').textContent=playing?'Ⅱ':'▶';
    $('pw-play').setAttribute('aria-label',playing?'Mettre en pause':'Reprendre la lecture');
    $('pw-battle').classList.toggle('active',battle);
    $('pw-battle').setAttribute('aria-pressed',String(battle));
  }
  function count(e,animate,t){
    const q=counts.get(e.partner_id)||empty();q[e.direction]++;q.total++;counts.set(e.partner_id,q);
    if(animate){
      balls.push({id:e.partner_id,direction:e.direction,index:e.index,start:t,duration:650+(e.index%5)*75});
      if(balls.length>240)balls=balls.slice(-240);
    }
  }
  function seek(n,month=null){
    const end=Math.max(0,Math.min(events.length,Number(n)||0));
    selectedMonth=month;
    playing=false;position=end;cursor=0;counts=new Map();balls=[];ripples=[];
    paint.clearRect(0,0,W,H);
    while(cursor<end)count(events[cursor++],false,0);
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
    const e=events[Math.max(cursor-1,0)];
    renderCurrentMonth();
    set('pw-progress-text',format(cursor)+' / '+format(events.length)+' PASSES');
    for(const el of $('pw-leader').querySelectorAll('[data-count]'))el.textContent=format(score(Number(el.dataset.count)).total);
  }
  function selectPlayer(id){
    focus=focus===id?null:id;renderBoard();
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
  function drawParticles(t){
    const survivors=[];
    for(const p of balls){
      const end=positions.get(p.id);if(!end)continue;
      const age=(t-p.start)/p.duration;
      if(age>1.12)continue;
      survivors.push(p);
      const from=p.direction==='given'?{x:CX,y:CY}:end;
      const to=p.direction==='given'?end:{x:CX,y:CY};
      const color=colorOf(p.id);
      if(age>=1 && !p.hit){
        p.hit=true;
        stampPaint(p.id,p.direction,p.index);
        ripples.push({start:t,x:to.x,y:to.y,color,
                      seed:(p.index||0)+(p.id||0)*23});
        if(ripples.length>120)ripples.shift();
      }
      if(age<0||age>1||(focus!==null&&focus!==p.id))continue;
      // Une seule bille isolée en vol. Aucun trait, aucune traînée en pointillés.
      const d=1-(1-age)*(1-age);
      const x=from.x+(to.x-from.x)*d,y=from.y+(to.y-from.y)*d;
      ctx.save();ctx.shadowBlur=21;ctx.shadowColor=color;ctx.fillStyle=color;
      ctx.beginPath();ctx.arc(x,y,8.6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(x-2,y-2,2.8,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    balls=survivors;ripples=ripples.filter(r=>t-r.start<600);
    for(const r of ripples){
      if(focus!==null && Math.hypot(r.x-CX,r.y-CY)>90){
        const focused=positions.get(focus);
        if(!focused || Math.hypot(r.x-focused.x,r.y-focused.y)>75)continue;
      }
      const age=(t-r.start)/600;
      ctx.save();ctx.globalAlpha=(1-age)*.78;
      const rng=randomSeed(r.seed>>>0);
      ctx.fillStyle=r.color;
      for(let j=0;j<12;j++){
        const angle=(j+rng()*.65)/12*Math.PI*2;
        const dist=9+age*(35+rng()*40);
        ctx.globalAlpha=(1-age)*(.5+rng()*.45);
        ctx.beginPath();
        ctx.arc(r.x+Math.cos(angle)*dist,r.y+Math.sin(angle)*dist,
                (2+rng()*5)*(1-age*.65),0,7);
        ctx.fill();
      }
      ctx.restore();
    }
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
    if(playing&&events.length){
      selectedMonth=null;
      position=Math.min(events.length,position+dt*(battle?175:speed));
      while(cursor<Math.floor(position))count(events[cursor++],true,t);
      if(cursor>=events.length){playing=false;updatePlay();}
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
    if(cursor>=events.length)reset();playing=!playing;updatePlay();
  });
  $('pw-reset').addEventListener('click',reset);
  $('pw-battle').addEventListener('click',()=>{
    battle=!battle;if(battle&&cursor>=events.length)reset();
    if(battle)playing=true;updatePlay();
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
