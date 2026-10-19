/** Messi Pass Wars — Canvas 2D, événements StatsBomb réels seulement. */
// Critère d'affichage : passes réussies ENVOYÉES + REÇUES dans le filtre actif.
// Les 118 partenaires restent dans le JSON source ; seuls les éligibles sont dessinés.
export const MIN_PARTNER_PASSES = 80;

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

export function bootPassWars(){
  const root=document.querySelector('[data-pass-wars]');
  if(!root)return;
  const $=id=>document.getElementById(id),canvas=$('pw-canvas'),ctx=canvas?.getContext('2d');
  if(!ctx)return;
  const W=1200,H=780,CX=600,CY=385,CYAN='#50e7ff',ORANGE='#ff9470';
  const source=root.dataset.base+'/data/players/';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let meta,original=[],filtered=[],events=[],players=[],positions=new Map(),counts=new Map();
  let cursor=0,position=0,prev=0,lastText=0,playing=false,battle=false,speed=28,focus=null,sort='total';
  let balls=[],ripples=[];
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
  function locate(){
    positions=new Map();
    players.forEach((p,i)=>{
      const twoRings=players.length>18;
      const inner=twoRings?12:players.length;
      const outer=twoRings&&i>=inner;
      const n=outer?players.length-inner:inner,j=outer?i-inner:i;
      const angle=Math.PI*2*j/Math.max(1,n)-Math.PI/2+(outer?.08:0);
      positions.set(p.id,{x:CX+Math.cos(angle)*(outer?485:(twoRings?295:425)),
                          y:CY+Math.sin(angle)*(outer?325:(twoRings?215:290))});
    });
  }
  function build(){
    const team=$('pw-team').value,season=$('pw-season').value,competition=$('pw-competition').value;
    filtered=original.filter(e=>(!team||e.team===team)&&(!season||e.season===season)&&(!competition||e.competition===competition));
    players=tally(filtered);locate();
    const ids=new Set(players.map(p=>p.id));
    events=filtered.filter(e=>ids.has(e.partner_id));
    $('pw-scrub').max=String(Math.max(events.length,1));focus=null;reset();
    set('pw-coverage',new Set(filtered.map(e=>e.match_id)).size+' MATCHS · '+players.length+' PARTENAIRES (80+ PASSES)');
    $('pw-play').disabled=events.length===0;
    $('pw-battle').disabled=events.length===0;
    set('pw-dates',(filtered[0]?.date||'—')+' → '+(filtered.at(-1)?.date||'—')+' · '+format(filtered.length)+' PASSES SOURCÉES');
    set('pw-message',players.length===0
      ? 'Aucun partenaire avec au moins 80 passes échangées sur cette sélection. Change de saison ou élargis les filtres.'
      : 'StatsBomb Open Data : '+meta.scope.matches_count+' matchs couverts. '+meta.scope.coverage_note+
        ' Seuls les partenaires totalisant au moins 80 passes envoyées + reçues dans cette sélection apparaissent.');
  }
  function reset(){
    playing=false;cursor=0;position=0;counts=new Map();balls=[];ripples=[];
    paint.clearRect(0,0,W,H);
    $('pw-scrub').value='0';updatePlay();renderBoard();renderLeaderboard();
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
  function seek(n){
    const end=Math.max(0,Math.min(events.length,Number(n)||0));
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
    set('pw-focus',p?p.name.toUpperCase()+' — '+score(p.id).given+' ENVOYÉES / '+score(p.id).received+' REÇUES':
      'TOUS LES JOUEURS · CLIQUEZ SUR UN NŒUD OU UN NOM POUR L’ISOLER.');
    const e=events[Math.max(cursor-1,0)];
    set('pw-now',cursor&&e?e.date+' · '+e.minute+'′':'DÉPART');
    set('pw-progress-text',format(cursor)+' / '+format(events.length)+' PASSES');
    $('pw-scrub').value=String(cursor);
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
      button.dataset.partner=String(p.id);button.title='Isoler les passes avec '+p.name;
      const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');
      const content=document.createElement('div');content.className='pw-partner-main';
      const label=document.createElement('span');label.textContent=p.name;content.append(label);
      const bars=document.createElement('span');bars.className='pw-partner-min';
      for(const key of ['given','received']){const bar=document.createElement('i');bar.style.width=100*p[key]/p.total+'%';bars.append(bar);}
      content.append(bars);
      const total=document.createElement('strong');total.dataset.count=String(p.id);total.textContent='0';
      button.append(n,content,total);button.addEventListener('click',()=>selectPlayer(p.id));list.append(button);
    });
    renderBoard();
  }
  function line(x,y,xx,yy,color,width,alpha,glow=0){
    ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';
    ctx.shadowColor=color;ctx.shadowBlur=glow;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();ctx.restore();
  }
  function background(){
    ctx.fillStyle='#07101e';ctx.fillRect(0,0,W,H);
    const grad=ctx.createRadialGradient(CX,CY,20,CX,CY,630);
    grad.addColorStop(0,'#173850');grad.addColorStop(.56,'#091b2e');grad.addColorStop(1,'#050c18');
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.strokeStyle='#58789325';ctx.setLineDash([3,13]);
    for(const r of [120,220,345,510]){ctx.beginPath();ctx.ellipse(CX,CY,r,.72*r,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    for(const s of stars){ctx.globalAlpha=s.a;ctx.fillStyle='#c9eaff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();}
    ctx.globalAlpha=1;ctx.font='11px monospace';ctx.fillStyle='#87a8c0';
    ctx.fillText('PASS WARS / REAL EVENTS',25,28);ctx.textAlign='right';
    ctx.fillText(players.length+' PLAYER NODES',W-25,28);ctx.textAlign='left';
  }
  function drawEdges(){
    for(const p of players){
      const node=positions.get(p.id),dx=node.x-CX,dy=node.y-CY,m=Math.hypot(dx,dy);
      const nx=-dy/m*7,ny=dx/m*7,q=score(p.id),light=focus===null||focus===p.id;
      line(CX,CY,node.x,node.y,'#7199b2',1,light?.20:.035);
      for(const [direction,color,offset] of [['given',CYAN,1],['received',ORANGE,-1]]){
        if(!q[direction])continue;
        const w=Math.min(18,1+Math.sqrt(q[direction])*1.75);
        line(CX+nx*offset,CY+ny*offset,node.x+nx*offset,node.y+ny*offset,color,w*2.2,light?.12:.015,light?14:0);
        line(CX+nx*offset,CY+ny*offset,node.x+nx*offset,node.y+ny*offset,color,w,light?.9:.08,light?6:0);
      }
    }
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
    const color=direction==='given'?CYAN:ORANGE;
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
      const color=p.direction==='given'?CYAN:ORANGE;
      if(age>=1 && !p.hit){
        p.hit=true;
        stampPaint(p.id,p.direction,p.index);
        ripples.push({start:t,x:to.x,y:to.y,color,
                      seed:(p.index||0)+(p.id||0)*23});
        if(ripples.length>120)ripples.shift();
      }
      if(age<0||age>1||(focus!==null&&focus!==p.id))continue;
      const d=1-(1-age)*(1-age),trail=Math.max(0,d-.16);
      const x=from.x+(to.x-from.x)*d,y=from.y+(to.y-from.y)*d;
      const x0=from.x+(to.x-from.x)*trail,y0=from.y+(to.y-from.y)*trail;
      line(x0,y0,x,y,color,5,.75,11);
      ctx.save();ctx.shadowBlur=18;ctx.shadowColor=color;ctx.fillStyle=color;
      ctx.beginPath();ctx.arc(x,y,7.4,0,7);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(x-1.8,y-1.6,2.7,0,7);ctx.fill();ctx.restore();
    }
    balls=survivors;ripples=ripples.filter(r=>t-r.start<600);
    for(const r of ripples){
      if(focus!==null && Math.hypot(r.x-CX,r.y-CY)>90){
        const focused=positions.get(focus);
        if(!focused || Math.hypot(r.x-focused.x,r.y-focused.y)>75)continue;
      }
      const age=(t-r.start)/600;
      ctx.save();ctx.strokeStyle=r.color;ctx.globalAlpha=(1-age)*.78;
      ctx.lineWidth=3.2;ctx.beginPath();ctx.arc(r.x,r.y,9+43*age,0,7);ctx.stroke();
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
      const r=18+Math.min(8,Math.sqrt(amount)*.7);
      ctx.save();ctx.globalAlpha=active?1:.18;
      ctx.fillStyle='#12304b';ctx.strokeStyle=focus===p.id?'#ffffff':'#5688ad';ctx.lineWidth=focus===p.id?3:1.5;
      ctx.shadowColor=CYAN;ctx.shadowBlur=amount?14:0;ctx.beginPath();ctx.arc(pos.x,pos.y,r,0,7);ctx.fill();ctx.stroke();
      ctx.shadowBlur=0;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='800 14px system-ui';ctx.fillText(amount,pos.x,pos.y+5);
      ctx.font='600 12px system-ui';ctx.fillStyle='#d7ecfa';
      const nm=p.name.length>17?p.name.split(' ').at(-1):p.name;
      ctx.fillText(nm.length>18?nm.slice(0,17)+'…':nm,pos.x,pos.y+(pos.y<CY?-r-10:r+19));ctx.restore();
    }
    ctx.save();ctx.shadowBlur=32;ctx.shadowColor=CYAN;
    ctx.fillStyle='#0a304e';ctx.strokeStyle='#96eeff';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(CX,CY,62,0,7);ctx.fill();ctx.stroke();ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='900 22px system-ui';ctx.fillText('MESSI',CX,CY+5);
    ctx.fillStyle=CYAN;ctx.font='800 12px monospace';ctx.fillText('N° 10',CX,CY+26);ctx.textAlign='left';
  }
  function draw(t){
    background();
    // La peinture demeure sur la piste, même après la disparition des projectiles.
    ctx.drawImage(paintCanvas,0,0);
    drawEdges();drawParticles(t);drawNodes();
    if(players.length===0 && meta){
      ctx.fillStyle='#c4d9e9';ctx.textAlign='center';
      ctx.font='bold 21px system-ui';
      ctx.fillText('AUCUN PARTENAIRE À 80 PASSES',CX,CY+110);
      ctx.font='14px system-ui';
      ctx.fillText('Élargissez la période pour afficher des connexions.',CX,CY+140);
      ctx.textAlign='left';
    }
  }
  function frame(t){
    const dt=prev?Math.min(.13,Math.max(0,(t-prev)/1000)):0;prev=t;
    if(playing&&events.length){
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
  $('pw-scrub').addEventListener('input',e=>seek(e.target.value));
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
