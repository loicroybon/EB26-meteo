const fs=require('fs');
const St={};global.localStorage={get length(){return Object.keys(St).length},getItem:k=>k in St?St[k]:null,
setItem:(k,v)=>{St[k]=v},removeItem:k=>{delete St[k]},key:i=>Object.keys(St)[i]??null};
const HTML={_a:{},setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]}};
global.window={innerWidth:412,matchMedia:()=>({matches:false,addEventListener(){},addListener(){}})};
const N={}; const mk=k=>({cle:k,innerHTML:'',textContent:'',value:'',_a:{},disabled:false,className:'',
onclick:null,onchange:null,setAttribute(a,b){this._a[a]=b},getAttribute(a){return this._a[a]},
querySelectorAll:()=>[],querySelector:()=>mk('x'),appendChild(){},children:[],addEventListener(){},
scrollIntoView(){},dataset:{},options:[],style:{},classList:{add(){}},select(){}});
global.document={documentElement:HTML,querySelector:k=>(N[k]=N[k]||mk(k)),createElement:()=>mk('c'),
addEventListener(){},visibilityState:'visible'};
global.setInterval=()=>0;global.confirm=()=>true;global.navigator={};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
const o={};
new Function('out', s+'\n;out.api={tpiKm,speedupKm,humide,ressTerrain,enrichir,POIS};')(o);
const A=o.api;
console.log('point'.padEnd(27)+'alt'.padStart(6)+'TPI'.padStart(6)+'xvent'.padStart(7));
['Vizille','Croix de Belledonne','Col de Morétan','Lac Léama','Lac du Cos',
 'R5 Fond de France Base vie','R9 Val Pelouse','Sommet du Grand Chat'].forEach(n=>{
  const p=A.POIS.find(x=>x.nom===n);
  console.log(`${n.slice(0,26).padEnd(27)}${String(p.alt).padStart(6)}`
    +`${A.tpiKm(p.km).toFixed(0).padStart(6)}${A.speedupKm(p.km).toFixed(2).padStart(7)}`);
});
console.log('\n=== effet des trois corrections ===');
const essais=[
 ['Belledonne 13h18, couvert, pluie', 'Croix de Belledonne',
   {t:5.1,res:2.2,v:10,nu:100,ray:120,hum:95}],
 ['Super Collet samedi midi, soleil', 'R8 Super Collet',
   {t:12.3,res:11.9,v:6,nu:30,ray:780,hum:55}],
 ['Val Pelouse nuit claire, calme',  'R9 Val Pelouse',
   {t:9.0,res:8.5,v:3,nu:10,ray:0,hum:85}],
 ['Morétan 07h, dégagé',             'Col de Morétan',
   {t:2.3,res:-0.3,v:5,nu:7,ray:60,hum:80}],
];
essais.forEach(([lib,nom,e])=>{
  const p=A.POIS.find(x=>x.nom===nom);
  const nuit=lib.includes('nuit');
  const r=A.ressTerrain(e,p,nuit);
  const su=A.speedupKm(p.km);
  console.log(`\n${lib}`);
  console.log(`   ressenti modèles ${e.res.toFixed(1)}°  →  terrain ${r.toFixed(1)}°   (${(r-e.res>=0?'+':'')}${(r-e.res).toFixed(1)})`);
  console.log(`   vent ${e.v} → ${Math.round(e.v*su)} km/h (×${su.toFixed(2)})   T humide ${A.humide(e.t,e.hum).toFixed(1)}°`);
});
