/**
 * Noms sportifs lisibles pour l'interface DataFoot.
 * Les noms complets StatsBomb restent dans les JSON d'origine et servent
 * toujours à l'identification (avec les IDs) et à la recherche.
 *
 * Privilégier les surnoms / noms d'usage explicitement connus. Pour les autres,
 * une simplification prudente ne supprime que les prénoms intermédiaires
 * ou un second patronyme lorsqu'il y en a plusieurs.
 */
const KNOWN_BY_ID = new Map(Object.entries({
  3009: 'Kylian Mbappé',
  5503: 'Lionel Messi',
  10481: 'Aurélien Tchouaméni',
  8519: 'Dayot Upamecano',
  5484: 'Lucas Hernández',
  6704: 'Theo Hernández',
  7797: 'Rodrigo De Paul',
  38718: 'Enzo Fernández',
  27886: 'Alexis Mac Allister',
  30486: 'Pedri',
  5203: 'Sergio Busquets',
  5216: 'Andrés Iniesta',
  4324: 'Dani Alves',
  5211: 'Jordi Alba',
  4320: 'Neymar',
  5208: 'Thiago Alcântara',
  5470: 'Ivan Rakitić',
  5246: 'Luis Suárez'
}).map(([id,alias])=>[Number(id),alias]));

// L'identifiant n'est pas toujours présent dans les articles externes.
// Ces équivalences s'appliquent seulement à des noms bien reconnaissables.
const KNOWN_BY_NAME = [
  [/^kylian mbapp[eé] lottin$/i,'Kylian Mbappé'],
  [/^lionel (?:andr[eé]s )?messi(?: cuccittini)?$/i,'Lionel Messi'],
  [/^cristiano ronaldo(?: dos santos aveiro)?$/i,'Cristiano Ronaldo'],
  [/^neymar(?: da silva santos (?:j[uú]nior|junior))?$/i,'Neymar'],
  [/^vin[ií]cius jos[eé] paix[aã]o de oliveira j[uú]nior$/i,'Vinícius Júnior'],
  [/^rodrigo hern[aá]ndez cascante$/i,'Rodri'],
  [/^pablo mart[ií]n p[aá]ez gavira$/i,'Gavi'],
  [/^pedro gonz[aá]lez l[oó]pez$/i,'Pedri'],
  [/^bernardo mota veiga de carvalho e silva$/i,'Bernardo Silva'],
  [/^bruno miguel borges fernandes$/i,'Bruno Fernandes'],
  [/^jo[aã]o f[eé]lix sequeira$/i,'João Félix'],
  [/^rafael alexandre da concei[cç][aã]o le[aã]o$/i,'Rafael Leão'],
  [/^richarlison de andrade$/i,'Richarlison'],
  [/^marcos ao[aá]s corr[eê]a$/i,'Marquinhos'],
  [/^carlos henrique .*casimiro$/i,'Casemiro'],
  [/^rodrigo silva de goes$/i,'Rodrygo'],
  [/^lucas tolentino coelho de lima$/i,'Lucas Paquetá'],
  [/^raphael dias belloli$/i,'Raphinha'],
  [/^gabriel fernando de jesus$/i,'Gabriel Jesus'],
  [/^thiago emiliano da silva$/i,'Thiago Silva'],
  [/^alisson rams[eé]s becker$/i,'Alisson'],
  [/^ederson santana de moraes$/i,'Ederson'],
  [/^darwin gabriel n[uú][nñ]ez ribeiro$/i,'Darwin Núñez'],
  [/^luis alberto su[aá]rez d[ií]az$/i,'Luis Suárez'],
  [/^edinson roberto cavani g[oó]mez$/i,'Edinson Cavani'],
  [/^dam[iá]an emiliano mart[ií]nez(?: romero)?$/i,'Emiliano Martínez'],
  [/^[aá]ngel fabi[aá]n di mar[ií]a(?: hern[aá]ndez)?$/i,'Ángel Di María'],
  [/^rodrigo javier de paul$/i,'Rodrigo De Paul'],
  [/^paulo bruno exequiel dybala$/i,'Paulo Dybala'],
  [/^enzo jerem[ií]as fern[aá]ndez$/i,'Enzo Fernández'],
  [/^gonzalo ariel montiel$/i,'Gonzalo Montiel'],
  [/^marcos javier acu[nñ]a$/i,'Marcos Acuña'],
  [/^lautaro javier mart[ií]nez$/i,'Lautaro Martínez'],
  [/^cristian gabriel romero$/i,'Cristian Romero'],
  [/^jude victor william bellingham$/i,'Jude Bellingham'],
  [/^bukayo .*saka$/i,'Bukayo Saka'],
  [/^raheem shaquille sterling$/i,'Raheem Sterling'],
  [/^phil walter foden$/i,'Phil Foden'],
  [/^kyle andrew walker$/i,'Kyle Walker'],
  [/^aur[eé]lien djani tchouam[eé]ni$/i,'Aurélien Tchouaméni'],
  [/^theo bernard fran[cç]ois hern[aá]ndez$/i,'Theo Hernández'],
  [/^dayotchanculle upamecano$/i,'Dayot Upamecano'],
  [/^lucas hern[aá]ndez pi$/i,'Lucas Hernández'],
  [/^karim mostafa benzema$/i,'Karim Benzema'],
  [/^romelu lukaku menama$/i,'Romelu Lukaku'],
  [/^thibaut nicolas marc courtois$/i,'Thibaut Courtois'],
  [/^yannick ferreira carrasco$/i,'Yannick Carrasco'],
  [/^achraf hakimi mouh$/i,'Achraf Hakimi'],
  [/^manuel peter neuer$/i,'Manuel Neuer'],
  [/^ferran torres garc[ií]a$/i,'Ferran Torres'],
  [/^[aá]lvaro borja morata mart[ií]n$/i,'Álvaro Morata'],
  [/^dani olmo carvajal$/i,'Dani Olmo'],
  [/^jordi alba ramos$/i,'Jordi Alba'],
  [/^marco asensio willemsen$/i,'Marco Asensio']
];

const HISPANIC = new Set(['Argentina','Spain','Uruguay','Mexico','Ecuador','Costa Rica']);
const PARTICLES = new Set(['de','del','da','do','dos','das','di','van','von','der','den','bin','al','el','mac','mc','la','le']);
const SUFFIXES = new Set(['junior','júnior','filho','neto','ii','iii']);

/** @param {number|string|null|undefined} id
 *  @param {string} original
 *  @param {string} country
 */
export function familiarPlayerName(id,original='',country=''){
 const name=String(original??'').replace(/\s+/g,' ').trim();
 const known=KNOWN_BY_ID.get(Number(id));
 if(known)return known;
 for(const [pattern,alias] of KNOWN_BY_NAME){
  if(pattern.test(name))return alias;
 }
 const tokens=name.split(' ').filter(Boolean);
 if(tokens.length<=2)return name;
 // Garder les particules et patronymes composés (Mac Allister, Di María,
 // De Bruyne) et ne jamais interpréter « Júnior » comme nom de famille.
 if(tokens.length===3&&PARTICLES.has(tokens[1].toLocaleLowerCase('fr')))return name;
 if(PARTICLES.has(tokens.at(-2)?.toLocaleLowerCase('fr'))||SUFFIXES.has(tokens.at(-1)?.toLocaleLowerCase('fr')))return name;
 // Avec trois termes en langue espagnole, le 3e est fréquemment
 // le second patronyme. Conserver le 1er patronyme dans ce cas.
 if(tokens.length===3&&HISPANIC.has(country))return tokens.slice(0,2).join(' ');
 return tokens[0]+' '+tokens.at(-1);
}
