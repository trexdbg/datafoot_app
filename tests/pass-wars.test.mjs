import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePartners, MIN_PARTNER_PASSES, playerColor, createPlayerPalette, layoutPlayerNodes, monthOrdinal, monthYearLabel, eventsThroughMonth } from '../src/lib/pass-wars-engine.mjs';

const make = (id, direction, name='Joueur '+id)=>({partner_id:id,partner_name:name,direction});

test('seuil > 95 strict : 95 exclus, 96 et 97 inclus',()=>{
  const events=[
    ...Array.from({length:95},()=>make(1,'given')),
    ...Array.from({length:48},()=>make(2,'given')),
    ...Array.from({length:48},()=>make(2,'received')),
    ...Array.from({length:97},(_,i)=>make(3,i%2?'given':'received')),
  ];
  const players=eligiblePartners(events);
  assert.equal(MIN_PARTNER_PASSES,96);
  assert.deepEqual(players.map(p=>[p.id,p.total]),[[3,97],[2,96]]);
  assert.equal(players[1].given,48);
  assert.equal(players[1].received,48);
});

test('un filtre de période peut cacher tous les joueurs sans changer les données brutes',()=>{
  const all=[...Array.from({length:98},()=>make(10,'given')),...Array.from({length:75},()=>make(11,'received'))];
  const shortSelection=all.slice(0,45);
  assert.equal(eligiblePartners(all).length,1);
  assert.deepEqual(eligiblePartners(shortSelection),[]);
  assert.equal(all.length,173);
});

test('plafond de 30 joueurs même lorsque 40 dépassent le seuil',()=>{
  const events=Array.from({length:40},(_,i)=>Array.from({length:96+i},()=>make(i,'received'))).flat();
  const players=eligiblePartners(events);
  assert.equal(players.length,30);
  assert.equal(players[0].id,39);
  assert.ok(players.every(p=>p.total>=96));
});

test('les données réelles publiées correspondent au seuil de la visualisation',async()=>{
  const {readFileSync}=await import('node:fs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const events=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars-events.json',import.meta.url),'utf8'));
  const expected=summary.partners.filter(p=>p.total>=96).slice(0,30).map(p=>p.id);
  const actual=eligiblePartners(events.events).map(p=>p.id);
  assert.deepEqual(actual,expected);
  assert.ok(actual.length<30,'Le nouveau réseau doit être plus clair pour cet échantillon');
});


test('une couleur distincte et stable par joueur, quel que soit le sens ou le tri',async()=>{
  const {readFileSync}=await import('node:fs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const visible=summary.partners.filter(p=>p.total>=96).slice(0,30);
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


test('palette StatsBomb : top 11 avec teintes réellement distinctes, constantes entre filtres',async()=>{
  const {readFileSync}=await import('node:fs');
  const data=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const whole=createPlayerPalette(data.partners);
  const shuffled=createPlayerPalette([...data.partners].reverse());
  const visible=data.partners.filter(p=>p.total>=96);
  const colors=visible.map(p=>whole.get(p.id));
  assert.equal(colors.length,11);
  assert.equal(new Set(colors).size,visible.length);
  for(const p of data.partners) assert.equal(whole.get(p.id),shuffled.get(p.id));
  const hues=colors.map(color=>Number(color.match(/^hsl\(([\d.]+)/)?.[1]));
  assert.ok(hues.every(Number.isFinite));
  const separation=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
  const minimum=Math.min(...hues.flatMap((h,i)=>hues.slice(i+1).map(other=>separation(h,other))));
  assert.ok(minimum>10,'Les 11 principales couleurs ne doivent pas être presque identiques');
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


test('V3 : noms usuels et photos des partenaires >95', async()=>{
  const {readFileSync}=await import('node:fs');
  const {displayPlayerName,photoFor,profileFor,photoCredits,playerInitials,MESSI_ID}=await import('../src/lib/messi-player-profiles.mjs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const roster=summary.partners.filter(p=>p.total>=96);
  assert.equal(roster.length,11);
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
    const profile=profileFor(p.id);
    assert.ok(profile,'Identité usuelle absente pour '+p.name);
    assert.ok(profile.name.length>1);
    const url=photoFor(p.id);
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
  const roster=summary.partners.filter(p=>p.total>=MIN_PARTNER_PASSES);
  const positions=layoutPlayerNodes(roster);
  assert.equal(roster.length,11);
  assert.equal(positions.size,roster.length);
  const points=roster.map(p=>positions.get(p.id));
  assert.ok(points.every(p=>p.x>=90&&p.x<=1110&&p.y>=100&&p.y<=680));
  assert.ok(points.every(p=>Math.hypot(p.x-600,p.y-390)>=175));
  assert.ok(new Set(points.map(p=>Math.round(Math.hypot(p.x-600,p.y-390)/20))).size>=6);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
    assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>115);
  const reversed=layoutPlayerNodes([...roster].reverse());
  for(const p of roster)assert.deepEqual(positions.get(p.id),reversed.get(p.id));
  const angles=points.map(p=>Math.atan2(p.y-390,p.x-600));
  assert.ok(angles.some((a,i)=>i>0&&a<angles[i-1])&&
    angles.some((a,i)=>i>0&&a>angles[i-1]),
    'Pas de progression monotone des angles par rang');
});

test('les deux routes affichent 96+ passes sans perdre les photos',async()=>{
  const {readFileSync}=await import('node:fs');
  for(const route of ['paintball','pass-wars']){
    const html=readFileSync(new URL('../src/pages/joueurs/messi/'+route+'.astro',import.meta.url),'utf8');
    assert.ok(html.includes('96+ PASSES'));
    assert.ok(!html.includes('80 PASSES MINIMUM'));
  }
  const code=readFileSync(new URL('../src/lib/pass-wars-engine.mjs',import.meta.url),'utf8');
  assert.ok(code.includes('positions=layoutPlayerNodes(players,W,H,CX,CY)'));
  assert.ok(code.includes('drawPortrait(p.id'));
  assert.ok(!code.includes('drawEdges('));
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
