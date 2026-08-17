/* v39 : l'ordre de service par importance doit rester une permutation exacte
   des 52 points (rien ne disparait), et placer en tete les endroits ou une
   decision se prend.  node tordre.js */
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

const a = html.indexOf('const POI_DECISIFS');
const b = html.indexOf(';', html.indexOf("'Lac du Cos'"));
const POI_DECISIFS = eval(html.slice(html.indexOf('[', a), b));
/* v48 : la fonction a ete scindee, et l'ordre depend desormais de l'etat des
   donnees. On fournit un DATA vide : on teste alors l'ordre d'importance pur. */
var DATA = {}, MAJ_MODELE = {};
var extraitPoi = function(){ return null; };
eval(corps('rangImportance'));
eval(corps('etatPoint'));
eval(corps('ordreServiceParImportance'));

const i = html.indexOf('const POIS = ['), j = html.indexOf('];', i);
const POIS = JSON.parse(html.slice(i + 'const POIS = '.length, j + 1));

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok    ' : '  ECHEC ') + txt); if (!ko && !ok) {} if (!ok) ko++; };

const ordre = ordreServiceParImportance(POIS);

console.log('\n=== integrite ===');
dit(ordre.length === POIS.length, `${ordre.length} indices pour ${POIS.length} points`);
dit(new Set(ordre).size === ordre.length, 'aucun doublon');
dit(ordre.slice().sort((x, y) => x - y).every((v, k) => v === k),
  'permutation exacte de 0..' + (POIS.length - 1) + ' : aucun point perdu');

console.log('\n=== priorites ===');
const ravitos = POIS.filter(p => p.type === 'Ravito').length;
const tete = ordre.slice(0, ravitos).map(k => POIS[k].type);
dit(tete.every(t => t === 'Ravito'),
  `les ${ravitos} premiers servis sont tous des ravitos officiels`);

const rang = nom => ordre.findIndex(k => POIS[k].nom === nom);
POI_DECISIFS.forEach(function (nom) {
  const p = POIS.find(x => x.nom === nom);
  if (!p) { dit(false, `point decisif absent des POIS : ${nom}`); return; }
  dit(rang(nom) < ravitos + POI_DECISIFS.length + 2,
    `${nom} servi en position ${rang(nom) + 1}`);
});

/* l'invariant qui compte : la queue ne contient ni ravito, ni point decisif,
   ni col, ni sommet - donc rien sur quoi une decision se prend */
const queue = ordre.slice(-10).map(k => POIS[k]);
dit(queue.every(p => p.type !== 'Ravito'),
  'aucun ravito dans les 10 derniers servis');
dit(queue.every(p => POI_DECISIFS.indexOf(p.nom) < 0),
  'aucun point decisif dans les 10 derniers servis');
dit(queue.every(p => p.type !== 'Col' && p.type !== 'Sommet' && p.type !== 'Point ctrl'),
  'ni col, ni sommet, ni point de controle dans la queue : '
  + queue.map(p => p.type).join(', '));

console.log('\n=== stabilite ===');
const encore = ordreServiceParImportance(POIS);
dit(JSON.stringify(ordre) === JSON.stringify(encore), 'deterministe entre deux appels');
dit(ordre[0] === 0, 'Vizille (index 0) reste servi en premier, meteoblue le traite a part');

console.log('\n=== a egalite, ordre du parcours ===');
const ravOrdre = ordre.slice(0, ravitos);
dit(ravOrdre.every((v, k) => k === 0 || v > ravOrdre[k - 1]),
  'entre ravitos, on suit le sens de la course');

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
