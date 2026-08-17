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
function heures(){const t=[];for(let d=21;d<=23;d++)for(let h=0;h<24;h++)
  t.push('2026-08-'+d+'T'+String(h).padStart(2,'0')+':00');return t;}
global.fetch=async(url)=>{const s=String(url);
  if(!s.includes('api.open-meteo.com')||s.includes('forecast_days=1')) return {ok:false,status:403};
  const u=new URL(s),lats=(u.searchParams.get('latitude')||'').split(',');
  const mods=(u.searchParams.get('models')||'').split(','),vars=(u.searchParams.get('hourly')||'').split(',');
  const t=heures();
  return {ok:true,status:200,json:async()=>lats.map(()=>{const hy={time:t};
    mods.forEach((m,mi)=>vars.forEach(v=>{let val=9+mi;
      if(v==='weather_code')val=61; if(v==='precipitation')val=0.6;
      if(v.indexOf('cloud')===0)val=70; if(v==='wind_gusts_10m')val=30;
      if(v==='wind_direction_10m')val=250; if(v==='precipitation_probability')val=45;
      hy[v+'_'+m]=t.map(()=>val);}));
    return {hourly:hy,elevation:1800};})};};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
const o={};
new Function('out', s+'\n;out.api={interroger,fiche,tableauTous,majEtat,POIS};')(o);
(async()=>{
  await o.api.interroger();
  const txt=x=>(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  console.log('état      :', txt(N['#etat'].innerHTML));
  const f=txt(N['#fiche'].innerHTML);
  console.log('fiche     :', f.length, 'caractères');
  console.log('  extrait :', f.slice(0,190));
  console.log('mgnote    :', JSON.stringify(N['#mgnote'].textContent));
  console.log('notes longues restantes dans la fiche :',
    (N['#fiche'].innerHTML.match(/class="note"/g)||[]).length);
  // poids du document
  console.log('\npoids page :', (h.length/1024).toFixed(0),'ko dont données embarquées');
  const txtstat=h.replace(/<script>[\s\S]*<\/script>/,'');
  console.log('HTML hors script :', (txtstat.length/1024).toFixed(1),'ko');
})();
