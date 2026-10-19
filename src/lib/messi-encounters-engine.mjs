import {layoutPlayerNodes,monthOrdinal,monthYearLabel,eventsThroughMonth} from './pass-wars-engine.mjs';

const TABS={
  goalkeepers:{title:'GARDIENS AFFRONTÉS',label:'TIRS RELIÉS À UN GARDIEN',singular:'TIR',limit:20},
  defenders:{title:'DÉFENSEURS DRIBBLÉS',label:'DRIBBLES RÉUSSIS ATTRIBUÉS',singular:'DRIBBLE',limit:20},
  clubs:{title:'CLUBS · BUTS EN LIGA ET C1',label:'BUTS PAR CLUB',singular:'BUT',limit:1000},
};
export const MODE_IDS=Object.keys(TABS);
// Surnoms et noms usuels par ID StatsBomb : les événements sources gardent
// leur nom original afin de préserver la traçabilité.
const OPPONENT_NAMES=new Map(Object.entries({
  26070:'Toño',25144:'Diego Alves',23344:'Aitor Fernández',6378:'Jan Oblak',
  6931:'Leandro Chichizola',11748:'Unai Simón',24264:'Dani Hernández',
  15036:'Edwin van der Sar',6576:'Gorka Iraizoz',26221:'Gustavo Munúa',
  26103:'Carlos Kameni',6610:'Pichu Cuéllar',26686:'Jordi Codina',
  26707:'Juan Pablo Carrizo',5597:'Keylor Navas',3659:'Willy Caballero',
  26484:'Toni Doblas',11179:'Iker Casillas',6590:'Neto',6730:'Rubén Martínez',
  26170:'Javi Chica',6320:'Filipe Luís',26118:'Antonio López',6675:'Antonio Luna',
  6573:'Bernardo Espinosa',6886:'Dídac Vilà',6923:'Joaquín Navarro',
  26057:'Mariano Pernía',6789:'Mikel Balenziaga',20008:'Patrice Evra',
  6592:'Rúben Vezo',6665:'Iñigo Martínez',26638:'Alberto Botía',
  6924:'Alejandro Gálvez',24075:'Christian Fernández',7476:'Emiliano Moretti',
  26791:'Emir Spahić',20269:'Joris Mathijsen',25983:'Josu Sarriegi',
  26163:'Marc Torrejón'
}).map(([id,n])=>[Number(id),n]));
export function opponentDisplayName(id,original){
  return OPPONENT_NAMES.get(Number(id))||String(original||'Adversaire');
}


export function rankOpponents(events,limit=20){
  const tally=new Map();
  for(const e of events){
    const id=e.target_id;
    const p=tally.get(id)||{id,name:opponentDisplayName(id,e.target_name),count:0,goals:0};
    p.count++;p.goals+=Number(Boolean(e.goal||e.kind==='but'));tally.set(id,p);
  }
  return [...tally.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)||a.id-b.id)
    .slice(0,limit);
}

function hue(id){
  const v=Math.abs(Math.trunc(Number(id)||1));
  return 'hsl('+((v*137.50776405)%360).toFixed(2)+' 88% 66%)';
}
function initials(name){
  const parts=String(name||'?').split(/\s+/);
  return parts.length>=2?(parts[0][0]+parts.at(-1)[0]).toUpperCase():parts[0].slice(0,2).toUpperCase();
}

export function bootMessiEncounters(){
  const root=document.querySelector('[data-messi-encounters]');if(!root)return;
  const $=id=>document.getElementById(id),canvas=$('me-canvas'),ctx=canvas?.getContext('2d');
  if(!ctx)return;
  const W=1200,H=780,CX=600,CY=390;
  let db=null,mode='defenders',source=[],visible=[],leaders=[],positions=new Map();
  let cursor=0,playing=false,battle=false,rate=10,lastFrame=0,progress=0,lastInfo=0,selectedMonth=null;
  let balls=[],paintDots=[],focus=null;
  const stars=Array.from({length:130},(_,i)=>({x:(i*171.23)%W,y:(i*293.43)%H,r:i%7?1:2}));
  const say=(id,t)=>$(id).textContent=String(t);
  const format=n=>Number(n).toLocaleString('fr-FR');
  const tab=TABS[mode];
  const unit=()=>TABS[mode].singular;
  const label=()=>TABS[mode].label;
  function reset(){
    playing=false;cursor=0;progress=0;balls=[];paintDots=[];selectedMonth=null;focus=null;
    $('me-play').textContent='▶';renderInfo();draw(performance.now());
  }
  function populateFilters(){
    for(const [id,values] of [['me-competition',db.filters.competitions],['me-season',db.filters.seasons]]){
      const sel=$(id);sel.replaceChildren();
      const all=document.createElement('option');all.value='';all.textContent='TOUTES';sel.append(all);
      for(const value of values){const opt=document.createElement('option');opt.value=value;opt.textContent=value;sel.append(opt);}
    }
  }
  function filters(){
    return {
      competition:$('me-competition').value,
      season:$('me-season').value
    };
  }
  function recompute(){
    if(!db)return;
    const f=filters();
    source=db.modes[mode].events.filter(e=>
      (!f.competition||e.competition===f.competition)&&(!f.season||e.season===f.season));
    leaders=rankOpponents(source,TABS[mode].limit);
    const ids=new Set(leaders.map(x=>x.id));
    visible=source.filter(e=>ids.has(e.target_id));
    positions=layoutPlayerNodes(leaders,W,H,CX,CY);
    $('me-month').disabled=visible.length===0;
    const from=visible.length?monthOrdinal(visible[0].date):null;
    const to=visible.length?monthOrdinal(visible.at(-1).date):null;
    $('me-month').min=String(from??0);$('me-month').max=String(to??1);
    $('me-month').step='1';$('me-month').disabled=from===null||from===to;
    say('me-from',monthYearLabel(from));say('me-to',monthYearLabel(to));
    say('me-subtitle',TABS[mode].label+' · '+leaders.length+' ADVERSAIRES');
    say('me-coverage',format(new Set(source.map(e=>e.match_id)).size)+' MATCHS AVEC ÉVÉNEMENT LIÉ · '+format(source.length)+' ÉVÉNEMENTS');
    $('me-play').disabled=!visible.length;$('me-battle').disabled=!visible.length;
    reset();renderRank();
    say('me-message',visible.length
      ? db.scope.note+' '+(mode==='goalkeepers'?db.scope.keeper_method:mode==='defenders'?db.scope.defender_method:db.scope.club_method)
      : 'Aucun événement attribuable dans cette sélection. Élargis les filtres : aucun résultat n’a été inventé.');
  }
  function setMode(next){
    if(!TABS[next])return;
    mode=next;
    document.querySelectorAll('[data-me-mode]').forEach(button=>{
      const active=button.dataset.meMode===mode;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    say('me-mode-label',TABS[mode].title);
    $('me-competition').value='';$('me-season').value='';
    recompute();
  }
  function seekMonth(m){
    const n=eventsThroughMonth(visible,m);
    cursor=n;progress=n;balls=[];paintDots=[];selectedMonth=m;
    playing=false;$('me-play').textContent='▶';
    // Éclaboussures cumulées reconstituées de façon limitée et déterministe.
    const samples=new Map();
    for(const e of visible.slice(0,cursor)){
      samples.set(e.target_id,(samples.get(e.target_id)||0)+1);
    }
    for(const p of leaders){
      const count=Math.min(28,Math.round(Math.sqrt(samples.get(p.id)||0)*4));
      for(let j=0;j<count;j++)spawnPaint(p.id,j,0.6);
    }
    renderInfo();draw(performance.now());
  }
  function renderInfo(){
    const date=selectedMonth??(cursor?monthOrdinal(visible[cursor-1].date):
      visible.length?monthOrdinal(visible[0].date):null);
    say('me-date',monthYearLabel(date));
    say('me-events-count',format(cursor)+' / '+format(visible.length)+' '+unit()+(visible.length>1?'S':''));
    const dateSlider=$('me-month');
    if(date!==null){
      dateSlider.value=String(date);
      dateSlider.setAttribute('aria-valuetext',monthYearLabel(date));
      const min=Number(dateSlider.min),max=Number(dateSlider.max);
      dateSlider.style.setProperty('--progress',Math.max(0,Math.min(100,max>min?(date-min)/(max-min)*100:0))+'%');
    }
    const items=focus===null?visible.slice(0,cursor):visible.slice(0,cursor).filter(e=>e.target_id===focus);
    say('me-total',format(items.length));
    say('me-goals',format(items.filter(e=>e.goal||e.kind==='but').length));
    document.querySelectorAll('[data-me-count]').forEach(n=>{
      const id=Number(n.dataset.meCount);
      n.textContent=format(visible.slice(0,cursor).filter(e=>e.target_id===id).length);
    });
    const selected=leaders.find(p=>p.id===focus);
    say('me-focus',selected?selected.name.toUpperCase()+' · '+format(items.length)+' '+unit()+'S':'TOUS LES ADVERSAIRES · CLIQUEZ POUR ISOLER UN JOUEUR OU UN CLUB.');
  }
  function renderRank(){
    const list=$('me-rank');list.replaceChildren();
    for(const [index,p] of leaders.entries()){
      const button=document.createElement('button');button.type='button';
      button.className='me-rank-entry';button.style.setProperty('--color',hue(p.id));
      button.title=p.name;button.dataset.meTarget=String(p.id);
      const num=document.createElement('span');num.className='me-rank-num';num.textContent=String(index+1).padStart(2,'0');
      const avatar=document.createElement('span');avatar.className='me-avatar';avatar.textContent=initials(p.name);
      const title=document.createElement('span');title.className='me-rank-name';title.textContent=p.name;
      const val=document.createElement('strong');val.dataset.meCount=String(p.id);val.textContent='0';
      button.append(num,avatar,title,val);
      button.addEventListener('click',()=>{
        focus=focus===p.id?null:p.id;
        document.querySelectorAll('[data-me-target]').forEach(b=>b.classList.toggle('active',Number(b.dataset.meTarget)===focus));
        renderInfo();
      });
      list.append(button);
    }
  }
  function random(seed){
    let x=seed>>>0;
    return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
  }
  function spawnPaint(id,index,alpha=1){
    const point=positions.get(id);if(!point)return;
    const rand=random((Math.imul(id,2654435761)+index*13)>>>0);
    const color=hue(id);
    for(let i=0;i<11;i++){
      const a=rand()*Math.PI*2,r=8+rand()*39;
      paintDots.push({x:point.x+Math.cos(a)*r,y:point.y+Math.sin(a)*r,
        r:1.8+rand()*5.7,a:(.2+rand()*.45)*alpha,color});
    }
    if(paintDots.length>8500)paintDots.splice(0,paintDots.length-8500);
  }
  function background(){
    ctx.fillStyle='#060e1c';ctx.fillRect(0,0,W,H);
    const grad=ctx.createRadialGradient(CX,CY,50,CX,CY,570);
    grad.addColorStop(0,'#12384c');grad.addColorStop(.55,'#0a1c2e');grad.addColorStop(1,'#050d19');
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    for(const p of stars){ctx.globalAlpha=.15;ctx.fillStyle='#a8d7ed';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();}
    ctx.globalAlpha=1;
  }
  function drawNodes(){
    for(const p of leaders){
      const xy=positions.get(p.id);if(!xy)continue;
      const c=hue(p.id);
      ctx.save();ctx.globalAlpha=focus===null||focus===p.id?1:.20;
      ctx.shadowColor=c;ctx.shadowBlur=26;ctx.fillStyle=c;ctx.beginPath();ctx.arc(xy.x,xy.y,35,0,7);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#11334b';ctx.beginPath();ctx.arc(xy.x,xy.y,31,0,7);ctx.fill();
      ctx.textAlign='center';ctx.font='900 17px system-ui';ctx.fillStyle='#ecfaff';
      ctx.fillText(initials(p.name),xy.x,xy.y+6);
      ctx.font='800 14px system-ui';ctx.fillText(p.name.length>18?p.name.slice(0,17)+'…':p.name,xy.x,xy.y+58);
      ctx.restore();
    }
    ctx.save();ctx.shadowColor='#64eaff';ctx.shadowBlur=28;ctx.fillStyle='#89eefa';
    ctx.beginPath();ctx.arc(CX,CY,61,0,7);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#11374c';ctx.beginPath();ctx.arc(CX,CY,57,0,7);ctx.fill();
    ctx.textAlign='center';ctx.font='900 23px system-ui';ctx.fillStyle='#fff';ctx.fillText('MESSI',CX,CY+6);
    ctx.font='700 13px system-ui';ctx.fillStyle='#b1f3fc';ctx.fillText('10',CX,CY+29);ctx.restore();
  }
  function draw(t){
    background();
    for(const dot of paintDots){
      ctx.fillStyle=dot.color;ctx.globalAlpha=dot.a;
      ctx.beginPath();ctx.arc(dot.x,dot.y,dot.r,0,7);ctx.fill();
    }
    ctx.globalAlpha=1;
    const next=[];
    for(const b of balls){
      const age=(t-b.start)/b.duration;
      if(age>1.1)continue;
      next.push(b);
      if(age>=1 && !b.hit){b.hit=true;spawnPaint(b.id,b.index);continue;}
      if(age<0||age>1||focus!==null&&focus!==b.id)continue;
      const xy=positions.get(b.id);if(!xy)continue;
      const p=1-(1-age)*(1-age);
      const x=CX+(xy.x-CX)*p,y=CY+(xy.y-CY)*p;
      ctx.save();ctx.fillStyle=hue(b.id);ctx.shadowColor=hue(b.id);ctx.shadowBlur=22;
      ctx.beginPath();ctx.arc(x,y,8.5,0,7);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-2,y-2,2.7,0,7);ctx.fill();ctx.restore();
    }
    balls=next;drawNodes();
    if(db&&!visible.length){
      ctx.textAlign='center';ctx.fillStyle='#e8faff';ctx.font='700 19px system-ui';
      ctx.fillText('AUCUN ÉVÉNEMENT IDENTIFIABLE DANS CETTE SÉLECTION',CX,CY+115);
      ctx.textAlign='left';
    }
  }
  function tick(t){
    const delta=lastFrame?Math.min(.1,(t-lastFrame)/1000):0;lastFrame=t;
    if(playing&&visible.length){
      selectedMonth=null;progress=Math.min(visible.length,progress+delta*(battle?25:rate));
      while(cursor<Math.floor(progress)){
        const e=visible[cursor++];
        balls.push({id:e.target_id,index:e.index,start:t,duration:700+(e.index%5)*90});
      }
      if(cursor>=visible.length){playing=false;$('me-play').textContent='▶';}
      if(t-lastInfo>120){t-lastInfo;lastInfo=t;renderInfo();}
    }
    draw(t);requestAnimationFrame(tick);
  }
  canvas.addEventListener('click',ev=>{
    const r=canvas.getBoundingClientRect();
    const x=(ev.clientX-r.left)/r.width*W,y=(ev.clientY-r.top)/r.height*H;
    const near=leaders.find(p=>{const xy=positions.get(p.id);return xy&&Math.hypot(x-xy.x,y-xy.y)<42;});
    if(near){focus=focus===near.id?null:near.id;renderInfo();}
  });
  document.querySelectorAll('[data-me-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.meMode)));
  $('me-competition').addEventListener('change',recompute);
  $('me-season').addEventListener('change',recompute);
  $('me-month').addEventListener('input',ev=>seekMonth(Number(ev.target.value)));
  $('me-play').addEventListener('click',()=>{
    if(cursor>=visible.length)reset();playing=!playing;
    $('me-play').textContent=playing?'Ⅱ':'▶';
  });
  $('me-reset').addEventListener('click',reset);
  $('me-battle').addEventListener('click',()=>{
    battle=!battle;$('me-battle').classList.toggle('active',battle);
    if(cursor>=visible.length)reset();
    playing=true;$('me-play').textContent='Ⅱ';
  });
  $('me-speed').addEventListener('change',ev=>rate=Number(ev.target.value));
  fetch(root.dataset.base+'/data/players/messi-encounters.json')
    .then(response=>{if(!response.ok)throw new Error('données en cours de publication (HTTP '+response.status+')');return response.json();})
    .then(data=>{
      if(data.schema_version!==1||data.scope.complete_career!==false||
         !MODE_IDS.every(k=>Array.isArray(data.modes?.[k]?.events)))
        throw new Error('fichier événements incomplet ou périmètre non déclaré');
      db=data;populateFilters();say('me-sample',data.scope.liga_matches+' Liga + '+data.scope.ucl_matches+' finales C1');
      setMode('defenders');
      playing=Boolean(visible.length&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      $('me-play').textContent=playing?'Ⅱ':'▶';
    })
    .catch(e=>{
      say('me-message','Les événements ne sont pas encore publiés : '+e.message+
        '. Aucun duel, tir ou but de carrière n’est simulé. Le pipeline source doit être exécuté.');
      say('me-coverage','DONNÉES EN ATTENTE');say('me-subtitle','STATSBOMB / PUBLICATION EN ATTENTE');
      $('me-play').disabled=true;$('me-battle').disabled=true;
    });
  requestAnimationFrame(tick);
}
