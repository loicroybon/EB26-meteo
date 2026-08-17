const fs=require('fs');
const St={};global.localStorage={get length(){return Object.keys(St).length},getItem:k=>k in St?St[k]:null,
setItem:(k,v)=>{St[k]=v},removeItem:k=>{delete St[k]},key:i=>Object.keys(St)[i]??null};
global.window={};const N={};
const faux=()=>({innerHTML:'',textContent:'',value:'',_a:{},disabled:false,className:'',
setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]},querySelectorAll:()=>[],
querySelector:()=>faux(),appendChild(){},children:[],addEventListener(){},scrollIntoView(){},
dataset:{},options:[],style:{},classList:{add(){}},select(){}});
global.document={querySelector:k=>(N[k]=N[k]||faux()),createElement:()=>faux(),addEventListener(){},visibilityState:'visible'};
global.setInterval=()=>0;global.confirm=()=>true;global.navigator={};

// horloge virtuelle : on compte le temps sans l'attendre
let T=0; const files=[];

function avancer(){ return Promise.resolve(); }
const LAT={om:42, mb:38, wy:45, ens:60};  // au dixième du réel   // latences réseau simulées (ms)
let compte={om:0,mb:0,wy:0,ens:0}, pic={om:0}, encours={om:0};
function reponse(host, url){
  return new Promise(res=>{
    compte[host]++;
    if(host==='om'){ encours.om++; pic.om=Math.max(pic.om,encours.om); }
    global.setTimeout(()=>{
      if(host==='om') encours.om--;
      if(host==='mb') return res({ok:true,status:200,json:async()=>({data_1h:mbSerie()})});
      if(host==='wy') return res({ok:false,status:401});
      if(host==='ens') return res({ok:true,status:200,json:async()=>({hourly:{time:[]}})});
      res({ok:true,status:200,json:async()=>omRep(url)});
    }, LAT[host]);
  });
}
function heures(){ const T2=[]; for(let d=21;d<=23;d++)for(let h=0;h<24;h++)
  T2.push('2026-08-'+d+'T'+String(h).padStart(2,'0')+':00'); return T2; }
function mbSerie(){ const t=heures(), o={time:t.map(x=>x.replace('T',' '))};
  ['temperature','felttemperature','relativehumidity','precipitation','snowfraction',
   'windspeed','winddirection','totalcloudcover','lowclouds','midclouds','highclouds',
   'sunshinetime','visibility'].forEach(k=>o[k]=t.map(()=>10)); return o; }
function omRep(url){
  const u=new URL(url); const lats=(u.searchParams.get('latitude')||'').split(',');
  const mods=(u.searchParams.get('models')||'').split(',');
  const vars=(u.searchParams.get('hourly')||'').split(',');
  const t=heures();
  return lats.map(()=>{ const hy={time:t};
    mods.forEach(m=>vars.forEach(v=>hy[v+'_'+m]=t.map(()=>v==='weather_code'?3:8)));
    return {hourly:hy, elevation:1800}; });
}
global.fetch=async(url,opt)=>{
  const s=String(url);
  if(s.includes('my.meteoblue')) return reponse('mb',s);
  if(s.includes('api.windy.com')) return reponse('wy',s);
  if(s.includes('ensemble-api')) return reponse('ens',s);
  return reponse('om',s);
};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
const o={};
new Function('out', s.replace(/\n\(function\(\)\{[\s\S]*$/,'')
+';out.api={interroger,get DATA(){return DATA},sondeJalon,sonde,POIS,ORD_OM};')(o);
(async()=>{
  const t0=Date.now();
  await o.api.interroger();
  T=(Date.now()-t0)*10;
  console.log('=== temps simulé :', (T/1000).toFixed(1), 's ===');
  console.log('requêtes : Open-Meteo', compte.om, '| meteoblue', compte.mb,
              '| Windy', compte.wy, '| ensembles', compte.ens,
              '| total', compte.om+compte.mb+compte.wy+compte.ens);
  console.log('concurrence Open-Meteo max atteinte :', pic.om);
  console.log('modèles retenus :', Object.keys(o.api.DATA).length);
  const j=o.api.sondeJalon(20);
  console.log('jalon H+20 dérivé des points :', j? 'OK, T='+j.t.m.toFixed(1) : 'ÉCHEC');
  const sp=o.api.sonde(15);
  console.log('point 15 :', sp? 'OK, '+sp.lignes.length+' modèles' : 'ÉCHEC');
})();
