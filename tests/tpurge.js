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
new Function('out', s+'\n;out.api={modelesDisponibles,purgerInconnus,majSelecteurModele,majEtat,'
 +'modeleConnu,set DATA(v){DATA=v},get DATA(){return DATA},set DATA_J(v){DATA_J=v},'
 +'set TS(v){TS_DONNEES=v},POIS};')(o);
const A=o.api;
// on simule un cache issu de l'ancienne version : 11 modèles dont JMA
const anciens=['ecmwf_ifs025','ecmwf_aifs025_single','meteoswiss_icon_ch2','meteoblue',
  'dwd_icon_eu','dwd_icon_global','windy_iconEu','ukmo_global_deterministic_10km',
  'gfs_seamless','metno_seamless','jma_seamless'];
const faux={t:8,res:7,nu:70,pr:0.3,v:10,raf:25,dir:250,code:61};
const D={},DJ={};
anciens.forEach(id=>{ D[id]={nom:id, pts:{43:A.POIS.map(()=>faux)}}; DJ[id]={nom:id, jal:[]}; });
A.DATA=D; A.DATA_J=DJ; A.TS=Date.now();
console.log('cache simulé :', anciens.length, 'modèles, dont JMA');
console.log('inconnus détectés :', anciens.filter(id=>!A.modeleConnu(id)).join(', '));
const n=A.purgerInconnus();
console.log('purgés :', n, '→ restants :', Object.keys(A.DATA).length);
console.log('JMA encore présent :', 'jma_seamless' in A.DATA);
A.majSelecteurModele();
const opts=(N['#modele'].innerHTML.match(/>([^<]+)</g)||[]).map(x=>x.slice(1,-1));
console.log('\nsélecteur :', opts[0]);
console.log('options :', opts.length-1, '→', opts.slice(1).join(' · '));
A.majEtat();
console.log('\nétat :', N['#etat'].innerHTML.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
