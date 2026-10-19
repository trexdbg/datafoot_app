import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THERMAL_STOPS,THERMAL_GRADIENT,thermalColor,thermalLabel} from '../src/lib/pulse-temperature.mjs';

test('full 0–100 activity spectrum has blue / cyan / green at 50 / orange / red / violet',()=>{
 assert.deepEqual(THERMAL_STOPS.map(s=>s.at),[0,20,35,50,63,75,87,95,100]);
 assert.equal(thermalColor(0),'#4E79EB');
 assert.equal(thermalColor(20),'#38A8EC');
 assert.equal(thermalColor(35),'#32BCCD');
 assert.equal(thermalColor(50),'#50CC86');
 assert.equal(thermalColor(63),'#D9DA59');
 assert.equal(thermalColor(75),'#FF9B4A');
 assert.equal(thermalColor(87),'#F95D69');
 assert.equal(thermalColor(95),'#BA65E9');
 assert.equal(thermalColor(100),'#8A50F2');
 assert.match(THERMAL_GRADIENT,/linear-gradient\(90deg/);
});
test('colors interpolate between stops instead of jumping between old bands',()=>{
 assert.notEqual(thermalColor(49),thermalColor(50));
 assert.notEqual(thermalColor(50),thermalColor(51));
 assert.notEqual(thermalColor(94),thermalColor(95));
 assert.equal(thermalColor(50),'#50CC86');
 assert.equal(thermalColor(-40),'#4E79EB');
 assert.equal(thermalColor(200),'#8A50F2');
 assert.equal(thermalColor(null),'#34465A');
 assert.equal(thermalLabel(null),'Hors terrain');
 assert.equal(thermalLabel(95),'En feu');
 assert.equal(thermalLabel(10),'Froid');
});
test('player detail and mini graphs use the same thermal scale without recoloring Impact or teams',()=>{
 const detail=readFileSync('src/pages/mondial-2022/matchs/[id]/profil.astro','utf8');
 const small=readFileSync('src/components/WorldCupWave.astro','utf8');
 const match=readFileSync('src/components/WorldCupMatchComparison.astro','utf8');
 assert.ok(detail.includes('stroke="url(#wc-thermal-gradient)"'));
 assert.ok(detail.includes('thermalStops:THERMAL_STOPS'));
 assert.ok(detail.includes("thermalLine.setAttribute('display',mode==='activity'"));
 assert.ok(detail.includes("impactLine.setAttribute('display',mode==='impact'"));
 assert.ok(detail.includes('heatColor(score)'));
 assert.ok(small.includes("metric==='activity'?'url(#'+clipPrefix+'-thermal)'"));
 assert.ok(small.includes("metric==='activity'&&<div class="+'"wc-wave-thermal-key"'));
 assert.ok(match.includes('data-wc-duel'));
 assert.ok(!match.includes('pulse-temperature.mjs'),'national teams retain their existing distinct colors');
});
