import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePartners, MIN_PARTNER_PASSES } from '../src/lib/pass-wars-engine.mjs';

const make = (id, direction, name='Joueur '+id)=>({partner_id:id,partner_name:name,direction});

test('seuil 80 inclus : 79 exclus, 80 et 81 conservés',()=>{
  const events=[
    ...Array.from({length:79},()=>make(1,'given')),
    ...Array.from({length:40},()=>make(2,'given')),
    ...Array.from({length:40},()=>make(2,'received')),
    ...Array.from({length:81},(_,i)=>make(3,i%2?'given':'received')),
  ];
  const players=eligiblePartners(events);
  assert.equal(MIN_PARTNER_PASSES,80);
  assert.deepEqual(players.map(p=>[p.id,p.total]),[[3,81],[2,80]]);
  assert.equal(players[1].given,40);
  assert.equal(players[1].received,40);
});

test('un filtre de période peut cacher tous les joueurs sans changer les données brutes',()=>{
  const all=[...Array.from({length:90},()=>make(10,'given')),...Array.from({length:75},()=>make(11,'received'))];
  const shortSelection=all.slice(0,45);
  assert.equal(eligiblePartners(all).length,1);
  assert.deepEqual(eligiblePartners(shortSelection),[]);
  assert.equal(all.length,165);
});

test('plafond de 30 joueurs même lorsque 40 dépassent le seuil',()=>{
  const events=Array.from({length:40},(_,i)=>Array.from({length:80+i},()=>make(i,'received'))).flat();
  const players=eligiblePartners(events);
  assert.equal(players.length,30);
  assert.equal(players[0].id,39);
  assert.ok(players.every(p=>p.total>=80));
});

test('les données réelles publiées correspondent au seuil de la visualisation',async()=>{
  const {readFileSync}=await import('node:fs');
  const summary=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars.json',import.meta.url),'utf8'));
  const events=JSON.parse(readFileSync(new URL('../src/data/players/messi-pass-wars-events.json',import.meta.url),'utf8'));
  const expected=summary.partners.filter(p=>p.total>=80).slice(0,30).map(p=>p.id);
  const actual=eligiblePartners(events.events).map(p=>p.id);
  assert.deepEqual(actual,expected);
  assert.ok(actual.length<30,'Le nouveau réseau doit être plus clair pour cet échantillon');
});
