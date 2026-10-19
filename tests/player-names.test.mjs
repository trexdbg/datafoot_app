import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {familiarPlayerName} from '../src/lib/player-names.mjs';

test('official StatsBomb names become familiar football names',()=>{
 const cases=[
  [3009,'Kylian Mbappé Lottin','France','Kylian Mbappé'],
  [5503,'Lionel Andrés Messi Cuccittini','Argentina','Lionel Messi'],
  [999,'Cristiano Ronaldo dos Santos Aveiro','Portugal','Cristiano Ronaldo'],
  [1001,'Rodrigo Hernández Cascante','Spain','Rodri'],
  [1002,'Pablo Martín Páez Gavira','Spain','Gavi'],
  [1003,'Neymar da Silva Santos Júnior','Brazil','Neymar'],
  [1004,'Bernardo Mota Veiga de Carvalho e Silva','Portugal','Bernardo Silva'],
  [8519,'Dayotchanculle Upamecano','France','Dayot Upamecano'],
  [5484,'Lucas Hernández Pi','France','Lucas Hernández'],
  [6704,'Theo Bernard François Hernández','France','Theo Hernández'],
  [10481,'Aurélien Djani Tchouaméni','France','Aurélien Tchouaméni'],
  [27886,'Alexis Mac Allister','Argentina','Alexis Mac Allister']
 ];
 for(const [id,original,country,expected] of cases)
  assert.equal(familiarPlayerName(id,original,country),expected,original);
});

test('unknown names preserve meaningful family particles and simple names',()=>{
 assert.equal(familiarPlayerName(9999,'Kevin De Bruyne','Belgium'),'Kevin De Bruyne');
 assert.equal(familiarPlayerName(9999,'Ángel Di María','Argentina'),'Ángel Di María');
 assert.equal(familiarPlayerName(9999,'Alexis Mac Allister','Argentina'),'Alexis Mac Allister');
 assert.equal(familiarPlayerName(9999,'Jude Bellingham','England'),'Jude Bellingham');
 assert.equal(familiarPlayerName(9999,'Nahuel Molina Lucero','Argentina'),'Nahuel Molina');
 assert.equal(familiarPlayerName(9999,'Theo Bernard François Hernández','France'),'Theo Hernández');
 assert.equal(familiarPlayerName(9999,'  Lionel Andrés   Messi Cuccittini  ','Argentina'),'Lionel Messi');
});

test('the source identity is not mutated when formatting a display name',()=>{
 const player={id:3009,name:'Kylian Mbappé Lottin',team:'France'};
 const alias=familiarPlayerName(player.id,player.name,player.team);
 assert.equal(alias,'Kylian Mbappé');
 assert.equal(player.name,'Kylian Mbappé Lottin');
});

test('World Cup UI uses display-name helper and retains full-name search',()=>{
 const index=readFileSync(new URL('../src/pages/mondial-2022/joueurs/index.astro',import.meta.url),'utf8');
 const match=readFileSync(new URL('../src/pages/mondial-2022/matchs/[id].astro',import.meta.url),'utf8');
 const inspector=readFileSync(new URL('../src/pages/mondial-2022/matchs/[id]/profil.astro',import.meta.url),'utf8');
 assert.match(index,/data-player-name=\{player\.name\+' '\+playerName\(player\)\}/);
 assert.match(match,/playerName\(player\)/);
 assert.match(inspector,/id:p\.player\.id,name:playerName\(p\.player\)/);
});
