const fs=require('fs');
const St={};global.localStorage={get length(){return Object.keys(St).length},getItem:k=>k in St?St[k]:null,
setItem:(k,v)=>{St[k]=v},removeItem:k=>{delete St[k]},key:i=>Object.keys(St)[i]??null};
const HTML={_a:{},setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]}};
global.window={innerWidth:412,matchMedia:()=>({matches:false,addEventListener(){},addListener(){}})};
const N={}; let FICH=null;
const mk=k=>({cle:k,innerHTML:'',textContent:'',value:'',_a:{},disabled:false,className:'',
onclick:null,onchange:null,setAttribute(a,b){this._a[a]=b},getAttribute(a){return this._a[a]},
querySelectorAll:()=>[],querySelector:()=>mk('x'),appendChild(){},children:[],addEventListener(){},
scrollIntoView(){},dataset:{},options:[],style:{},classList:{add(){}},select(){},click(){},remove(){}});
global.document={documentElement:HTML,querySelector:k=>(N[k]=N[k]||mk(k)),createElement:()=>mk('c'),
addEventListener(){},visibilityState:'visible',body:{appendChild(){}}};
global.setInterval=()=>0;global.setTimeout=(f)=>{};global.confirm=()=>true;global.navigator={};
global.Blob=class{constructor(p){FICH=p[0]}};
global.URL={createObjectURL:()=>'b',revokeObjectURL(){}};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
function serie(pt,biaisT,biaisPr,biaisRaf){
  const hy={time:[]};
  const V={temperature_2m:0,apparent_temperature:0,dew_point_2m:6,relative_humidity_2m:82,
   precipitation:0.4,precipitation_probability:45,snowfall:0,weather_code:61,cloud_cover:75,
   cloud_cover_low:45,cloud_cover_mid:55,cloud_cover_high:65,sunshine_duration:1200,
   shortwave_radiation:300,uv_index:3,visibility:20000,wind_speed_10m:11,wind_gusts_10m:28,
   wind_direction_10m:250,freezing_level_height:3600,cape:300,lifted_index:-1,surface_pressure:790,
   temperature_850hPa:13,temperature_750hPa:8,temperature_700hPa:4,
   geopotential_height_850hPa:1500,geopotential_height_750hPa:2520,geopotential_height_700hPa:3050,
   wind_speed_750hPa:32,wind_speed_700hPa:42};
  Object.keys(V).forEach(k=>hy[k]=[]);
  for(let d=21;d<=23;d++)for(let hh=0;hh<24;hh++){
    hy.time.push('2026-08-'+d+'T'+String(hh).padStart(2,'0')+':00');
    Object.keys(V).forEach(k=>{let v=V[k];
      if(k==='temperature_2m') v=14-(pt.alt-1000)/160+biaisT+(pt.alt>2000?biaisT*0.8:0);
      if(k==='apparent_temperature') v=12-(pt.alt-1000)/160+biaisT;
      if(k==='precipitation') v=Math.max(0,0.4+biaisPr);
      if(k==='wind_gusts_10m') v=28+biaisRaf;
      hy[k].push(v);});
  }
  return {hourly:hy,elevation:pt.alt};
}
const o={};
new Function('out','S', s.replace(/\(function\(\)\{[\s\S]*\}\)\(\);\s*$/,'')
+`;JALONS=construireJalons();
  const CFG=[['ecmwf_ifs025','ECMWF IFS 9 km',0,0,0],
             ['metno_seamless','MET Norway',0.1,0,0],
             ['dwd_icon_eu','ICON-EU 7 km',0.8,0.3,4],
             ['dwd_icon_global','ICON global 11 km',3.2,-0.4,-6],
             ['meteoblue','meteoblue MOS',-1.4,0.9,0],
             ['gfs_seamless','GFS (NOAA)',4.5,-0.35,-18],
             ['ukmo_global_deterministic_10km','UKMO Global 10 km',-0.6,0.1,3]];
  CFG.forEach(c=>{
    DATA[c[0]]={nom:c[1], reps:POIS.map(p=>S(p,c[2],c[3],c[4])), suffixe:''};
    DATA_J[c[0]]=DATA[c[0]];
  });
  TS_DONNEES=Date.now();
  out.api={exportMD};`)(o, serie);
(async()=>{
  await o.api.exportMD();
  const L=FICH.split('\n');
  console.log('sections :', L.filter(x=>x.startsWith('## ')).map(x=>x.slice(3,34)).join(' | '));
  const i3=L.findIndex(x=>x.startsWith('## B3'));
  console.log('\n' + L.slice(i3+6, i3+15).join('\n'));
  const i4=L.findIndex(x=>x.startsWith('## B4'));
  console.log('\n' + L.slice(i4+3, i4+9).join('\n'));
  const iB=L.findIndex(x=>x.startsWith('## B.'));
  console.log('\n--- extrait section B ---');
  console.log(L.slice(iB+4,iB+11).map(x=>x.slice(0,120)).join('\n'));
  console.log('\ntaille :', (FICH.length/1024).toFixed(0),'ko |', L.length,'lignes');
})();
