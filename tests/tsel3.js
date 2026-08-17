const fs=require('fs');
const St={};global.localStorage={get length(){return Object.keys(St).length},getItem:k=>k in St?St[k]:null,
setItem:(k,v)=>{St[k]=v},removeItem:k=>{delete St[k]},key:i=>Object.keys(St)[i]??null};
global.window={};const N={};
const mk=()=>({innerHTML:'',textContent:'',value:'',_a:{},disabled:false,className:'',onchange:null,
setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]},querySelectorAll:()=>[],
querySelector:()=>mk(),appendChild(){},children:[],addEventListener(){},scrollIntoView(){},
dataset:{},options:[],style:{},classList:{add(){}},select(){},onclick:null});
global.document={querySelector:k=>(N[k]=N[k]||mk()),createElement:()=>mk(),addEventListener(){},visibilityState:'visible'};
global.setInterval=()=>0;global.confirm=()=>true;global.navigator={};
function heures(){const t=[];for(let d=21;d<=23;d++)for(let h=0;h<24;h++)
  t.push('2026-08-'+d+'T'+String(h).padStart(2,'0')+':00');return t;}
global.fetch=async(url)=>{
  const s=String(url);
  if(s.includes('my.meteoblue')){const t=heures(),o={time:t.map(x=>x.replace('T',' '))};
    ['temperature','felttemperature','relativehumidity','precipitation','snowfraction',
     'windspeed','winddirection','sunshinetime','visibility'].forEach(k=>o[k]=t.map(()=>11));
    return {ok:true,status:200,json:async()=>({data_1h:o})};}
  if(s.includes('api.windy.com')) return {ok:false,status:401};
  if(s.includes('ensemble-api')) return {ok:true,status:200,json:async()=>({hourly:{time:[]}})};
  const u=new URL(s),lats=(u.searchParams.get('latitude')||'').split(',');
  const mods=(u.searchParams.get('models')||'').split(','), vars=(u.searchParams.get('hourly')||'').split(',');
  const t=heures();
  return {ok:true,status:200,json:async()=>lats.map(()=>{const hy={time:t};
    mods.forEach((m,mi)=>vars.forEach(v=>hy[v+'_'+m]=t.map(()=>v==='weather_code'?3:(8+mi))));
    return {hourly:hy,elevation:1800};})};
};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
// on exécute AUSSI le bloc d'initialisation, pour tester le câblage réel
const o={};
new Function('out', s+'\n;out.api={get MA(){return MODELE_ACTIF}, sonde, sondeJalon, POIS, interroger, get DATA(){return DATA}, majSelecteurModele, fiche};')(o);
const A=o.api;
(async()=>{
  await A.interroger();
  console.log('modèles :', Object.keys(A.DATA).length);
  const i=A.POIS.findIndex(p=>p.nom==='Croix de Belledonne');
  console.log('\n--- avant sélection ---');
  console.log('MODELE_ACTIF =', JSON.stringify(A.MA), '| fiche :', A.sonde(i).lignes.length, 'modèles');
  console.log('note :', N['#fiabilite'].textContent.slice(0,60)+'…');

  console.log('\n--- on simule le choix de meteoblue dans le sélecteur ---');
  N['#modele'].value='meteoblue';
  if(typeof N['#modele'].onchange==='function') N['#modele'].onchange(); else console.log('!! pas de onchange');
  console.log('MODELE_ACTIF =', JSON.stringify(A.MA));
  console.log('fiche :', A.sonde(i).lignes.length, 'modèle | météogramme H+8 :', A.sondeJalon(8).lignes.length);
  console.log('note :', N['#fiabilite'].textContent.slice(0,80)+'…');

  console.log('rendu fiche (mono) :');
  const fh=N['#fiche'].innerHTML;
  console.log('   ligne consensus présente :', /class="consensus"/.test(fh));
  console.log('   mention écart 0 °C :', /0 °C entre les extr/.test(fh));
  console.log('   phrase mono-modèle :', /Un seul mod.le : ni .cart/.test(fh));
  console.log('\n--- retour au multimodèle ---');
  N['#modele'].value='';
  N['#modele'].onchange();
  console.log('MODELE_ACTIF =', JSON.stringify(A.MA), '| fiche :', A.sonde(i).lignes.length, 'modèles');
  console.log('note :', N['#fiabilite'].textContent.slice(0,60)+'…');
  const fh2=N['#fiche'].innerHTML;
  console.log('   ligne consensus présente :', /class="consensus"/.test(fh2));
  console.log('   confiance affichée :', (fh2.match(/Confiance[^<]*/)||['—'])[0].slice(0,60));
})();
