/* Verifie l'extraction MET Norway sur une reponse reelle d'api.met.no :
   unites, interpolation, pluie ramenee en mm/h, moyenne angulaire du vent.
   node tmetno.js   (utilise fixtures/metno_belledonne.json) */
const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');

/* on extrait les deux fonctions du fichier sans executer toute la page */
function fn(nom) {
  const i = html.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('introuvable : ' + nom);
  let p = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') p++;
    else if (html[k] === '}') { p--; if (!p) { j = k; break; } }
  }
  return html.slice(i, j + 1);
}
eval(fn('ressentiAT'));
eval(fn('mnCode'));
eval(fn('mnExtrait'));

const ts = JSON.parse(fs.readFileSync('fixtures/metno_belledonne.json', 'utf8'))
  .properties.timeseries;
const P = { lat: 45.16861, lon: 5.98814, alt: 2880 };

let ko = 0;
const dit = (ok, txt) => { console.log((ok ? '  ok    ' : '  ECHEC ') + txt); if (!ok) ko++; };

console.log('\n=== pas de temps reel de la serie sur la course ===');
const pas = ts.filter(x => x.time >= '2026-08-21' && x.time < '2026-08-22').map(x => x.time);
console.log('  ' + pas.join('\n  '));

console.log('\n=== extraction a un pas exact (ven 12h UTC = 14h locale) ===');
const e0 = mnExtrait(ts, '2026-08-21T12:00:00Z', P);
dit(!!e0, 'extraction non nulle');
const brut = ts.find(x => x.time === '2026-08-21T12:00:00Z').data;
const d0 = brut.instant.details;
dit(e0.t === Math.round(d0.air_temperature * 10) / 10,
  `temperature reprise telle quelle : ${e0.t} = ${d0.air_temperature}`);
dit(Math.abs(e0.v - d0.wind_speed * 3.6) < 0.11,
  `vent converti en km/h : ${e0.v} = ${d0.wind_speed} m/s x 3,6`);
dit(e0.v > d0.wind_speed, 'le vent converti est bien superieur a la valeur m/s');
const attenduPr = brut.next_1_hours
  ? brut.next_1_hours.details.precipitation_amount
  : brut.next_6_hours.details.precipitation_amount / 6;
dit(Math.abs(e0.pr - Math.round(attenduPr * 10) / 10) < 0.06,
  `pluie ramenee en mm/h : ${e0.pr} (cumul ${brut.next_6_hours ? brut.next_6_hours.details.precipitation_amount + ' mm/6h' : 'horaire'})`);
dit(e0.alt_demandee === 2880, 'altitude demandee conservee (2880 m)');
dit(e0.raf === null, 'rafales absentes et declarees nulles, pas inventees');
dit(typeof e0.res === 'number', `ressenti calcule depuis T/hr/vent : ${e0.res} C`);
dit(e0.res < e0.t, 'par vent et humidite < 100 %, le ressenti est sous la temperature');
dit(e0.num !== undefined, 'la cle `num` (nuages moyens) existe bien');
dit(!('num_' in e0), 'la cle temporaire num_ a ete supprimee');

console.log('\n=== interpolation entre deux pas de 6 h ===');
const t1 = ts.find(x => x.time === '2026-08-21T12:00:00Z').data.instant.details.air_temperature;
const t2 = ts.find(x => x.time === '2026-08-21T18:00:00Z').data.instant.details.air_temperature;
const mid = mnExtrait(ts, '2026-08-21T15:00:00Z', P);
dit(!!mid, 'extraction a mi-intervalle non nulle');
const attendu = Math.round(((t1 + t2) / 2) * 10) / 10;
dit(Math.abs(mid.t - attendu) < 0.11,
  `T a 15h UTC interpolee : ${mid.t}, attendu ${attendu} (entre ${t1} et ${t2})`);
dit(mid.t !== e0.t || t1 === t2, 'la valeur interpolee differe du pas encadrant');

console.log('\n=== moyenne angulaire du vent ===');
(function () {
  const faux = [
    { time: '2026-08-21T12:00:00Z', data: { instant: { details: { air_temperature: 5, wind_from_direction: 350, wind_speed: 5 } } } },
    { time: '2026-08-21T18:00:00Z', data: { instant: { details: { air_temperature: 5, wind_from_direction: 10, wind_speed: 5 } } } }
  ];
  const r = mnExtrait(faux, '2026-08-21T15:00:00Z', P);
  dit(r && (r.dir >= 359 || r.dir <= 1),
    `350 deg et 10 deg donnent ${r && r.dir} deg, pas 180`);
})();

console.log('\n=== temperature apparente ===');
dit(ressentiAT(null, 80, 2) === null, 'sans temperature : null');
dit(Math.abs(ressentiAT(20, 50, 0) - 20) < 3, `20 C, 50 %, sans vent -> ${ressentiAT(20,50,0).toFixed(1)} C, proche de l air`);
dit(ressentiAT(5, 80, 10) < ressentiAT(5, 80, 0), 'plus de vent refroidit');
dit(ressentiAT(25, 90, 2) > ressentiAT(25, 30, 2), 'plus d humidite rechauffe au chaud');
dit(typeof ressentiAT(5, null, null) === 'number', 'humidite et vent absents : valeur par defaut, pas de plantage');
(function () {
  /* verification numerique de la formule australienne */
  const t = 7.7, hr = 87.8, v = 0.8;
  const e = (hr / 100) * 6.105 * Math.exp(17.27 * t / (237.7 + t));
  const attendu = t + 0.33 * e - 0.70 * v - 4.00;
  dit(Math.abs(ressentiAT(t, hr, v) - attendu) < 1e-9,
    `formule exacte : ${ressentiAT(t, hr, v).toFixed(2)} = ${attendu.toFixed(2)}`);
})();

console.log('\n=== bornes ===');
dit(mnExtrait(ts, '2020-01-01T00:00:00Z', P) === null, 'date bien avant la serie : null');
dit(mnExtrait(ts, '2030-01-01T00:00:00Z', P) === null, 'date bien apres la serie : null');
dit(mnExtrait([], '2026-08-21T12:00:00Z', P) === null, 'serie vide : null');
dit(mnExtrait(null, '2026-08-21T12:00:00Z', P) === null, 'serie absente : null');

console.log('\n=== correspondance des codes ===');
[['clearsky_day', 0], ['fair_day', 1], ['partlycloudy_night', 2], ['cloudy', 3],
 ['lightrain', 61], ['rain', 63], ['heavyrain', 65], ['snow', 73],
 ['heavysnow', 75], ['sleet', 66], ['rainandthunder', 95], ['fog', 45]
].forEach(([sym, attendu]) => dit(mnCode(sym) === attendu, `${sym} -> ${attendu}`));
dit(mnCode(null) === null, 'symbole absent -> null');
dit(mnCode('inconnu') === null, 'symbole inconnu -> null');

console.log('\n=== valeur de reference (passation : Belledonne ven 13h18 = 7,0 C) ===');
const bel = mnExtrait(ts, '2026-08-21T11:18:00Z', P);
console.log(`  MET Norway interpole a 13h18 locale : ${bel && bel.t} C,`
  + ` vent ${bel && bel.v} km/h, pluie ${bel && bel.pr} mm/h, nuages ${bel && bel.nu} %`);

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTout est conforme');
process.exit(ko ? 1 : 0);
