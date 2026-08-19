/* Verifie que les doublons stricts sont bien exclus de la requete Open-Meteo,
   et surtout qu'aucun modele porteur d'information ne l'est.
   node tdedup.js */
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

function bloc(debut, fin) {
  const i = html.indexOf(debut);
  if (i < 0) throw new Error('introuvable : ' + debut);
  const j = html.indexOf(fin, i);
  return html.slice(i, j + fin.length);
}

const MODELES = eval(bloc('const MODELES = [', '];').replace('const MODELES =', '').replace(/;\s*$/, ''));
const DOUBLON = eval('(' + bloc('const DOUBLON = {', '};').replace('const DOUBLON =', '').replace(/;\s*$/, '') + ')');
const MB_ID = 'meteoblue';

/* reproduction exacte de la selection faite dans tacheOM */
function selection(jours) {
  const utiles = [];
  for (const [id, nom, portee] of MODELES) {
    if (id === MB_ID) continue;
    if (portee < jours) continue;
    utiles.push([id, nom]);
  }
  const demandes = new Set(utiles.map(u => u[0]));
  const ecartes = [];
  const retenus = utiles.filter(function ([id, nom]) {
    const d = DOUBLON[id];
    if (d && (!d.garde || !d.garde.length) && demandes.has(d.parent)) {
      ecartes.push(nom); return false;
    }
    return true;
  });
  return { retenus, ecartes };
}

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok   ' : '  ECHEC ') + txt); if (!ok) ko++; };

console.log('\n=== selection par echeance ===');
for (const jours of [6, 5, 4, 3, 2, 1]) {
  const { retenus, ecartes } = selection(jours);
  console.log(`\nJ-${jours} : ${retenus.length} interroges, ${ecartes.length} ecartes`);
  console.log('   interroges : ' + retenus.map(r => r[1]).join(', '));
  if (ecartes.length) console.log('   ecartes    : ' + ecartes.join(', '));

  /* 1. un modele ecarte doit avoir un parent effectivement interrogé */
  const ids = new Set(retenus.map(r => r[0]));
  for (const [id, , portee] of MODELES) {
    if (id === MB_ID || portee < jours) continue;
    const d = DOUBLON[id];
    const estEcarte = !ids.has(id);
    if (estEcarte) {
      dit(!!d, `${id} ecarte et present dans DOUBLON`);
      dit(!d.garde || !d.garde.length, `${id} ecarte n'avait rien a garder`);
      dit(ids.has(d.parent), `${id} ecarte mais son parent ${d.parent} est interroge`);
    }
  }

  /* 2. aucun modele conservant des donnees propres ne doit etre ecarte */
  for (const [id] of MODELES) {
    const d = DOUBLON[id];
    if (d && d.garde && d.garde.length) {
      const present = MODELES.find(m => m[0] === id);
      if (present && present[2] >= jours && id !== MB_ID) {
        dit(ids.has(id), `${id} garde ${d.garde.join('/')} donc reste interroge`);
      }
    }
  }

  /* 3. il doit toujours rester au moins un modele */
  dit(retenus.length > 0, 'au moins un modele interroge');
}

console.log('\n=== cas permanent : MET Norway ===');
const j4 = selection(4);
/* On teste par PREFIXE et non par egalite : le libelle porte desormais la
   resolution ou la nature du modele, et il changera encore. Ce que ce harnais
   protege est le mecanisme de doublon, pas l'orthographe d'un nom. */
dit(j4.ecartes.some(n => n.startsWith('MET Norway')),
  'MET Norway ecarte a J-4 (echo strict d ECMWF IFS, portee 15 j)');
dit(j4.retenus.some(r => r[0] === 'ecmwf_ifs025'),
  'ECMWF IFS bien conserve comme source');

console.log('\n=== economie ===');
const avant = MODELES.filter(m => m[0] !== MB_ID && m[2] >= 4).length;
const apres = j4.retenus.length;
const nVars = (bloc('const VARS = [', '];').match(/"[A-Za-z0-9_]+"/g) || []).length;
console.log(`  J-4 : ${avant} -> ${apres} modeles interroges`);
console.log(`  soit ${52 * (avant - apres) * nVars} series de moins par releve`
  + ` (${Math.round(100 * (avant - apres) / avant)} % du cout principal)`);

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
