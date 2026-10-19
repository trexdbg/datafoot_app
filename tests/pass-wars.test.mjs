import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePartners, MIN_PARTNER_PASSES, playerColor, createPlayerPalette, layoutPlayerNodes, monthOrdinal, monthYearLabel, eventCalendarPosition, eventsThroughMonth, passEventSeed, curvedPassPoint } from '../src/lib/pass-wars-engine.mjs';

const make = (id, direction, name='Joueur '+id)=>({partner_id:id,partner_name:name,direction});

test('seuil strict : 500 passes reçues de Messi insuffisantes, 501 éligibles',()=>{
  const events=[
    ...Array.from({length:500},()=>make(1,'given')),
    ...Array.from({length:501},()=>make(2,'given')),
    ...Array.from({length:1500},()=>make(2,'received')),
    ...Array.from({length:900},()=>make(3,'received')),
    ...Array.from({length:602},()=>make(4,'given')),
  ];
  const players=eligiblePartners(events);
  assert.equal(MIN_PARTNER_PASSES,501);
  assert.deepEqual(players.map(p=>[p.id,p.given,p.received]),[[4,602,0],[2,501,1500]]);
  assert.ok(!players.some(p=>p.id===1),'500 exactement ne passe pas');
  assert.ok(!players.some(p=>p.id===3),'passe vers Messi ne qualifie pas le partenaire');
});

test('le seuil de 501 reçues de Messi se recalcule au changement de période',()=>{
  const all=Array.from({length:501},()=>make(10,'given'));
  assert.equal(eligiblePartners(all).length,1);
  assert.deepEqual(eligiblePartners(all.slice(0,500)),[]);
  assert.equal(all.length,501);
});

test('plafond des 30 plus grands receveurs de Messi si 40 dépassent le seuil',()=>{
  const events=Array.from({length:40},(_,i)=>Array.from({length:501+i},()=>make(i,'given'))).flat();
  const players=eligiblePartners(events);
  assert.equal(players.length,30);
  assert.equal(players[0].id,39);
  assert.ok(players.every(p=>p.given>500));
});

test('le seuil des 501 passes est mondial et stable entre les filtres de saison',()=>{
  const source=[
    ...Array.from({length:505},()=>make(12,'given')),
    ...Array.from({length:450},()=>make(13,'given')),
    ...Array.from({length:3000},()=>make(13,'received')),
  ];
  const global=new Set(eligiblePartners(source).map(p=>p.id));
  const oneSeason=[...Array.from({length:22},()=>make(12,'given')),
    ...Array.from({length:100},()=>make(13,'given'))];
  const seasonEligible=eligiblePartners(oneSeason,0,Infinity).filter(p=>global.has(p.id));
  assert.deepEqual(seasonEligible.map(p=>p.id),[12]);
  assert.equal(eligiblePartners(oneSeason).length,0,'Le seuil ne doit pas être réappliqué à chaque saison');
});

test('les données réelles publiées correspondent au seuil de la visualisation',async()=>{
  const {readFileSync}=await import('node:fs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const events=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars-events.json',import.meta.url),'utf8'));
  const expected=summary.partners.filter(p=>p.given>=501).sort((a,b)=>
    b.given-a.given||b.total-a.total||String(a.name).localeCompare(String(b.name))||a.id-b.id
  ).slice(0,30).map(p=>p.id);
  const actual=eligiblePartners(events.events).map(p=>p.id);
  assert.deepEqual(actual,expected);
  assert.ok(actual.length>=1 && actual.length<=30,'Le classement garde son plafond de 30 joueurs même avec la couverture complète');
});


test('une couleur distincte et stable par joueur, quel que soit le sens ou le tri',async()=>{
  const {readFileSync}=await import('node:fs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const visible=summary.partners.filter(p=>p.given>=501).slice(0,30);
  const colors=visible.map(p=>playerColor(p.id));
  assert.equal(new Set(colors).size,visible.length,'Chaque joueur visible doit avoir sa couleur propre');
  assert.ok(colors.every(color=>/^hsl\(\d+\.\d{3} \d+% \d+%\)$/.test(color)));
  assert.equal(playerColor(5503),playerColor(5503));
  assert.notEqual(playerColor(5503),playerColor(42));
  assert.deepEqual(visible.slice().reverse().map(p=>playerColor(p.id)).reverse(),colors);
});

test('le réseau paintball ne dessine plus de connexions fixes',async()=>{
  const {readFileSync}=await import('node:fs');
  const engine=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(!engine.includes('drawEdges('));
  assert.ok(!engine.includes('function line('));
  assert.ok(engine.includes('const color=colorOf(p.id)'));
  assert.ok(engine.includes('const color=colorOf(id)'));
  assert.ok(engine.includes('stampPaint(p.id,p.direction,p.index)'));
});


test('palette StatsBomb : teintes réellement distinctes, constantes entre filtres',async()=>{
  const {readFileSync}=await import('node:fs');
  const data=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const whole=createPlayerPalette(data.partners);
  const shuffled=createPlayerPalette([...data.partners].reverse());
  const visible=data.partners.filter(p=>p.given>=501).slice(0,30);
  const colors=visible.map(p=>whole.get(p.id));
  assert.ok(colors.length>=11&&colors.length<=30);
  assert.equal(new Set(colors).size,visible.length);
  for(const p of data.partners) assert.equal(whole.get(p.id),shuffled.get(p.id));
  const hues=colors.map(color=>Number(color.match(/^hsl\(([\d.]+)/)?.[1]));
  assert.ok(hues.every(Number.isFinite));
  const separation=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
  const minimum=Math.min(...hues.flatMap((h,i)=>hues.slice(i+1).map(other=>separation(h,other))));
  assert.ok(minimum>3,'Les couleurs ne doivent pas être identiques');
});


test('aucune des deux visualisations Messi ne trace de traits (ni liens, ni grilles, ni traînées)',async()=>{
  const {readFileSync}=await import('node:fs');
  const newer=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  const old=readFileSync(new URL('../src/pages/matchs/finale-2022/messi.astro',import.meta.url),'utf8');
  for(const [label,source] of [['Pass Wars',newer],['Finale 2022',old]]){
    assert.ok(!/drawEdges\s*\(/.test(source),label+' : liens persistants');
    assert.ok(!/ctx\.stroke\s*\(|ctx\.strokeStyle|ctx\.setLineDash|ctx\.ellipse\s*\(/.test(source),
      label+' : traits graphiques persistants');
  }
  assert.ok(!newer.includes('for(let dot=1;dot<=5;dot++)'),'Pas de pointillés formant une trajectoire');
  assert.ok(!old.includes('function line('),'Pas de traceur de segments dans la vue de la finale');
  assert.ok(newer.includes('stampPaint(p.id,p.direction,p.index)'));
  assert.ok(old.includes('splatter(p.partner_id,p.direction,p.index)'));
});


test('la vignette Messi de l’accueil ne contient AUCUN trait SVG',async()=>{
  const {readFileSync}=await import('node:fs');
  const html=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
  const begin=html.indexOf('<section class="shell mw-home-feature" aria-labelledby="orbit-home-title">');
  assert.ok(begin>=0,'La vignette Messi doit exister');
  const end=html.indexOf('</section>',begin);
  const preview=html.slice(begin,end);
  assert.ok(!/<path\b|<line\b|stroke=|stroke-width=|<polyline\b/.test(preview),'Il ne doit rester aucun segment sur la vignette Messi');
  assert.ok(preview.includes('/joueurs/messi/paintball/'),'La vignette doit mener à la nouvelle version non mise en cache');
  assert.ok(preview.includes('PAINTBALL V3 · ZÉRO TRAIT'));
});

test('la route paintball v3 neuve est cohérente avec le réseau sans traits',async()=>{
  const {readFileSync}=await import('node:fs');
  const fresh=readFileSync(new URL('../src/pages/joueurs/messi/paintball.astro',import.meta.url),'utf8');
  const old=readFileSync(new URL('../src/pages/joueurs/messi/pass-wars.astro',import.meta.url),'utf8');
  const core=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(fresh.includes('bootPassWars()'));
  assert.ok(fresh.includes('PAINTBALL V3 · 0 TRAIT'));
  assert.ok(old.includes('PAINTBALL V3 · AUCUN TRAIT'));
  assert.ok(!/ctx\.stroke\s*\(|ctx\.setLineDash|drawEdges\s*\(/.test(core));
});


test('V3 : noms usuels et photos des partenaires recevant >500 passes', async()=>{
  const {readFileSync}=await import('node:fs');
  const {displayPlayerName,photoFor,profileFor,photoCredits,playerInitials,MESSI_ID}=await import('../src/lib/messi-player-profiles.mjs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const roster=summary.partners.filter(p=>p.given>=501).slice(0,30);
  assert.ok(roster.length>=11);
  assert.equal(displayPlayerName(20131,'Xavier Hernández Creus'),'Xavi');
  assert.equal(displayPlayerName(19757,'Anderson Luís de Souza'),'Deco');
  assert.equal(displayPlayerName(25879,'Ronaldo de Assis Moreira'),'Ronaldinho');
  assert.equal(displayPlayerName(4324,'Daniel Alves da Silva'),'Dani Alves');
  assert.equal(displayPlayerName(3958,'Pedro Eliezer Rodríguez Ledesma'),'Pedro');
  assert.equal(displayPlayerName(999999,'Nom hors catalogue'),'Nom hors catalogue');
  assert.equal(MESSI_ID,5503);
  assert.equal(playerInitials(20131),'XA');
  assert.equal(playerInitials(5503),'LM');
  for(const p of roster){
    assert.ok(displayPlayerName(p.id,p.name).length>1);
    const profile=profileFor(p.id);
    const url=photoFor(p.id);
    if(!profile||!url){
      assert.equal(url,null,'Un partenaire sans photographie libre disponible doit conserver son monogramme');
      continue;
    }
    assert.ok(profile.name.length>1);
    assert.match(url,/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
    assert.ok(url.includes('?width=160'));
    const credit=photoCredits(p.id);
    assert.ok(credit.author.length>2);
    assert.match(credit.source,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.ok(credit.license.startsWith('CC BY'));
  }
  assert.ok(photoFor(MESSI_ID,180));
  assert.equal(photoFor(123456),null);
});

test('V3 : noms et portraits présents sans réintroduire de traits',async()=>{
  const {readFileSync}=await import('node:fs');
  const engine=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  const route=readFileSync(new URL('../src/pages/joueurs/messi/paintball.astro',import.meta.url),'utf8');
  assert.ok(engine.includes('drawPortrait(p.id'));
  assert.ok(engine.includes('drawPortrait(MESSI_ID'));
  assert.ok(engine.includes('displayPlayerName(p.id,p.name)'));
  assert.ok(engine.includes('renderPhotoCredits()'));
  assert.ok(route.includes('id="pw-photos-list"'));
  assert.ok(!/ctx\.stroke\s*\(|ctx\.setLineDash|drawEdges\s*\(/.test(engine));
});


test('les onze joueurs sont dispersés et non classés en horloge',async()=>{
  const {readFileSync}=await import('node:fs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const roster=summary.partners.filter(p=>p.given>=MIN_PARTNER_PASSES).slice(0,30);
  const positions=layoutPlayerNodes(roster);
  assert.ok(roster.length>=11);
  assert.equal(positions.size,roster.length);
  const points=roster.map(p=>positions.get(p.id));
  assert.ok(points.every(p=>p.x>=90&&p.x<=1110&&p.y>=100&&p.y<=680));
  assert.ok(points.every(p=>Math.hypot(p.x-600,p.y-390)>=175));
  assert.ok(new Set(points.map(p=>Math.round(Math.hypot(p.x-600,p.y-390)/20))).size>=6);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
    assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>70);
  const reversed=layoutPlayerNodes([...roster].reverse());
  for(const p of roster)assert.deepEqual(positions.get(p.id),reversed.get(p.id));
  const angles=points.map(p=>Math.atan2(p.y-390,p.x-600));
  assert.ok(angles.some((a,i)=>i>0&&a<angles[i-1])&&
    angles.some((a,i)=>i>0&&a>angles[i-1]),
    'Pas de progression monotone des angles par rang');
});

test('les deux routes affichent 501+ passes reçues de Messi sans perdre les photos',async()=>{
  const {readFileSync}=await import('node:fs');
  for(const route of ['paintball','pass-wars']){
    const html=readFileSync(new URL('../src/pages/joueurs/messi/'+route+'.astro',import.meta.url),'utf8');
    assert.ok(html.includes('501+ PASSES DE MESSI'));
    assert.ok(!html.includes('80 PASSES MINIMUM'));
  }
  const code=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(code.includes('positions=layoutPlayerNodes(players,W,H,CX,CY,layoutSalt)'));
  assert.ok(code.includes('drawPortrait(p.id'));
  assert.ok(!code.includes('drawEdges('));
});


test('chaque rechargement peut changer le placement sans collisions ni joueur masqué',async()=>{
  const {readFileSync}=await import('node:fs');
  const data=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const roster=data.partners.filter(p=>p.given>=MIN_PARTNER_PASSES).slice(0,30);
  const base=layoutPlayerNodes(roster,1200,780,600,385,111);
  const moved=layoutPlayerNodes(roster,1200,780,600,385,222);
  assert.equal(base.size,roster.length);
  assert.equal(moved.size,roster.length);
  assert.ok(roster.some(p=>Math.hypot(base.get(p.id).x-moved.get(p.id).x,
                                     base.get(p.id).y-moved.get(p.id).y)>60),
    'Le placement doit changer d’une session à la suivante');
  for(const salt of [0,1,111,222,987654321]){
    const points=[...layoutPlayerNodes(roster,1200,780,600,385,salt).values()];
    assert.equal(points.length,roster.length,'Aucun joueur ne doit disparaître');
    assert.ok(points.every(p=>p.x>=100&&p.x<=1100&&p.y>=110&&p.y<=670),
      'Portrait et légende doivent rester dans le canvas');
    assert.ok(points.every(p=>Math.hypot(p.x-600,p.y-385)>=195),
      'Aucun partenaire ne doit être caché derrière Messi');
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
      assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>=70,
        'Les portraits et étiquettes ne doivent pas se chevaucher');
  }
});

test('la lecture du calendrier progresse à intervalle régulier, même les mois vides',async()=>{
  const jan=monthOrdinal('2015-01-01');
  assert.equal(monthOrdinal('2015-02-01')-jan,1);
  assert.equal(monthOrdinal('2016-01-01')-jan,12);
  assert.equal(eventCalendarPosition('2015-01-01'),jan);
  assert.ok(eventCalendarPosition('2015-01-20')>jan);
  assert.ok(eventCalendarPosition('2015-01-20')<jan+1);
  assert.equal(eventCalendarPosition('2015-02-01'),jan+1);
  assert.equal(eventCalendarPosition('date invalide'),null);
  const {readFileSync}=await import('node:fs');
  const core=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(core.includes('calendarPosition=Math.min(end,calendarPosition+dt*(battle?24:speed))'));
  assert.ok(core.includes('eventCalendarPosition(events[cursor].date)<calendarPosition'));
  assert.ok(core.includes('timelineFirst=first;timelineLast=last'));
  assert.ok(core.includes('window.crypto.getRandomValues(bytes)'));
  for(const route of ['paintball','pass-wars']){
    const html=readFileSync(new URL('../src/pages/joueurs/messi/'+route+'.astro',import.meta.url),'utf8');
    assert.ok(html.indexOf('id="pw-now"')<html.indexOf('id="pw-canvas"'),
      'La date ne doit plus recouvrir un joueur');
    assert.ok(html.includes('value="4" selected>×4'));
  }
});

test('les courbes pseudo-aléatoires ont des chemins variés et les bonnes extrémités',()=>{
  const from={x:600,y:385},to={x:270,y:145};
  const seed1=passEventSeed({id:'uuid-pass-1'});
  const seed2=passEventSeed({id:'uuid-pass-2'});
  assert.equal(passEventSeed({id:'uuid-pass-1'}),seed1);
  assert.notEqual(seed1,seed2);
  assert.deepEqual(curvedPassPoint(from,to,0,seed1),from);
  assert.deepEqual(curvedPassPoint(from,to,1,seed1),to);
  const p1=curvedPassPoint(from,to,.5,seed1);
  const p2=curvedPassPoint(from,to,.5,seed2);
  assert.ok(Math.hypot(p1.x-p2.x,p1.y-p2.y)>.1,'Différentes passes, différentes courbures');
  const reverse=curvedPassPoint(to,from,1,seed2);
  assert.deepEqual(reverse,from,'Le retour du partenaire termine bien sur Messi');
  for(let i=0;i<100;i++){
    const point=curvedPassPoint(from,to,i/100,passEventSeed({id:'shot-'+i}));
    assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
  }
});

test('une mini-bille par passe et aucune coupe de file : garde les événements StatsBomb',async()=>{
  const {readFileSync}=await import('node:fs');
  const engine=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(engine.includes('careerReceiverIds=new Set(meta.partners.filter(p=>p.given>=MIN_PARTNER_PASSES)'));
  assert.ok(engine.includes('players=eligiblePartners(filtered,0,Infinity)'));
  assert.ok(engine.includes('.filter(p=>careerReceiverIds.has(p.id)).slice(0,30)'));
  assert.ok(engine.includes('const event=events[releaseCursor++]'));
  assert.ok(engine.includes('balls.push({id:event.partner_id'));
  assert.ok(engine.includes('releaseCursor>=cursor'));
  assert.ok(engine.includes('const MAX_ACTIVE_BALLS=1200'));
  assert.ok(engine.includes('flightCredit'));
  assert.ok(engine.includes('emitted++'));
  assert.ok(engine.includes('curvedPassPoint(from,to,age,p.seed)'));
  assert.ok(engine.includes('stampMiniImpact(p,to)'));
  assert.ok(engine.includes('radius:PARTICLE_RADIUS'));
  assert.ok(!engine.includes('sampleVisualPasses('));
  assert.ok(!engine.includes('thinVisualQueue('));
  assert.ok(!engine.includes('visualQueue='));
  assert.ok(!engine.includes('balls=balls.slice('));
  assert.ok(engine.includes('while(cursor<events.length)count(events[cursor++]);'));
  assert.ok(engine.includes('while(cursor<end)count(events[cursor++]);'));
  assert.ok(engine.includes('releaseCursor=cursor;'),
    'Scrubbing explicite réinitialise correctement la file');
});

test('simulation haute densité : chacune des 10 000 passes lance une bille sans perte ni gel',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  function launchDuePasses(dt,t){');
  const end=source.indexOf('  function seek(n,month=null){',start);
  assert.ok(start>0&&end>start);
  const scheduler=source.slice(start,end);
  const runner=new Function('events','passEventSeed',`
    const ids=[11,22,33,44],positions=new Map(ids.map((id,i)=>[id,{x:130+i*200,y:230}]));
    const MAX_ACTIVE_BALLS=1200,PARTICLE_RADIUS=1.4;
    const timelineFirst=24050,timelineLast=24289,speed=4,battle=false,focus=null;
    let balls=[],cursor=events.length,releaseCursor=0,emitted=0,flightCredit=0;
    let peak=0,t=0,steps=0;
    ${scheduler}
    while((releaseCursor<events.length||balls.length)&&steps<8000){
      t+=1000/60;
      balls=balls.filter(b=>t-b.start<b.duration);
      launchDuePasses(1/60,t);
      peak=Math.max(peak,balls.length);steps++;
    }
    return {emitted,releaseCursor,peak,done:releaseCursor===events.length&&balls.length===0};
  `);
  const events=Array.from({length:10000},(_,i)=>({
    id:'real-'+i,partner_id:[11,22,33,44][i%4],index:i,direction:i%2?'given':'received'
  }));
  const simulated=runner(events,passEventSeed);
  assert.equal(simulated.emitted,10000,'Chaque vraie passe doit produire une bille');
  assert.equal(simulated.releaseCursor,10000,'Aucune passe perdue par découpage de la file');
  assert.ok(simulated.peak<=1200,'Aucun freeze par surcharge de Canvas');
  assert.equal(simulated.done,true,'La lecture doit finir après la dernière bille');
});

test('frise chronologique : uniquement mois/année sans jour ni minute',()=>{
  assert.equal(monthOrdinal('2004-10-24'),2004*12+9);
  assert.equal(monthOrdinal('2022-12-18'),2022*12+11);
  assert.equal(monthYearLabel(monthOrdinal('2004-10-24')),'10/2004');
  assert.equal(monthYearLabel(monthOrdinal('2022-12-18')),'12/2022');
  assert.equal(monthYearLabel(monthOrdinal('2020-02-01')),'02/2020');
  assert.equal(monthYearLabel(null),'--/----');
  assert.equal(monthOrdinal('invalide'),null);
  assert.equal(monthOrdinal('2022-13-05'),null);
});

test('frise : avance au dernier événement du mois, même quand un mois ne contient aucune passe',()=>{
  const events=[
    {date:'2004-10-24'},
    {date:'2004-10-24'},
    {date:'2004-12-01'},
    {date:'2005-01-30'},
    {date:'2005-01-30'},
    {date:'2006-08-12'},
  ];
  assert.equal(eventsThroughMonth(events,monthOrdinal('2004-09-01')),0);
  assert.equal(eventsThroughMonth(events,monthOrdinal('2004-10-01')),2);
  assert.equal(eventsThroughMonth(events,monthOrdinal('2004-11-01')),2);
  assert.equal(eventsThroughMonth(events,monthOrdinal('2004-12-01')),3);
  assert.equal(eventsThroughMonth(events,monthOrdinal('2005-01-01')),5);
  assert.equal(eventsThroughMonth(events,monthOrdinal('2005-09-01')),5);
  assert.equal(eventsThroughMonth(events,monthOrdinal('2006-08-01')),6);
  assert.equal(eventsThroughMonth([],monthOrdinal('2022-01-01')),0);
});

test('chronologie visible directement sous le graphe sur les deux pages et sans ancien curseur',async()=>{
  const {readFileSync}=await import('node:fs');
  for(const route of ['paintball','pass-wars']){
    const html=readFileSync(new URL('../src/pages/joueurs/messi/'+route+'.astro',import.meta.url),'utf8');
    assert.ok(html.includes('id="pw-now"'));
    assert.ok(html.includes('id="pw-month-scrub"'));
    assert.ok(!html.includes('id="pw-scrub"'));
    assert.ok(html.includes('MOIS / ANNÉE'));
    assert.ok(html.indexOf('id="pw-canvas"')<html.indexOf('id="pw-month-scrub"'));
    assert.ok(html.indexOf('id="pw-month-scrub"')<html.indexOf('class="pw-canvas-legend"'));
    assert.ok(html.includes('id="pw-month-ticks"'));
  }
  const core=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(core.includes('seek(eventsThroughMonth(events,month),month)'));
  assert.ok(core.includes("set('pw-now',monthYearLabel(month))"));
  assert.ok(!core.includes("'pw-scrub'"));
  assert.ok(!/ctx\.stroke\s*\(|ctx\.setLineDash|drawEdges\s*\(/.test(core));
});
