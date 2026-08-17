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
new Function('out', s+'\n;out.api={agrege,MODELES,DOUBLON,POIDS,famille,majSelecteurModele,'
 +'set DATA(v){DATA=v},get DATA(){return DATA},POIS};')(o);
const A=o.api;
console.log('modèles restants :', A.MODELES.length);
console.log('retirés :', ['jma_seamless','cma_grapes_global','bom_access_global','gfs_graphcast025']
  .filter(x=>!A.MODELES.some(m=>m[0]===x)).join(', '));

// jeu de test : IFS et son écho MET Norway, ICON-EU et ICON global, meteoblue, GFS
const base={res:12,ros:8,hum:80,pr:0.4,pp:40,nu:70,nub:40,num:50,nuh:60,v:10,raf:28,dir:250,code:61};
const L=[
 {id:'ecmwf_ifs025',   nom:'ECMWF IFS',   t:6.0, ...base},
 {id:'metno_seamless', nom:'MET Norway',  t:6.0, ...base},   // écho exact d'IFS
 {id:'dwd_icon_eu',    nom:'ICON-EU',     t:7.0, ...base},
 {id:'dwd_icon_global',nom:'ICON global', t:11.0,...base},    // grand frère grossier
 {id:'meteoblue',      nom:'meteoblue',   t:5.0, ...base},
 {id:'gfs_seamless',   nom:'GFS',         t:12.0,...base},
 {id:'windy_iconEu',   nom:'Windy ICON-EU',t:7.0, pr_conv:1.8, cbase:2300, ...base},
];
const a=A.agrege(L.map(x=>Object.assign({},x)));
console.log('\nlignes reçues :', L.length);
console.log('doublons détectés :', a.lignes.filter(l=>l.doublon).map(l=>l.nom).join(', '));
console.log('sources indépendantes :', a.independants);
console.log('T consensus :', a.t.m, ' (sans exclusion la médiane pondérée serait tirée par ICON global 11 et MET Norway 6)');
console.log('pluie convective conservée via Windy :', a.pr_conv? a.pr_conv.m : 'perdue');
console.log('base des nuages conservée :', a.cbase? a.cbase.m : 'perdue');

// sélecteur
A.DATA={}; L.forEach(x=>{A.DATA[x.id]={nom:x.nom, pts:{43:A.POIS.map(()=>x)}}});
A.majSelecteurModele();
console.log('\nlibellé du sélecteur :', (N['#modele'].innerHTML.match(/>([^<]*Multimodèle[^<]*)</)||[])[1]);
