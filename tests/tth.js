const fs=require('fs');
const St={};global.localStorage={get length(){return Object.keys(St).length},getItem:k=>k in St?St[k]:null,
setItem:(k,v)=>{St[k]=v},removeItem:k=>{delete St[k]},key:i=>Object.keys(St)[i]??null};
const HTML={_a:{},setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]}};
global.window={matchMedia:()=>({matches:false,addEventListener(){},addListener(){}})};
const N={};
const mk=()=>({innerHTML:'',textContent:'',value:'',_a:{},disabled:false,className:'',onclick:null,
setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]},querySelectorAll:()=>[],
querySelector:()=>mk(),appendChild(){},children:[],addEventListener(){},scrollIntoView(){},
dataset:{},options:[],style:{},classList:{add(){}},select(){}});
global.document={documentElement:HTML,querySelector:k=>(N[k]=N[k]||mk()),createElement:()=>mk(),
addEventListener(){},visibilityState:'visible'};
global.setInterval=()=>0;global.confirm=()=>true;global.navigator={};
function heures(){const t=[];for(let d=21;d<=23;d++)for(let h=0;h<24;h++)
  t.push('2026-08-'+d+'T'+String(h).padStart(2,'0')+':00');return t;}
global.fetch=async(url)=>{
  const s=String(url);
  if(!s.includes('api.open-meteo.com')||s.includes('forecast_days=1')) return {ok:false,status:403};
  const u=new URL(s),lats=(u.searchParams.get('latitude')||'').split(',');
  const mods=(u.searchParams.get('models')||'').split(','),vars=(u.searchParams.get('hourly')||'').split(',');
  const t=heures();
  return {ok:true,status:200,json:async()=>lats.map(()=>{const hy={time:t};
    mods.forEach((m,mi)=>vars.forEach(v=>{
      let val=9+mi; if(v==='weather_code') val=(mi%3===0?61:3);
      if(v==='precipitation') val=0.6+mi*0.2;
      if(v==='cloud_cover'||v==='cloud_cover_low') val=60+mi*4;
      if(v==='cloud_cover_mid') val=45; if(v==='cloud_cover_high') val=80;
      if(v==='wind_gusts_10m') val=28+mi*6; if(v==='wind_direction_10m') val=240;
      if(v==='precipitation_probability') val=55;
      hy[v+'_'+m]=t.map(()=>val);}));
    return {hourly:hy,elevation:1800};})};
};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
const o={};
new Function('out', s+'\n;out.api={interroger,appliquerTheme,dessine,get PAL(){return PAL}};')(o);
(async()=>{
  await o.api.interroger();
  for(const th of ['sombre','clair']){
    o.api.appliquerTheme(th,false); o.api.dessine();
    const svg=N['#ruban'], gut=N['#gouttiere'];
    fs.writeFileSync('./out_th_'+th+'.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+svg._a.viewBox+'" width="'+svg._a.width
      +'" height="'+svg._a.height+'"><rect width="100%" height="100%" fill="'
      +(th==='clair'?'#FFFFFF':'#131C2C')+'"/>'+svg.innerHTML+gut.innerHTML+'</svg>');
    console.log(th,'-> data-theme =',HTML._a['data-theme'],'| fond SVG',o.api.PAL.fond);
  }
})();
