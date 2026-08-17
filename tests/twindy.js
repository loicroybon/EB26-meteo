const fs=require('fs');
global.window={innerWidth:412};
global.localStorage={length:0,getItem:()=>null,setItem:()=>{},removeItem:()=>{},key:()=>null};
const HTML={setAttribute(){},getAttribute(){}};
const mk=()=>({innerHTML:'',textContent:'',value:'',setAttribute(){},getAttribute(){},querySelectorAll:()=>[],querySelector:()=>mk(),appendChild(){},children:[],addEventListener(){},scrollIntoView(){},dataset:{},options:[],style:{},classList:{add(){}},select(){}});
global.document={documentElement:HTML,querySelector:()=>mk(),createElement:()=>mk(),addEventListener(){},visibilityState:'visible'};
global.setInterval=()=>0;global.confirm=()=>true;global.navigator={};
const T=new Date('2026-08-21T20:00').getTime();
global.fetch=async(url,opt)=>({ok:true,status:200,json:async()=>({
  header:{elevation:1180},                       // maille Windy ~1180 m
  ts:[T-3.6e6,T,T+3.6e6],
  units:{'temp-surface':'K','past3hprecip-surface':'mm','wind_u-surface':'m/s'},
  'temp-surface':[291.2,291.2,291.2],            // 18,05 °C brut a 1180 m
  'dewpoint-surface':[288.0,288.0,288.0],
  'past3hprecip-surface':[1.2,1.2,1.2],
  'convPrecip-surface':[0.4,0.4,0.4],
  'lclouds-surface':[90,90,90],'mclouds-surface':[80,80,80],'hclouds-surface':[60,60,60],
  'wind_u-surface':[-4,-4,-4],'wind_v-surface':[-3,-3,-3],
  'gust-surface':[7,7,7],'cape-surface':[120,120,120],'rh-surface':[92,92,92]})});
const h=fs.readFileSync('../index.html','utf8');
const o={};
new Function('out', h.match(/<script>([\s\S]*)<\/script>/)[1]
 +';WY_ACTIF=true;'
  +';out.api={windyPoint,POIS,estimerGradient,get G(){return GRAD_LOCAL},set G(v){GRAD_LOCAL=v}};')(o);
(async()=>{
  const p=o.api.POIS.find(x=>x.nom==='Lac du Cos');
  console.log('point :', p.nom, p.alt,'m  |  maille Windy simulée : 1180 m');
  for(const g of [6.5, 5.2]){
    o.api.G=g;
    const e=await o.api.windyPoint(p,'2026-08-21T20:00','iconEu');
    console.log(`  gradient ${g} °C/km → T ${e.t}°  (brut 18.1°, correction ${e.dz_corrige}°)`
      +`  corrigé:${e.corrige_alt}  rafales ${e.raf} km/h`);
  }
})();
