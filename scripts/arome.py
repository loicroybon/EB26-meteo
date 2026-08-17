#!/usr/bin/env python3
"""Extraction AROME 1,3 km aux 52 points du parcours, sans aucune clé.

Source : les données ouvertes Météo-France, servies sur un bucket public.
`meteofetch` connaît les chemins ; on décode le GRIB avec cfgrib/xarray.

Pourquoi ce script existe : AROME 0,01° est le seul modèle qui résolve
Belledonne, et la passation dit que rien de ce qui sera annoncé avant son
premier run ne vaudra. Sa portée est de 51 h, donc il atteint le départ du
21/08 06:30 à partir du run du 19/08 03Z.

À exécuter sous Linux (ubuntu-latest, ou WSL) : le décodage GRIB demande
ecCodes, que la roue pip apporte sous Linux mais pas sous Windows.

    python3 scripts/arome.py                 # dernier run, échéances utiles
    python3 scripts/arome.py --groupe 12H    # une seule échéance, pour tester

Rend un JSON sur stdout, ou dans --sortie.
"""
import argparse
import json
import os
import re
import sys
import tempfile
import urllib.request

BASE = "https://meteofrance-pnt.s3.rbx.io.cloud.ovh.net/pnt"
PAQUET = "SP1"          # paramètres de surface : température, vent, précipitations
PORTEE_H = 51


def journal(m):
    print(m, file=sys.stderr, flush=True)


def pois(chemin_index):
    """Lit les 52 points directement dans index.html : une seule source de vérité."""
    with open(chemin_index, encoding="utf-8") as f:
        html = f.read()
    i = html.index("const POIS = [")
    j = html.index("];", i)
    return json.loads(html[i + len("const POIS = "):j + 1])


def dernier_run():
    from meteofetch import Arome001
    return Arome001.get_latest_forecast_time(paquet=PAQUET)


def url_groupe(run, groupe):
    d = run.strftime("%Y-%m-%dT%H:00:00Z")
    return f"{BASE}/{d}/arome/001/{PAQUET}/arome__001__{PAQUET}__{groupe}__{d}.grib2"


def telecharge(url, vers):
    with urllib.request.urlopen(url, timeout=180) as r, open(vers, "wb") as f:
        taille = 0
        while True:
            bloc = r.read(1 << 20)
            if not bloc:
                break
            f.write(bloc)
            taille += len(bloc)
    return taille


def extrait_points(chemin_grib, points):
    """Valeurs aux points, par plus proche voisin de la maille."""
    import xarray as xr
    sorties = {}
    # deux jeux distincts dans SP1 : 2 m au-dessus du sol, et 10 m pour le vent
    for niveau, cles in ((2, ("t2m", "r2")), (10, ("u10", "v10"))):
        try:
            ds = xr.open_dataset(
                chemin_grib, engine="cfgrib", decode_timedelta=False,
                backend_kwargs={"filter_by_keys":
                                {"typeOfLevel": "heightAboveGround", "level": niveau}})
        except Exception as e:
            journal(f"    niveau {niveau} m illisible : {e}")
            continue
        valide = str(ds.valid_time.values)[:19] if "valid_time" in ds.coords else None
        for nom in ds.data_vars:
            if cles and nom not in cles:
                continue
            champ = ds[nom]
            unite = champ.attrs.get("units", "")
            for k, p in enumerate(points):
                pt = champ.sel(latitude=p["lat"], longitude=p["lon"], method="nearest")
                v = float(pt.values)
                if unite == "K":
                    v -= 273.15
                d = sorties.setdefault(k, {"nom": p["nom"], "alt": p["alt"]})
                d[nom] = round(v, 2)
                d.setdefault("maille", [round(float(pt.latitude), 4),
                                        round(float(pt.longitude), 4)])
        ds.close()
        if valide:
            sorties["valide"] = valide
    return sorties


def heures_visees(points, scenario):
    """Heure de passage de chaque point, en datetime UTC."""
    import datetime
    out = []
    for p in points:
        iso = p["t"][str(scenario)]
        t = datetime.datetime.fromisoformat(iso)
        if t.tzinfo is None:                     # les heures du road book sont locales
            t = t.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=2)))
        out.append(t.astimezone(datetime.timezone.utc))
    return out


def groupes_utiles(run, cibles):
    """Seules les echeances qui encadrent au moins un passage.

    C'est le poste de cout : telecharger les 52 echeances represente pres d'un
    gigaoctet par run, alors que la fenetre de course en demande une quarantaine
    au plus, et beaucoup moins tant que la course est en bord de portee."""
    besoins = set()
    for t in cibles:
        h = (t - run).total_seconds() / 3600
        bas, haut = int(h // 1), int(h // 1) + 1
        for k in (bas, haut):
            if 0 <= k <= PORTEE_H:
                besoins.add(k)
    return [f"{k:02d}H" for k in sorted(besoins)]


def interpole(par_groupe, run, cibles, points):
    """Valeur a l'heure de passage, interpolee entre les deux echeances qui
    l'encadrent. Une echeance prise telle quelle introduirait jusqu'a 30 min
    d'erreur sur des grandeurs a fort cycle diurne."""
    import datetime
    res = {}
    for k, (t, p) in enumerate(zip(cibles, points)):
        h = (t - run).total_seconds() / 3600
        if h < 0 or h > PORTEE_H:
            continue                              # hors portee du run
        bas, haut = int(h // 1), int(h // 1) + 1
        gb, gh = f"{bas:02d}H", f"{min(haut, PORTEE_H):02d}H"
        a = (par_groupe.get(gb) or {}).get(str(k))
        b = (par_groupe.get(gh) or {}).get(str(k))
        if not a and not b:
            continue
        if not a:
            a, b = b, None
        f = h - bas
        e = {"nom": p["nom"], "alt": p["alt"], "heure": t.isoformat(),
             "maille": a.get("maille")}
        for cle in ("t2m", "r2", "u10", "v10"):
            va, vb = a.get(cle), (b or {}).get(cle)
            if va is None:
                continue
            e[cle] = round(va + (vb - va) * f, 2) if vb is not None else round(va, 2)
        if e.get("u10") is not None and e.get("v10") is not None:
            e["vent_kmh"] = round((e["u10"] ** 2 + e["v10"] ** 2) ** 0.5 * 3.6, 1)
        res[str(k)] = e
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="index.html")
    ap.add_argument("--groupe", default=None,
                    help="une seule echeance, ex 12H. Sinon la fenetre utile.")
    ap.add_argument("--scenario", type=int, default=43,
                    help="scenario horaire du road book, en heures")
    ap.add_argument("--sortie", default=None)
    a = ap.parse_args()

    points = pois(a.index)
    journal(f"{len(points)} points lus dans {a.index}")

    run = dernier_run()
    journal(f"dernier run {PAQUET} : {run}")

    cibles = heures_visees(points, a.scenario)
    if a.groupe:
        groupes = [a.groupe]
    else:
        groupes = groupes_utiles(run, cibles)
        if not groupes:
            journal(f"aucun passage dans la portee de {PORTEE_H} h de ce run : "
                    "AROME n'atteint pas encore la course, rien a telecharger")
            journal(f"premier passage a +{(cibles[0]-run).total_seconds()/3600:.1f} h")
            return 3
    journal(f"{len(groupes)} echeance(s) a telecharger sur {PORTEE_H + 1}")
    resultat = {"run": str(run), "paquet": PAQUET, "scenario": a.scenario,
                "echeances": {}}

    with tempfile.TemporaryDirectory() as tmp:
        for g in groupes:
            u = url_groupe(run, g)
            dest = os.path.join(tmp, f"{g}.grib2")
            try:
                n = telecharge(u, dest)
            except Exception as e:
                journal(f"  {g} : indisponible ({e})")
                continue
            journal(f"  {g} : {n/1e6:.1f} Mo")
            vals = extrait_points(dest, points)
            valide = vals.pop("valide", None)
            resultat["echeances"][g] = {"valide": valide,
                                        "points": {str(k): v for k, v in vals.items()}}
            os.remove(dest)

    if not a.groupe:
        par_groupe = {g: v["points"] for g, v in resultat["echeances"].items()}
        resultat["points"] = interpole(par_groupe, run, cibles, points)
        journal(f"{len(resultat['points'])} points interpoles a leur heure de passage")
        del resultat["echeances"]          # on ne garde que le resultat utile
    sortie = json.dumps(resultat, ensure_ascii=False, separators=(",", ":"))
    if a.sortie:
        with open(a.sortie, "w", encoding="utf-8") as f:
            f.write(sortie)
        journal(f"ecrit : {a.sortie}, {len(sortie)/1024:.0f} ko")
    else:
        print(sortie)
    return 0


if __name__ == "__main__":
    sys.exit(main())
