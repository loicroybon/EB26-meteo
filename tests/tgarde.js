/* v41 : le garde-fou aligné sur le run des modèles.
   Vérifie l'arithmétique de dates : quel run est publié à un instant donné,
   quand tombe le suivant, et dans quels cas un relevé est refusé.
   node tgarde.js */
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

const RUN_H = +(html.match(/const RUN_H = (\d+);/) || [])[1];
const RUN_LAG_MS = eval((html.match(/const RUN_LAG_MS = ([^;]+);/) || [])[1]);
const PLANCHER_MS = eval((html.match(/const PLANCHER_MS = ([^;]+);/) || [])[1]);
const PERIME_H = +(html.match(/const PERIME_H=(\d+);/) || [])[1];
eval(corps('runPublie'));
eval(corps('prochainRun'));

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok    ' : '  ECHEC ') + txt); if (!ok) ko++; };
const U = (a, mo, j, h, mi) => Date.UTC(a, mo, j, h, mi || 0);
const iso = t => new Date(t).toISOString().slice(0, 16) + 'Z';

console.log('\n=== constantes lues dans le fichier ===');
console.log(`  RUN_H=${RUN_H} h   RUN_LAG=${RUN_LAG_MS / 3600000} h   `
  + `PLANCHER=${PLANCHER_MS / 60000} min   PERIME_H=${PERIME_H} h`);
dit(RUN_H === 3, 'pas de run de 3 h (mailles fines)');
dit(RUN_LAG_MS > 2 * 3600000 && RUN_LAG_MS < 6 * 3600000, 'délai de publication plausible');

console.log('\n=== quel run est publié à un instant donné ===');
/* avec 3 h 30 de retard de publication : le run 00Z est disponible à 03h30,
   le 03Z à 06h30, le 06Z à 09h30. */
[[U(2026, 7, 17, 3, 29), U(2026, 7, 16, 21)],
 [U(2026, 7, 17, 3, 31), U(2026, 7, 17, 0)],
 [U(2026, 7, 17, 6, 29), U(2026, 7, 17, 0)],
 [U(2026, 7, 17, 6, 31), U(2026, 7, 17, 3)],
 [U(2026, 7, 17, 9, 31), U(2026, 7, 17, 6)],
 [U(2026, 7, 17, 1, 0), U(2026, 7, 16, 21)]
].forEach(([maintenant, attendu]) => {
  const r = runPublie(maintenant);
  dit(r === attendu, `à ${iso(maintenant)} le dernier run publié est ${iso(r)}`
    + (r === attendu ? '' : ` (attendu ${iso(attendu)})`));
});

console.log('\n=== le run publié avance bien toutes les 3 h ===');
let precedent = null, avances = 0;
for (let m = 0; m < 24 * 60; m += 10) {
  const t = U(2026, 7, 17, 0, 0) + m * 60000;
  const r = runPublie(t);
  if (precedent !== null && r !== precedent) avances++;
  precedent = r;
}
dit(avances === 8, `${avances} avancées sur 24 h (attendu 8, soit une toutes les 3 h)`);

console.log('\n=== le prochain run est toujours dans le futur ===');
[[2026, 7, 17, 3, 31], [2026, 7, 17, 6, 29], [2026, 7, 17, 12, 0], [2026, 7, 17, 23, 59]]
  .forEach(a => {
    const t = U(a[0], a[1], a[2], a[3], a[4]);
    const p = prochainRun(t);
    dit(p > t, `à ${iso(t)} le prochain run est ${iso(p)}, dans ${((p - t) / 60000).toFixed(0)} min`);
    dit(p - t <= RUN_H * 3600000 + 60000, 'et il tombe dans les 3 h');
  });

/* reproduction exacte de la condition de refus du fichier */
function refuse(maintenant, tsDonnees, force, horsLigne) {
  if (force) return false;
  if (!tsDonnees || horsLigne) return false;
  const age = maintenant - tsDonnees;
  const dejaAJour = tsDonnees >= runPublie(maintenant);
  return (dejaAJour && age < PERIME_H * 3600000) || age < PLANCHER_MS;
}

console.log('\n=== décision de refus ===');
const T = U(2026, 7, 17, 8, 0);   // 08:00 UTC : dernier run publié = 03Z
dit(runPublie(T) === U(2026, 7, 17, 3), 'à 08:00 le dernier run publié est 03Z');
dit(refuse(T, U(2026, 7, 17, 7, 0), false, false),
  'relevé de 07:00 (postérieur à 03Z, donc le contient) : refusé');
dit(!refuse(T, U(2026, 7, 17, 2, 0), false, false),
  'relevé de 02:00 (antérieur à 03Z) : autorisé, un run est arrivé depuis');
dit(!refuse(T, U(2026, 7, 17, 7, 0), true, false),
  'même relevé de 07:00 mais forcé : autorisé');
dit(!refuse(T, U(2026, 7, 17, 7, 0), false, true),
  'hors ligne : autorisé');
dit(!refuse(T, null, false, false),
  'aucune donnée : autorisé');

console.log('\n=== le filet PERIME_H ne bloque jamais l\'auto-rafraîchissement ===');
const vieux = T - (PERIME_H * 3600000 + 60000);
dit(!refuse(T, vieux, false, false),
  `données de ${((T - vieux) / 3600000).toFixed(1)} h : autorisé malgré tout`);
/* pire cas : un relevé fait à l'instant où un run vient d'être publié.
   Combien de temps le garde-fou refuse-t-il ensuite ? */
let pire = 0, pireA = null;
for (let m = 0; m < 24 * 60; m += 5) {
  const publication = U(2026, 7, 17, 0, 0) + m * 60000;
  if (runPublie(publication) !== runPublie(publication - 5 * 60000)) {
    const ts = publication;               // relevé pile à la publication
    let attente = 5;
    while (attente < 8 * 60 && refuse(ts + attente * 60000, ts, false, false)) attente += 5;
    if (attente > pire) { pire = attente; pireA = iso(publication); }
  }
}
dit(pire <= PERIME_H * 60,
  `attente maximale imposée : ${pire} min (plafond ${PERIME_H * 60} min), pire cas à ${pireA}`);

console.log('\n=== double appui ===');
const juste = T - 60000;
dit(refuse(T, juste, false, false), 'relevé d\'il y a 1 min : refusé par le plancher');

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
