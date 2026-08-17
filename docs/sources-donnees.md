# Sources de données — inventaire vérifié

Tout ce qui suit a été testé en direct le 17/08/2026, pas lu dans une documentation.
Chaque entrée dit ce qui marche, ce qui bloque, et ce que ça coûterait d'intégrer.

---

## 1. AROME 1,3 km sans clé — la trouvaille qui compte

`MeteoFetch` ([CyrilJl/MeteoFetch](https://github.com/CyrilJl/MeteoFetch), GPL-2.0)
est un client Python qui lit les jeux ouverts Météo-France **sans clé d'API**.
Sa classe `Arome001` est AROME à 0,01°, soit **1,3 km** : le seul modèle qui
résolve Belledonne, celui dont la passation dit « rien de ce qui sera dit avant
ne vaudra son premier run ».

Le stockage est un bucket OVH public. Vérifié, HTTP 200, sans authentification :

```
https://meteofrance-pnt.s3.rbx.io.cloud.ovh.net/pnt/
  {date}T{HH}:00:00Z/arome/001/{paquet}/
  arome__001__{paquet}__{group}__{date}T{HH}:00:00Z.grib2
```

| Propriété | Valeur mesurée |
|---|---|
| Paquets | `SP1`, `SP2`, `SP3`, `HP1` |
| Groupes | `00H` à `51H`, pas horaire, portée 51 h |
| Fréquence des runs | toutes les 3 h |
| Taille par fichier | 16 à 23 Mo |
| Grille | EURW1S100, 37,5N-55,4N, 12W-16E |

`Arome0025` (2,5 km), `Arpege01`, `Arpege025`, `Ifs`, `Aifs` et `MFWAM` existent
aussi dans la même bibliothèque.

**Quand AROME atteindra la course.** Portée 51 h : il faut un run situé à moins
de 51 h du départ du 21/08 06:30, donc à partir du **run du 19/08 03Z**. Cela
recoupe exactement le calendrier de la passation.

**Ce que ça coûte.** La fenêtre de course fait environ 44 h, soit 44 fichiers
horaires à ~20 Mo, donc **environ 880 Mo par run et par paquet**. Acceptable sur
un runner GitHub Actions, impossible dans un navigateur.

**Intégration.** Uniquement côté runner, en Python :

```python
from meteofetch import Arome001
datasets = Arome001.get_latest_forecast(paquet="SP1", variables=("t2m", "u10", "v10"))
```

Le paramètre `variables` limite la mémoire, et `Arome001.availability()` dit
quels runs sont publiés. Réserve d'installation : le décodage GRIB passe par
**ecCodes**, une bibliothèque C. Sur `ubuntu-latest` c'est immédiat ; sur cette
machine Windows en Python 3.14, `pip install eccodes` puis `ecmwflibs` ne
trouvent pas la bibliothèque — il faudrait conda ou WSL. Ce n'est pas bloquant,
puisque la cible est le runner.

---

## 2. Infoclimat opendata — les observations qui manquaient

La passation liste « pondérer par la compétence vérifiée plutôt que par jugement
d'expert » comme amélioration non implémentée, et note qu'il faut des stations
d'observation. Infoclimat les fournit.

```
https://www.infoclimat.fr/opendata/?version=2&method=get&format=json
  &stations[]=000BM&stations[]=000SD
  &start=2026-08-15&end=2026-08-17
  &token=<clé>
```

| Propriété | Valeur mesurée |
|---|---|
| Pas de temps | **10 minutes** |
| Fraîcheur | dernier relevé à ~1 h près |
| Licence | CC BY-NC, usage non commercial |
| Stations testées | `000BM` Theys 760 m, `000SD` Theys 849 m — en Belledonne |

Variables par relevé : `temperature`, `pression`, `humidite`,
`point_de_rosee`, `visibilite`, `vent_moyen`, **`vent_rafales`**,
`vent_rafales_10min`, `vent_direction`, `temperature_min/max`,
`pluie_1h/3h/6h/12h/24h`, `pluie_intensite`, `uv`, `ensoleillement`,
`temperature_sol`, `temps_omm`.

**Deux usages, tous deux réels.** D'abord les **rafales**, la variable que MET
Norway ne donne pas et qui pilote les décisions de tenue. Ensuite la
**vérification de compétence** : comparer la prévision de chaque modèle à J-1
avec l'observation, et pondérer là-dessus au lieu d'une table de valeurs
choisies à la main.

**Le blocage, et il est sérieux.** La clé est **restreinte à une seule adresse
IPv4** (82.66.188.123, celle du poste). Un runner GitHub Actions a une autre IP,
souvent différente à chaque exécution : **la clé n'y fonctionnera pas.** Les
options sont de créer une clé sans restriction si Infoclimat le permet,
d'interroger Infoclimat depuis le poste et non depuis le runner, ou de renoncer
à cette source côté runner.

---

## 3. Fichiers spatiaux `.om` — séduisant, mais pas pour ce besoin

Le visualiseur `modeles.infoclimat.fr` lit des grilles au format `.om`
(format binaire d'Open-Meteo), sur deux hôtes publics sans clé :

```
https://om-infoclimat.s3.gra.io.cloud.ovh.net/data_spatial/arome_france/
  {YYYY}/{MM}/{DD}/{HH}00Z/{ISO}.om                        ~22,7 Mo
https://map-tiles.open-meteo.com/data_spatial/
  meteofrance_arome_france_hd_15min/{...}/{ISO}.om           ~6,9 Mo
```

Les deux répondent 200, acceptent les **requêtes par plage** (`206 Partial
Content`), et le second est AROME HD en **pas de 15 minutes**. Signature de
fichier : `OM\x03`.

**Pourquoi je ne le retiens pas.** Aucun en-tête CORS, donc inutilisable depuis
la page. Un pas de temps pèse 6,9 Mo, soit ~1,3 Go pour la fenêtre de course.
Et il faudrait un décodeur `.om` plus une interpolation de grille. Les requêtes
par plage rendraient la chose possible, mais pour un gain nul face à la voie
GRIB du point 1, qui est documentée et outillée.

---

## 4. Ce qui est déjà en service

| Source | Clé | État vérifié |
|---|---|---|
| MET Norway | aucune | **sans quota**, CORS ouvert, altitude respectée. Socle de repli. |
| Open-Meteo | aucune | quotas pondérés par points × modèles × variables, épuisables en quelques relevés |
| meteoblue | gratuite | crédits par clé ; une clé épuisée le 17/08, deux autres opérationnelles |
| Windy | gratuite | **niveau gratuit = « testing API »**, données volontairement mélangées. Deux clés donnent 17,1 et 17,9 °C pour le même point au même instant. Écarté du consensus par le garde v35. |

---

## Ce que je ferais, dans cet ordre

1. **AROME 1,3 km via MeteoFetch sur le runner**, à partir du 19/08. C'est le
   plus fort gain de qualité disponible, sans clé et sans quota.
2. **Infoclimat pour les rafales et la vérification**, en acceptant que ce soit
   interrogé depuis le poste et non depuis le runner, tant que la clé est liée
   à une IP.
3. Ne rien faire des fichiers `.om` : la voie GRIB les remplace.
4. Ne rien payer chez Windy : le niveau gratuit est inexploitable et Météo-France
   donne AROME 1,3 km gratuitement, mieux qu'ALADIN 2,3 km.
