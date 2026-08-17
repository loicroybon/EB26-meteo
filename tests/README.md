# Harnais de test

Exécutables sans dépendance depuis ce dossier : `node fichier.js`.
Ils simulent le DOM, `localStorage` et `fetch`, puis exécutent le script
complet de `../index.html` et en extraient les fonctions à tester.

**Méthode imposée** (voir `.claude/passation/PASSATION.md` section 7) :
vérifier chaque édition par son résultat dans le fichier, jamais par le
rapport de l'outil. Un script Python par lot, `assert` avant **et** après
chaque remplacement, puis exécution des harnais ci-dessous.

| Fichier | Ce qu'il vérifie | État |
|---|---|---|
| `tmin.js` | rendu minimal, état, fiche | passe |
| `tterrain.js` | TPI, accélération, ressenti corrigé, thermomètre mouillé | passe |
| `tdoub.js` | exclusion des doublons, compte des sources indépendantes | passe |
| `tpurge.js` | purge du cache des modèles retirés de la configuration | passe |
| `tsel3.js` | sélecteur de modèle, filtrage global, repli, mono-modèle | passe |
| `twindy.js` | correction d'altitude Windy selon le gradient | passe |
| `tui.js` | largeur adaptative du météogramme, contraste par luminance | passe |
| `tth.js` | rendu des deux thèmes, palette SVG | passe |
| `tdedup.js` | v36 : les doublons stricts ne sont plus **interrogés**, et aucun modèle porteur d'information propre n'est écarté | passe |
| `tmetno.js` | v37 : extraction MET Norway sur une réponse réelle - unités m/s, pluie ramenée en mm/h, interpolation, moyenne angulaire du vent, température apparente | passe |
| `texp2.js` | export : sections critiques, biais par modèle | passe |
| `tv2.js` | pipeline parallèle : temps simulé, requêtes par fournisseur | passe |
| `tgarde.js` | v41 : garde-fou aligné sur le run des modèles, arithmétique de dates, filet `PERIME_H` | passe |
| `tquant.js` | v41 : quantiles des ensembles, tri numérique, non destructif, cas réel d'une pluie asymétrique | passe |

`fixtures/` contient les réponses réelles utilisées par les tests, pour ne pas
dépendre du réseau ni consommer de quota.

## Vérification en navigateur

Les harnais Node ne voient pas le rendu réel. Trois défauts de la v35 à la v38
n'ont été trouvés qu'en pilotant un vrai navigateur (Selenium + Chrome headless) :
l'exception de rendu sur `#hmg`, la bande horaire jamais rafraîchie, et le
gradient local resté à sa valeur par défaut. Toujours confirmer une correction
d'affichage sur la page servie en HTTP, pas en `file://` (CORS).

## Exécuter toute la suite

```sh
cd tests && for f in *.js; do node "$f" >/dev/null 2>&1 && echo "OK   $f" || echo "ECHEC $f"; done
```

**15 harnais, 13 secondes.** Avant la v41, `tterrain` et `tdoub` n'enlevaient pas
le bloc d'amorçage de la page : le relevé automatique démarrait, laissait des
minuteries pendantes et node ne rendait jamais la main. La suite prenait plus de
400 secondes et deux harnais étaient déclarés « lents » à tort.
