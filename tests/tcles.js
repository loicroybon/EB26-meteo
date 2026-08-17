/* v42 : roue de secours sur les clés fournisseurs.
   L'invariant qui compte : on bascule quand la CLÉ est refusée, jamais quand
   le PLAFOND est atteint. Un dépassement de crédits n'est pas un problème de
   clé, et changer de clé ne ferait que déplacer le plafond.
   node tcles.js */
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');
const cfg = require('../config.js');

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

/* on rejoue le mécanisme du fichier avec un journal muet */
const CLE_RANG = {};
const CLE_REPLI = { meteoblue: 'QTysmp2OSKP7ba3j', windy: 'LMtKS6ka4dr1ta1qijmvXBFLUorC6aar' };
const CLES_CFG = cfg;
const journal = [];
const log = m => journal.push(m);
eval(corps('clesDe'));
eval(corps('cleDe'));
eval(corps('cleRefusee'));
eval(corps('cleSuivante'));

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok    ' : '  ECHEC ') + txt); if (!ok) ko++; };

console.log('\n=== inventaire lu depuis config.js ===');
console.log(`  meteoblue : ${cfg.meteoblue.length} clé(s)`);
console.log(`  windy     : ${cfg.windy.length} clé(s)`);
dit(cfg.meteoblue.length >= 2, 'au moins une roue de secours meteoblue');
dit(cfg.windy.length >= 2, 'au moins une roue de secours windy');
dit(cfg.meteofrance.length === 0, 'meteofrance vide, clé gratuite encore à créer');

console.log('\n=== une seule clé en service à la fois ===');
dit(cleDe('meteoblue') === cfg.meteoblue[0], `meteoblue sert la 1re : ${cleDe('meteoblue').slice(0, 8)}…`);
dit(cleDe('windy') === cfg.windy[0], `windy sert la 1re : ${cleDe('windy').slice(0, 8)}…`);

console.log('\n=== ce qui compte : clé refusée contre plafond atteint ===');
[[401, null, true, 'HTTP 401 : clé refusée'],
 [403, null, true, 'HTTP 403 : clé refusée'],
 [200, 'Unauthorized access Error 101', true, 'message « Unauthorized »'],
 [400, 'invalid api key', true, 'message « invalid api key »'],
 [400, 'The api key is not authorized', true, 'message « not authorized »'],
 [429, 'Available credits exceeded for this API key', false, 'crédits épuisés : PAS de bascule'],
 [429, null, false, 'HTTP 429 nu : PAS de bascule'],
 [429, 'Hourly API request limit exceeded', false, 'plafond horaire : PAS de bascule'],
 [429, 'Daily API request limit exceeded', false, 'plafond journalier : PAS de bascule'],
 [200, 'too many requests', false, 'débit dépassé : PAS de bascule'],
 [500, 'internal error', false, 'panne serveur : PAS de bascule'],
 [200, null, false, 'réponse saine : PAS de bascule']
].forEach(([st, txt, attendu, quoi]) => {
  const r = cleRefusee(st, txt);
  dit(r === attendu, quoi);
});

console.log('\n=== le message « credits exceeded » contient « api key » : piège évité ===');
dit(cleRefusee(429, 'Available credits exceeded for this API key') === false,
  'le mot « API key » dans un message de crédits ne déclenche pas la bascule');

console.log('\n=== bascule effective ===');
const n = cfg.windy.length;
let rangs = [cleDe('windy')];
for (let k = 1; k < n; k++) {
  dit(cleSuivante('windy', 'HTTP 403'), `bascule ${k} acceptée`);
  rangs.push(cleDe('windy'));
}
dit(!cleSuivante('windy', 'HTTP 403'), 'plus de roue de secours : bascule refusée');
dit(new Set(rangs).size === n, `les ${n} clés ont été servies, chacune une fois`);
dit(rangs.join(',') === cfg.windy.join(','), "dans l'ordre de la liste, qui est l'ordre de préférence");
dit(journal.length === n - 1, `${journal.length} bascule(s) journalisée(s)`);
console.log('  journal :', journal.map(m => m.replace(/\\u00e9/g, 'é')).join(' | '));

console.log('\n=== autonomie : sans config.js, le fichier garde ses replis ===');
(function () {
  const CLES_CFG = null;
  eval(corps('clesDe'));
  eval(corps('cleDe'));
  dit(cleDe('meteoblue') === CLE_REPLI.meteoblue, 'repli meteoblue en dur présent');
  dit(cleDe('windy') === CLE_REPLI.windy, 'repli windy en dur présent');
  dit(cleDe('meteofrance') === null, 'fournisseur sans clé ni repli : null, pas de plantage');
})();

console.log('\n=== plus de constante figée dans le fichier ===');
dit(!/const MB_CLE\b/.test(html), 'MB_CLE supprimée');
dit(!/const WY_CLE\b/.test(html), 'WY_CLE supprimée');
dit(html.includes("q.set('apikey', cleDe('meteoblue'))"), 'meteoblue relit la clé à chaque appel');
dit(html.includes("key:cleDe('windy')"), 'windy relit la clé à chaque appel');

console.log('\n=== la clé meteoblue épuisée n\'est plus référencée ===');
dit(!html.includes('CwGWT5rQ8m21jLMf'), 'ancienne clé retirée de index.html');
dit(!cfg.meteoblue.includes('CwGWT5rQ8m21jLMf'), 'et absente de config.js');

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
