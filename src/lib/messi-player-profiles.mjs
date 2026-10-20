/**
 * Libellés lisibles et photos de partenaires de Messi.
 * Les identifiants sont les IDs StatsBomb, pas les numéros de maillot.
 * Les noms longs fournis par StatsBomb restent intacts dans les JSON sources.
 *
 * Photos : Wikimedia Commons / auteurs indiqués ci-dessous. Chaque image
 * renvoie à sa page de source (auteur, licence, historique du recadrage).
 * Les portraits sont chargés côté navigateur avec fallback initiales.
 */
const PROFILES = {
  5503: {name:'Lionel Messi',file:'Lionel Messi 20180626 (3x4 cropped).jpg',author:'Кирилл Венедиктов',license:'CC BY-SA 3.0'},
  20131:{name:'Xavi',file:'2012 2013 - 06 Xavi Hernández.jpg',author:'Castroquini',license:'CC BY-SA 3.0'},
  5203: {name:'Sergio Busquets',file:'Sergio Busquets 2018 (cropped).jpg',author:'Анна Нэсси',license:'CC BY-SA 3.0'},
  5216: {name:'Andrés Iniesta',file:'Andrés Iniesta (cropped).jpg',author:'Кирилл Венедиктов',license:'CC BY-SA 3.0'},
  4324: {name:'Dani Alves',file:'DanielAlves.JPG',author:'José Porras (Elemaki)',license:'CC BY 3.0'},
  6379: {name:'Sergi Roberto',file:'Sergi Roberto 2019 03 17 1.jpg',author:'הגמל התימני',license:'CC BY-SA 4.0'},
  5211: {name:'Jordi Alba',file:'Jordi Alba 2013 Catalonia.jpg',author:'Xavier Rondón Medina',license:'CC BY-SA 2.0'},
  5470: {name:'Ivan Rakitić',file:'IvanRakitic.jpg',author:'Gabrielcorbachobermejo',license:'CC BY-SA 3.0'},
  5208: {name:'Thiago Alcântara',file:'Thiago Alcântara 2019.jpg',author:'Steffen Prößdorf',license:'CC BY-SA 4.0'},
  5213: {name:'Gerard Piqué',file:'GerardPique.jpg',author:'Vinod Divakaran',license:'CC BY 2.0'},
  5246: {name:'Luis Suárez',file:'Luis Suarez 2019 03 17 1.jpg',author:'הגמל התימני',license:'CC BY-SA 4.0'},
  19757:{name:'Deco',file:'Deco Celta.jpg',author:'Hector Garcia',license:'CC BY-SA 2.0'},
  5506: {name:'Javier Mascherano',file:'Javier Mascherano NE Revolution Inter Miami 7.9.25-040.jpg',author:'Bryan Berlin',license:'CC BY-SA 4.0'},
  3958: {name:'Pedro',file:'Pedro Rodríguez Ledesma 2010.jpg',author:'Christophe95',license:'CC BY-SA 3.0'},
  4320: {name:'Neymar',file:'Neymar - FC Barcelona - 2015.jpg',author:'Alex Fau / recadrage Danyele',license:'CC BY 2.0'},
  25879:{name:'Ronaldinho',file:'Ronaldinho-7-5-2006.jpg',author:'Darz Mol',license:'CC BY-SA 3.0'},
  3478: {name:'Cesc Fàbregas',file:'Presentación Cesc Fábregas (6045578571).jpg',author:'Xavier Rondón Medina',license:'CC BY-SA 2.0'},
  // Noms usuels également normalisés si de nouveaux partenaires entrent dans le groupe éligible.
  7797: {name:'Rodrigo De Paul'}, 8118:{name:'Frenkie de Jong'},
  6374:{name:'Nélson Semedo'}, 22102:{name:'Adriano Correia'},
  12737:{name:'David Villa'}, 26613:{name:'Maxwell'},
  19298:{name:'Samuel Eto’o'}, 20169:{name:'Seydou Keita'},
  3385:{name:'Alexis Sánchez'}, 20125:{name:'Carles Puyol'},
  38718:{name:'Enzo Fernández'}, 3501:{name:'Philippe Coutinho'},
  30486:{name:'Pedri'}, 27886:{name:'Alexis Mac Allister'},
};

// Vignettes 250 px vérifiées sur les pages Wikimedia Commons correspondantes.
// Les redirects Special:FilePath restent des secours ; aucun portrait généré.
const VERIFIED_THUMBNAILS={
  5503:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Lionel_Messi_20180626_%283x4_cropped%29.jpg/250px-Lionel_Messi_20180626_%283x4_cropped%29.jpg',
  20131:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/2012_2013_-_06_Xavi_Hern%C3%A1ndez.jpg/250px-2012_2013_-_06_Xavi_Hern%C3%A1ndez.jpg',
  5203:'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Sergio_Busquets_2018_%28cropped%29.jpg/250px-Sergio_Busquets_2018_%28cropped%29.jpg',
  5216:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Andr%C3%A9s_Iniesta_%28cropped%29.jpg/250px-Andr%C3%A9s_Iniesta_%28cropped%29.jpg',
  4324:'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/DanielAlves.JPG/250px-DanielAlves.JPG',
  6379:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Sergi_Roberto_2019_03_17_1.jpg/250px-Sergi_Roberto_2019_03_17_1.jpg',
  5211:'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Jordi_Alba_2013_Catalonia.jpg/250px-Jordi_Alba_2013_Catalonia.jpg',
  5470:'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/IvanRakitic.jpg/250px-IvanRakitic.jpg',
  5246:'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Luis_Suarez_2019_03_17_1.jpg/250px-Luis_Suarez_2019_03_17_1.jpg',
  4320:'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Neymar_-_FC_Barcelona_-_2015.jpg/250px-Neymar_-_FC_Barcelona_-_2015.jpg',
  3478:'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Presentaci%C3%B3n_Cesc_F%C3%A1bregas_%286045578571%29.jpg/250px-Presentaci%C3%B3n_Cesc_F%C3%A1bregas_%286045578571%29.jpg',
  3958:'https://upload.wikimedia.org/wikipedia/commons/e/ed/Pedro_Rodr%C3%ADguez_Ledesma_2010.jpg'
};

export const MESSI_ID=5503;
export const profileFor = id => PROFILES[Number(id)] ?? null;

export function displayPlayerName(id,rawName=''){
  const known=profileFor(id)?.name;
  if(known)return known;
  // Ne pas transformer un nom inconnu en un patronyme arbitraire.
  return String(rawName||'Joueur').trim();
}

export function playerInitials(id,rawName=''){
  const n=displayPlayerName(id,rawName).trim().split(/\s+/);
  return (n.length<2?n[0]?.slice(0,2):n[0][0]+n.at(-1)[0]).toUpperCase();
}
export function commonsFileUrl(file,width=160){
  if(!file)return null;
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width='+width;
}
export function photoFor(id,width=160){
  return commonsFileUrl(profileFor(id)?.file,width);
}

/** Images CDN vérifiées, puis deux solutions de repli en cas de réseau/429. */
export function photoSourcesFor(id,width=160){
  const profile=profileFor(id);
  if(!profile?.file)return [];
  const url='https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(profile.file);
  return [...new Set([
    VERIFIED_THUMBNAILS[Number(id)],
    commonsFileUrl(profile.file,width),
    url
  ].filter(Boolean))];
}
export function photoCredits(id){
  const p=profileFor(id);
  if(!p?.file)return null;
  return {
    id:Number(id),name:p.name,author:p.author,license:p.license,
    source:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(p.file.replaceAll(' ','_')),
    licenseUrl:'https://creativecommons.org/licenses/'+(p.license?.includes('BY-SA')?'by-sa/':'by/')+(p.license?.match(/\d\.\d/)?.[0]??'4.0')+'/',
    modified:'Photo affichée en recadrage circulaire',
  };
}
