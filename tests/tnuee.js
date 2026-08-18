/* v89 : base des nuages et etat sature.

   Ce que ce harnais protege : la base doit pouvoir passer SOUS le coureur. La
   formule d'Espy seule ne le permet pas, son terme etant toujours positif, et
   c'est ce qui faisait annoncer "sous les nuages" un coureur qui est dedans.

   Les cinq cas sont mesures : valeurs du consensus relevees dans l'extrait du
   18/08, verdict attendu lu sur les sorties "base des nuages" des modeles telles
   que Windy les publie (ICON-EU, ECMWF, meteoblue) au meme endroit et a la meme
   heure.
   node tnuee.js */
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

function corps(nom) {
  const i = html.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('introuvable : ' + nom);
  let p = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') p++;
    else if (html[k] === '}') { p--; if (!p) { j = k; break; } }
  }
  return html.slice(i, j + 1);
}

const ALT_MAX = 3200;
eval(corps('airSature'));
eval(corps('baseNuage'));

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok    ' : '  ECHEC ') + txt); if (!ok) ko++; };

/* nom, sol, T, rosee, nu, nub, pluie, sature attendu, etat attendu, source Windy */
const CAS = [
  ['Jean Collet',    1940, 11.6, 10.6, 100, 65, 1.6, true,  'dans',    'ICON-EU 300-1400 m'],
  ['Lac du Cos',     2195,  9.2,  6.3, 100, 55, 0.3, true,  'dans',    'bases basses ven. soir'],
  ['Vizille',         283, 16.2, 16.2, 100, 10, 0.4, true,  'dans',    'meteoblue 0-200 m'],
  ['Col de Moretan', 2493,  4.8,  4.2,  67, 20, 0.0, false, 'dessous', 'fenetre claire sam. matin'],
  ['Super Collet',   1642, 15.3,  9.7,  99, 26, 0.5, false, 'dessous', 'bases hautes sam.'],
];

console.log('\n=== etat sature : le coureur est-il DANS le nuage ? ===');
CAS.forEach(([nom, sol, t, ros, nu, nub, pr, satAtt, etat, src]) => {
  const sat = airSature(nu, t, ros, nub, pr);
  const b = baseNuage(sol, t, ros, nu, nub, pr, false);
  const dedans = sol >= b;
  dit(sat === satAtt && dedans === (etat === 'dans'),
    `${nom} ${sol} m : base ${Math.round(b)} m, coureur ${dedans ? 'DANS' : 'dessous'}`
    + ` (attendu ${etat}, ${src})`);
});

console.log('\n=== la base doit pouvoir passer sous le coureur ===');
const bSat = baseNuage(1940, 11.6, 10.6, 100, 65, 1.6, false);
dit(bSat < 1940, `air sature : base ${Math.round(bSat)} m, soit ${Math.round(1940 - bSat)} m sous le coureur`);
const bSec = baseNuage(1940, 18, 8, 40, 10, 0, false);
dit(bSec > 1940, `air sec : base ${Math.round(bSec)} m, au-dessus du coureur, comme le veut Espy`);

console.log('\n=== bornes ===');
dit(baseNuage(283, 16.2, 16.2, 100, 100, 1, false) >= 0, 'jamais negative');
dit(baseNuage(3000, 30, 0, 10, 0, 0, false) <= ALT_MAX - 120, "jamais au-dela de l'echelle");
dit(baseNuage(2000, 12, 11, 100, 80, 1, true) === 2000, 'brouillard : la base colle au relief');

console.log('\n=== chaque signature declenche seule ===');
dit(airSature(100, 12, 11.9, null, null) === true, 'saturation seule : nu 100 et T-Td 0.1');
dit(airSature(60, 18, 8, 70, 1.0) === true, 'pluie sur couche basse seule : nub 70, 1 mm/h');
dit(airSature(60, 18, 8, 70, 0.1) === false, "pluie trop faible : pas de saturation");
dit(airSature(60, 18, 8, 30, 1.0) === false, "couche basse trop mince : pas de saturation");
dit(airSature(96, 18, 8, 10, 0) === false, 'ciel bouche mais air sec : pas de saturation');

console.log('\n=== valeurs manquantes : aucun plantage, aucune saturation inventee ===');
dit(airSature(null, null, null, null, null) === false, 'tout absent');
dit(Number.isFinite(baseNuage(1500, null, null, null, null, null, false)), 'base finie sans T ni rosee');

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
