const fs=require('fs');
const St={};global.localStorage={get length(){return Object.keys(St).length},getItem:k=>k in St?St[k]:null,
setItem:(k,v)=>{St[k]=v},removeItem:k=>{delete St[k]},key:i=>Object.keys(St)[i]??null};
const HTML={_a:{},setAttribute(k,v){this._a[k]=v},getAttribute(k){return this._a[k]}};
let LARGE=412;
global.window={get innerWidth(){return LARGE},matchMedia:()=>({matches:false,addEventListener(){},addListener(){}})};
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
    mods.forEach((m,mi)=>vars.forEach(v=>{let val=9+mi;
      if(v==='weather_code') val=(mi%3===0?61:1);
      if(v==='precipitation') val=0.5+mi*0.3;
      if(v.indexOf('cloud_cover')===0) val=55+mi*7;
      if(v==='wind_gusts_10m') val=26+mi*7; if(v==='wind_direction_10m') val=250;
      if(v==='precipitation_probability') val=48;
      hy[v+'_'+m]=t.map(()=>val);}));
    return {hourly:hy,elevation:1800};})};
};
const h=fs.readFileSync('../index.html','utf8');
const s=h.match(/<script>([\s\S]*)<\/script>/)[1];
const o={};
new Function('out', s+'\n;out.api={interroger,appliquerTheme,dessine,contraste,couleurCiel,get PAL(){return PAL}};')(o);
(async()=>{
  await o.api.interroger();
  for(const [nom,w] of [['mobile',412],['ordinateur',1400]]){
    LARGE=w;
    for(const th of ['clair','sombre']){
      o.api.appliquerTheme(th,false); o.api.dessine();
      const svg=N['#ruban'];
      const W=+svg._a.width;
      console.log(nom.padEnd(11), th.padEnd(7), 'largeur SVG', String(W).padStart(5),
        W<=w? '-> tient à l\'écran' : '-> défilement ('+(W/w).toFixed(1)+'×)');
      if(nom==='mobile') fs.writeFileSync('./out_ui_'+th+'.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+svg._a.viewBox+'" width="'+W
        +'" height="'+svg._a.height+'"><rect width="100%" height="100%" fill="'
        +(th==='clair'?'#FFFFFF':'#131C2C')+'"/>'+svg.innerHTML+N['#gouttiere'].innerHTML+'</svg>');
    }
  }
  o.api.appliquerTheme('clair',false);
  console.log('\ncontraste du texte sur le ciel :');
  [6,9,13,17,21,1].forEach(hh=>console.log('   '+String(hh).padStart(2)+'h  ciel',
    o.api.couleurCiel(hh),'-> texte',o.api.contraste(o.api.couleurCiel(hh))));
})();
