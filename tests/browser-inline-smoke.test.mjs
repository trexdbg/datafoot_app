/**
 * Browser smoke tests: Astro does not typecheck scripts marked is:inline.
 * Regression: one duplicate const previously froze the entire player page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const astroFiles=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
 const filename=join(folder,entry.name);
 return entry.isDirectory()?astroFiles(filename):entry.name.endsWith('.astro')?[filename]:[];
});
const inlineScripts=source=>[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(match=>match[1].includes('is:inline')).map(match=>match[2]);

test('Every inline Astro browser script is syntactically valid JavaScript',()=>{
 let checked=0;
 for(const path of astroFiles('src')) {
  for(const code of inlineScripts(readFileSync(path,'utf8'))) {
   assert.doesNotThrow(()=>new vm.Script(code,{filename:path}),path+' must parse');
   checked++;
  }
 }
 assert.ok(checked>=4);
});

class Element {
 constructor(name='div'){
  this.name=name;this.textContent='';this.innerHTML='';this.value='';this.dataset={};
  this.style={};this.attributes={};this.listeners={};this.children=[];
  this.hidden=false;this.href='';this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};
 }
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 addEventListener(event,callback){(this.listeners[event]??=[]).push(callback);}
 emit(event,detail={}){for(const fn of this.listeners[event]??[])fn({preventDefault:()=>{},key:'',...detail});}
 replaceChildren(...children){this.children=children;}
 append(...children){this.children.push(...children);}
 getBoundingClientRect(){return {left:0,top:0,width:1140,height:456};}
 scrollIntoView(){}
}
test('player dropdown, graph modes, minute slider and actions respond to clicks',()=>{
 const source=readFileSync('src/pages/mondial-2022/matchs/[id]/profil.astro','utf8');
 const [script]=inlineScripts(source);
 assert.ok(script,'player inspector inline script must exist');
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
 const modes=['activity','impact'].map(mode=>Object.assign(new Element('button'),{dataset:{mode}}));
 const filters=['all','assist','other'].map(filter=>Object.assign(new Element('button'),{dataset:{filter}}));
 const steps=[-1,1].map(step=>Object.assign(new Element('button'),{dataset:{step:String(step)}}));
 const lines=Array.from({length:3},()=>new Element('path'));
 const document={
  getElementById:node,
  querySelectorAll(selector){
   if(selector.includes('.wc-band-line'))return lines;
   if(selector==='[data-mode]')return modes;
   if(selector==='[data-filter]')return filters;
   if(selector==='[data-step]')return steps;
   return [];
  },
  createElement:name=>new Element(name),
  createElementNS:(_ns,name)=>new Element(name)
 };
 const timeline=(entry,peakMinute,peakScore)=>Array.from({length:91},(_,minute)=>({
  activity:minute<entry?null:minute===peakMinute?peakScore:minute===entry?50:Math.max(0,50-(minute-entry)/3),
  impact:minute<entry?null:minute===peakMinute?87:4,
  actions:minute===peakMinute?1:0,penaltyGain:0
 }));
 const players=[
  {id:101,name:'Premier Joueur',team:'France',entry:0,exit:null,
   timeline:timeline(0,18,82),
   events:[{minute:18,second:22,kind:'Shot',outcome:'Goal',penalty:0}]},
  {id:202,name:'Deuxième Joueur',team:'Argentina',entry:60,exit:null,
   timeline:timeline(60,75,94),
   events:[{minute:75,second:18,kind:'Pass',outcome:'Complete',goalAssist:true,penalty:0}]}
 ];
 const location={href:'https://example.test/datafoot_app/mondial-2022/matchs/1/profil/?joueur=101',search:'?joueur=101'};
 const history={replaceState(_state,_title,url){location.href=String(url);location.search=new URL(String(url)).search;}};
 assert.doesNotThrow(()=>new vm.Script(script).runInNewContext({
  document,location,history,URL,URLSearchParams,players,duration:90,defaultId:101,basePath:'/datafoot_app'
 },{timeout:4000}));
 assert.equal(node('wc-current-name').textContent,'Premier Joueur');
 const priorPath=lines[0].attributes.d;
 const dropdown=node('wc-select-player');
 dropdown.value='202';dropdown.emit('change');
 assert.equal(node('wc-current-name').textContent,'Deuxième Joueur');
 assert.ok(node('wc-peak').innerHTML.includes('94'));
 assert.notEqual(lines[0].attributes.d,priorPath);
 assert.equal(new URL(location.href).searchParams.get('joueur'),'202');
 assert.ok(node('wc-minute-actions').children.some(chip=>String(chip.textContent).includes('PASSE DÉCISIVE')));
 modes[1].emit('click');
 assert.match(node('wc-mode-title').textContent,/Impact/,'changing mode updates the title');
 const slider=node('wc-minute-slider');
 slider.value='62';slider.emit('input');
 assert.equal(node('wc-readout').textContent,'62′');
 steps[1].emit('click');
 assert.equal(node('wc-readout').textContent,'63′');
 node('wc-profile-hit').emit('pointerdown',{clientX:58+1013*(75/90)});
 assert.equal(node('wc-readout').textContent,'75′');
 filters[1].emit('click');
 assert.equal(node('wc-log').children.length,1);
});
