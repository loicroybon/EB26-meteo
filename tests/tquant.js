/* v41 : quantiles calculés sur les membres des ensembles.
   Open-Meteo étant souvent en quota, on ne peut pas toujours vérifier en
   direct : on extrait le helper du fichier et on valide l'arithmétique.
   node tquant.js */
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

/* extraction du helper tel qu'il est écrit dans le fichier */
const i = html.indexOf('const quant=(arr,q2)=>{');
if (i < 0) throw new Error('helper quant introuvable dans index.html');
let p = 0, j = html.indexOf('{', i);
for (let k = j; k < html.length; k++) {
  if (html[k] === '{') p++;
  else if (html[k] === '}') { p--; if (!p) { j = k; break; } }
}
/* on récupère l'expression seule : eval d'un `const` resterait dans sa portée */
const quant = eval('(' + html.slice(i, j + 1).replace(/^const quant=/, '') + ')');

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok    ' : '  ECHEC ') + txt); if (!ok) ko++; };

console.log('\n=== cas dégénérés ===');
dit(quant([], 0.5) === null, 'série vide : null, pas 0');
dit(quant([4], 0.25) === 4 && quant([4], 0.75) === 4, 'un seul membre : lui-même à tous les quantiles');

console.log('\n=== ordre et bornes ===');
const s = [0, 0, 0, 0, 1, 2, 3, 10, 20, 40];
dit(quant(s, 0) === 0, 'q0 rend le minimum');
dit(quant(s, 1) === 40, 'q1 rend le maximum, sans déborder du tableau');
const q25 = quant(s, 0.25), q50 = quant(s, 0.5), q75 = quant(s, 0.75);
console.log(`  p25=${q25}  p50=${q50}  p75=${q75}`);
dit(q25 <= q50 && q50 <= q75, 'les quantiles sont croissants');
dit(q25 === 0, 'p25 vaut 0 : un quart des membres annonce zéro pluie');
dit(q75 === 10, 'p75 vaut 10');

console.log('\n=== insensible à l\'ordre d\'entrée, et non destructif ===');
const brut = [5, 1, 9, 3, 7];
const copie = brut.slice();
const a = quant(brut, 0.5);
const b = quant([9, 7, 5, 3, 1], 0.5);
dit(a === b, `même médiane quel que soit l'ordre d'entrée (${a})`);
dit(JSON.stringify(brut) === JSON.stringify(copie), 'le tableau source n\'est pas trié en place');

console.log('\n=== tri numérique, pas lexicographique ===');
dit(quant([2, 10, 9], 1) === 10, '10 est bien le maximum de [2,10,9], pas 9');

console.log('\n=== cas réel : pluie asymétrique pleine de zéros ===');
/* 143 membres : 60 % à zéro, le reste étalé jusqu'à 8 mm/h.
   C'est exactement le cas que la médiane seule masque. */
const membres = [];
for (let k = 0; k < 86; k++) membres.push(0);
for (let k = 0; k < 57; k++) membres.push(+(0.1 + k * 8 / 57).toFixed(2));
const p25 = quant(membres, 0.25), p50 = quant(membres, 0.5), p75 = quant(membres, 0.75);
console.log(`  ${membres.length} membres, ${membres.filter(v => v === 0).length} à zéro`
  + `  ->  p25=${p25}  p50=${p50}  p75=${p75}`);
dit(p25 === 0 && p50 === 0, 'p25 et p50 à zéro : la majorité des membres ne voit pas de pluie');
dit(p75 > 0, `p75 = ${p75} : la fourchette révèle ce que la médiane seule cachait`);
const moyenne = membres.reduce((x, y) => x + y, 0) / membres.length;
dit(moyenne > p50, `moyenne ${moyenne.toFixed(2)} supérieure à la médiane ${p50} : `
  + 'asymétrie confirmée, la fourchette est le bon langage');

console.log('\n=== câblage dans le fichier ===');
[['pr25', "pr25:q1(quant(r.pr,.25))"],
 ['pr50', "pr50:q1(quant(r.pr,.50))"],
 ['pr75', "pr75:q1(quant(r.pr,.75))"],
 ['rafP50', "rafP50:q0(quant(r.raf,.50))"],
 ['rafP90', "rafP90:q0(quant(r.raf,.90))"]
].forEach(([nom, expr]) => dit(html.includes(expr), `${nom} câblé sur les membres`));
dit(html.includes("+(en.pr75!==null? ' \\u00b7 '+en.pr25+'\\u2013'+en.pr75+' mm/h':'')"),
  'la fourchette est affichée dans la fiche');
dit(html.includes('| Pluie p25 | p50 | p75 '), 'les colonnes existent dans l\'export');
dit(html.includes('| Raf p50 | Raf p90 |'), 'les rafales aussi');

console.log('\n=== les probabilités de dépassement sont conservées ===');
['pluie02', 'pluie1', 'pluie5', 'raf50'].forEach(k =>
  dit(html.includes(k + ':'), `${k} toujours calculé, rien n'a été remplacé`));

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
