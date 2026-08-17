# Harnais de test

Exécutables sans dépendance : `node fichier.js` depuis ce dossier,
après avoir ajusté le chemin vers `index.html` en tête de chaque fichier
(ils pointent sur `/mnt/user-data/outputs/index.html`).

Ils simulent le DOM, `localStorage` et `fetch`, puis exécutent le script
complet de la page et en extraient les fonctions à tester.

| Fichier | Ce qu'il vérifie |
|---|---|
| `tv2.js` | pipeline parallèle : temps simulé, nombre de requêtes par fournisseur |
| `tsel3.js` | sélecteur de modèle, filtrage global, repli, mono-modèle |
| `tterrain.js` | TPI, accélération, ressenti corrigé, thermomètre mouillé |
| `tdoub.js` | exclusion des doublons, compte des sources indépendantes |
| `tpurge.js` | purge du cache des modèles retirés de la configuration |
| `twindy.js` | correction d'altitude Windy selon le gradient |
| `texp2.js` | export : sections critiques, biais par modèle injectés et retrouvés |
| `tui.js` | largeur adaptative du météogramme, contraste par luminance |
| `tth.js` | rendu des deux thèmes, palette SVG |
| `tmin.js` | rendu minimal, état, fiche |
