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
| `tterrain.js` | TPI, accélération, ressenti corrigé, thermomètre mouillé | passe (sort tout puis reste bloqué : artefact du harnais, pas un échec) |
| `tdoub.js` | exclusion des doublons, compte des sources indépendantes | lent |
| `tpurge.js` | purge du cache des modèles retirés de la configuration | passe |
| `tsel3.js` | sélecteur de modèle, filtrage global, repli, mono-modèle | passe |
| `twindy.js` | correction d'altitude Windy selon le gradient | passe |
| `tui.js` | largeur adaptative du météogramme, contraste par luminance | passe |
| `tth.js` | rendu des deux thèmes, palette SVG | passe |
| `tdedup.js` | v36 : les doublons stricts ne sont plus **interrogés**, et aucun modèle porteur d'information propre n'est écarté | passe |
| `tmetno.js` | v37 : extraction MET Norway sur une réponse réelle - unités m/s, pluie ramenée en mm/h, interpolation, moyenne angulaire du vent, température apparente | passe |
| `texp2.js` | export : sections critiques, biais par modèle | **cassé** : la regex qui découpe le script vise une structure antérieure |
| `tv2.js` | pipeline parallèle : temps simulé, requêtes par fournisseur | **cassé** : même cause |

`fixtures/` contient les réponses réelles utilisées par les tests, pour ne pas
dépendre du réseau ni consommer de quota.

## Vérification en navigateur

Les harnais Node ne voient pas le rendu réel. Trois défauts de la v35 à la v38
n'ont été trouvés qu'en pilotant un vrai navigateur (Selenium + Chrome headless) :
l'exception de rendu sur `#hmg`, la bande horaire jamais rafraîchie, et le
gradient local resté à sa valeur par défaut. Toujours confirmer une correction
d'affichage sur la page servie en HTTP, pas en `file://` (CORS).
