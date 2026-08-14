#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sonde météo multi-modèles — Échappée Belle Intégrale 2026
=========================================================
Interroge tous les modèles disponibles sur les 52 POI du parcours, à l'heure
exacte de passage prévue par le scénario choisi. Archive chaque relevé pour
suivre la convergence des modèles jour après jour.

Bibliothèque standard uniquement — aucun `pip install` nécessaire.

    python3 sonde_meteo.py                  # scénario 43 h, sortie console + archive
    python3 sonde_meteo.py --scenario 46
    python3 sonde_meteo.py --md rapport.md  # rapport markdown
    python3 sonde_meteo.py --convergence    # compare tous les relevés archivés
    python3 sonde_meteo.py --ensemble       # ajoute les probabilités (lent, ~1 min)

Clés API optionnelles, à poser en variables d'environnement :
    export METEOBLUE_KEY=...      # https://content.meteoblue.com/en/business/access-options/weather-api
    export WINDY_KEY=...          # https://api.windy.com/point-forecast
    export METEOFRANCE_TOKEN=...  # https://portail-api.meteofrance.fr (AROME/ARPEGE, gratuit)
"""

import argparse, csv, json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from statistics import median

HERE = os.path.dirname(os.path.abspath(__file__))
POI_CSV = os.path.join(HERE, "poi_echappee_belle.csv")
ARCHIVE = os.path.join(HERE, "archives_meteo")

# --------------------------------------------------------------------------
# Modèles Open-Meteo. Les identifiants évoluent : ceux qui échouent sont
# simplement signalés et ignorés, le reste du relevé n'en souffre pas.
# --------------------------------------------------------------------------
MODELES = [
    ("meteofrance_arome_france_hd",   "AROME HD 1,3 km",        "Météo-France, la référence sur Belledonne, portée ~51 h"),
    ("meteofrance_arome_france",      "AROME 2,5 km",           "Météo-France, portée ~51 h"),
    ("meteofrance_arpege_europe",     "ARPEGE Europe 11 km",    "Météo-France, portée ~4 j"),
    ("dwd_icon_d2",                   "ICON-D2 2,2 km",         "DWD, couvre les Alpes du Nord, portée 48 h"),
    ("dwd_icon_eu",                   "ICON-EU 7 km",           "DWD, portée 5 j"),
    ("dwd_icon_global",               "ICON global 11 km",      "DWD, portée 7,5 j"),
    ("meteoswiss_icon_ch2",           "ICON-CH2 2 km",          "MeteoSwiss, arc alpin, portée 5 j"),
    ("meteoswiss_icon_ch1",           "ICON-CH1 1 km",          "MeteoSwiss, arc alpin, portée 33 h"),
    ("italia_meteo_arpae_icon_2i",    "ICON-2I 2,2 km",         "ARPAE Italie, versant alpin, portée 72 h"),
    ("knmi_harmonie_arome_europe",    "HARMONIE-AROME 5,5 km",  "KNMI, portée 60 h"),
    ("ecmwf_ifs025",                  "ECMWF IFS 9 km",         "Le meilleur global, portée 15 j"),
    ("ecmwf_aifs025_single",          "ECMWF AIFS (IA)",        "Modèle IA d'ECMWF, portée 15 j"),
    ("ukmo_global_deterministic_10km","UKMO Global 10 km",      "Met Office, portée 7 j"),
    ("gfs_seamless",                  "GFS (NOAA)",             "Portée 16 j"),
    ("gfs_graphcast025",              "GraphCast (DeepMind)",   "Modèle IA, portée 10 j"),
    ("metno_seamless",                "MET Norway",             "Post-traité, portée 10 j"),
    ("jma_seamless",                  "JMA (Japon)",            "Portée 11 j"),
    ("cma_grapes_global",             "CMA GRAPES (Chine)",     "Portée 10 j"),
    ("bom_access_global",             "BOM ACCESS (Australie)", "Portée 10 j"),
]

VARS = ["temperature_2m", "apparent_temperature", "precipitation", "rain", "snowfall",
        "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m", "cloud_cover",
        "relative_humidity_2m", "freezing_level_height", "cape", "weather_code"]

ENSEMBLES = ["ecmwf_ifs025", "gfs025", "icon_eu", "meteofrance_arpege_europe"]

# POI de décision : là où la météo change vraiment quelque chose.
DECISION = ["Croix de Belledonne", "Col de la Mine de Fer", "Col de la Vache",
            "R5 Fond de France Base vie", "Col de Morétan", "R8 Super Collet",
            "Sommet du Grand Chat", "Arrivée Aiguebelle"]

UA = {"User-Agent": "EchappeeBelle2026-sonde/1.0 (usage personnel, préparation de course)"}


# --------------------------------------------------------------------------
def get_json(url, headers=None, essais=3):
    for n in range(essais):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if n == essais - 1:
                raise
            time.sleep(1.5 * (n + 1))


def charge_pois(scenario):
    col = f"passage_{scenario}h_local"
    with open(POI_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    if col not in rows[0]:
        col = "passage_43h_local"
        print(f"  (scénario {scenario} h absent du CSV → repli sur 43 h)", file=sys.stderr)
    return [dict(nom=r["nom"], type=r["type"], km=float(r["km"]), alt=int(r["alt_roadbook_m"]),
                 lat=float(r["lat"]), lon=float(r["lon"]), t=r[col]) for r in rows]


def plus_proche(rep, iso_cible):
    """Renvoie les variables du pas horaire le plus proche de l'heure de passage."""
    h = rep.get("hourly") or {}
    T = h.get("time") or []
    if not T:
        return None
    cible = datetime.fromisoformat(iso_cible)
    best, dt = None, 1e15
    for i, t in enumerate(T):
        d = abs((datetime.fromisoformat(t) - cible).total_seconds())
        if d < dt:
            dt, best = d, i
    if best is None or dt > 7200:
        return None
    out = {v: (h[v][best] if h.get(v) and h[v][best] is not None else None) for v in VARS if v in h}
    out["_alt_modele"] = rep.get("elevation")
    out["_heure"] = T[best]
    return out


def interroge_modele(mid, pois, lot=12):
    """Open-Meteo, par paquets de POI pour rester sous la limite d'URL."""
    res = [None] * len(pois)
    for d in range(0, len(pois), lot):
        p = pois[d:d + lot]
        q = urllib.parse.urlencode({
            "latitude": ",".join(f"{x['lat']}" for x in p),
            "longitude": ",".join(f"{x['lon']}" for x in p),
            "elevation": ",".join(str(x["alt"]) for x in p),
            "hourly": ",".join(VARS),
            "models": mid,
            "timezone": "Europe/Paris",
            "start_date": "2026-08-20",
            "end_date": "2026-08-24",
        })
        j = get_json("https://api.open-meteo.com/v1/forecast?" + q)
        if not isinstance(j, list):
            j = [j]
        for k, o in enumerate(j):
            res[d + k] = o
    return res


def stats(valeurs):
    v = [x for x in valeurs if x is not None]
    if not v:
        return None
    return {"med": round(median(v), 2), "min": round(min(v), 2), "max": round(max(v), 2), "n": len(v)}


# --------------------------------------------------------------------------
def probabilites(pois):
    """Ensembles ECMWF/GFS/ICON : probabilité de pluie, de rafales, dispersion de T."""
    ciblés = [p for p in pois if p["nom"] in DECISION] or pois[::8]
    sortie = {}
    for p in ciblés:
        membres_t, membres_pr, membres_raf = [], [], []
        for ens in ENSEMBLES:
            try:
                q = urllib.parse.urlencode({
                    "latitude": p["lat"], "longitude": p["lon"], "elevation": p["alt"],
                    "hourly": "temperature_2m,precipitation,wind_gusts_10m",
                    "models": ens, "timezone": "Europe/Paris",
                    "start_date": "2026-08-20", "end_date": "2026-08-24"})
                j = get_json("https://ensemble-api.open-meteo.com/v1/ensemble?" + q)
            except Exception:
                continue
            h = j.get("hourly", {})
            T = h.get("time", [])
            if not T:
                continue
            cible = datetime.fromisoformat(p["t"])
            i = min(range(len(T)), key=lambda k: abs((datetime.fromisoformat(T[k]) - cible).total_seconds()))
            for cle, bac in (("temperature_2m", membres_t), ("precipitation", membres_pr),
                             ("wind_gusts_10m", membres_raf)):
                for k, serie in h.items():
                    if k.startswith(cle) and isinstance(serie, list) and i < len(serie) and serie[i] is not None:
                        bac.append(serie[i])
        if membres_t:
            sortie[p["nom"]] = {
                "membres": len(membres_t),
                "T_med": round(median(membres_t), 1),
                "T_p10": round(sorted(membres_t)[int(.1 * len(membres_t))], 1),
                "T_p90": round(sorted(membres_t)[int(.9 * len(membres_t)) - 1], 1),
                "P_pluie": round(100 * sum(1 for x in membres_pr if x > 0.2) / max(1, len(membres_pr))),
                "P_pluie_forte": round(100 * sum(1 for x in membres_pr if x > 2.0) / max(1, len(membres_pr))),
                "P_rafales_50": round(100 * sum(1 for x in membres_raf if x > 50) / max(1, len(membres_raf))),
            }
        time.sleep(.3)
    return sortie


def meteoblue(pois):
    """Optionnel : meteoblue (NEMS + multimodel MOS). Nécessite METEOBLUE_KEY."""
    cle = os.environ.get("METEOBLUE_KEY")
    if not cle:
        return {}
    out = {}
    for p in pois:
        try:
            q = urllib.parse.urlencode({"lat": p["lat"], "lon": p["lon"], "asl": p["alt"],
                                        "apikey": cle, "format": "json", "tz": "Europe/Paris"})
            j = get_json("https://my.meteoblue.com/packages/basic-1h?" + q)
            h = j["data_1h"]
            cible = datetime.fromisoformat(p["t"])
            i = min(range(len(h["time"])),
                    key=lambda k: abs((datetime.fromisoformat(h["time"][k].replace(" ", "T")) - cible).total_seconds()))
            out[p["nom"]] = {"temperature_2m": h["temperature"][i],
                             "apparent_temperature": h.get("felttemperature", [None] * (i + 1))[i],
                             "precipitation": h["precipitation"][i],
                             "wind_speed_10m": h["windspeed"][i] * 3.6,
                             "relative_humidity_2m": h.get("relativehumidity", [None] * (i + 1))[i]}
        except Exception as e:
            print(f"  meteoblue {p['nom']} : {e}", file=sys.stderr)
        time.sleep(.2)
    return out


def windy(pois):
    """Optionnel : Windy Point Forecast API. Nécessite WINDY_KEY."""
    cle = os.environ.get("WINDY_KEY")
    if not cle:
        return {}
    out = {}
    for p in pois:
        for mod in ("arome", "iconEu", "ecmwf", "gfs"):
            try:
                corps = json.dumps({"lat": p["lat"], "lon": p["lon"], "model": mod,
                                    "parameters": ["temp", "wind", "precip", "gust"],
                                    "levels": ["surface"], "key": cle}).encode()
                req = urllib.request.Request("https://api.windy.com/api/point-forecast/v2", data=corps,
                                             headers={**UA, "Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=40) as r:
                    j = json.loads(r.read().decode())
                cible = datetime.fromisoformat(p["t"]).timestamp() * 1000
                i = min(range(len(j["ts"])), key=lambda k: abs(j["ts"][k] - cible))
                out.setdefault(p["nom"], {})[mod] = {
                    "temperature_2m": round(j["temp-surface"][i] - 273.15, 1),
                    "precipitation": round(j.get("past3hprecip-surface", [0] * (i + 1))[i] * 1000 / 3, 2),
                }
            except Exception:
                pass
            time.sleep(.2)
    return out


# --------------------------------------------------------------------------
def releve(scenario, avec_ensemble):
    pois = charge_pois(scenario)
    print(f"{len(pois)} POI · scénario {scenario} h · départ {pois[0]['t']}\n")
    donnees, echecs = {}, []
    for mid, nom, note in MODELES:
        try:
            print(f"  → {nom:<26}", end="", flush=True)
            reps = interroge_modele(mid, pois)
            extraits = [plus_proche(r, p["t"]) if r else None for r, p in zip(reps, pois)]
            couv = sum(1 for e in extraits if e)
            if couv == 0:
                print("n'atteint pas encore la course")
                continue
            donnees[mid] = {"nom": nom, "note": note, "pts": extraits, "brut": reps}
            print(f"{couv}/{len(pois)} points")
        except Exception as e:
            echecs.append(f"{nom} : {e}")
            print("indisponible")
        time.sleep(.4)

    consensus = []
    for i, p in enumerate(pois):
        lignes = {m: d["pts"][i] for m, d in donnees.items() if d["pts"][i]}
        agg = {v: stats([l.get(v) for l in lignes.values()]) for v in
               ("temperature_2m", "apparent_temperature", "precipitation", "wind_speed_10m",
                "wind_gusts_10m", "cloud_cover", "freezing_level_height", "cape")}
        consensus.append({**p, "n_modeles": len(lignes), "agg": agg,
                          "detail": {m: {k: v for k, v in l.items()} for m, l in lignes.items()}})

    snap = {"releve": datetime.now(timezone.utc).isoformat(timespec="minutes"),
            "scenario_h": scenario, "modeles": {m: d["nom"] for m, d in donnees.items()},
            "echecs": echecs, "points": consensus}

    if avec_ensemble:
        print("\n  → ensembles (probabilités)…")
        snap["probabilites"] = probabilites(pois)
    mb = meteoblue(pois)
    if mb:
        snap["meteoblue"] = mb
    wy = windy(pois)
    if wy:
        snap["windy"] = wy

    os.makedirs(ARCHIVE, exist_ok=True)
    chemin = os.path.join(ARCHIVE, datetime.now().strftime("%Y%m%d_%H%M") + f"_s{scenario}.json")
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(f"\nArchivé : {chemin}")
    if echecs:
        print("Modèles non renvoyés : " + " | ".join(e.split(" : ")[0] for e in echecs))
    return snap, donnees


def console_html(donnees, echecs, sortie, scenarios=(40, 43, 46)):
    """Écrit une console HTML autonome : les données sont intégrées au fichier,
    donc elle s'ouvre hors ligne, dans n'importe quel navigateur, sans serveur."""
    gabarit = os.path.join(HERE, "meteo_echappee_belle.html")
    if not os.path.isfile(gabarit):
        print(f"Gabarit introuvable : {gabarit}", file=sys.stderr)
        return
    src = open(gabarit, encoding="utf-8").read()
    if "/*__PRECHARGE__*/" not in src:
        print("Le gabarit ne contient pas le marqueur __PRECHARGE__.", file=sys.stderr)
        return

    CLES = [("temperature_2m", "t"), ("apparent_temperature", "res"), ("precipitation", "pr"),
            ("wind_speed_10m", "v"), ("wind_gusts_10m", "raf"), ("wind_direction_10m", "dir"),
            ("cloud_cover", "nu"), ("freezing_level_height", "iso0"), ("cape", "cape")]

    modeles = {}
    for mid, d in donnees.items():
        pts = {}
        for sc in scenarios:
            pois_sc = charge_pois(sc)
            serie = []
            for r, p in zip(d["brut"], pois_sc):
                e = plus_proche(r, p["t"]) if r else None
                serie.append(None if not e else
                             {**{court: e.get(long) for long, court in CLES},
                              "alt_modele": e.get("_alt_modele")})
            pts[sc] = serie
        modeles[mid] = {"nom": d["nom"], "pts": pts}

    charge = {"releve": datetime.now(timezone.utc).isoformat(timespec="minutes"),
              "scenarios": list(scenarios),
              "echecs": [e.split(" : ")[0] for e in echecs],
              "modeles": modeles}
    out = src.replace("/*__PRECHARGE__*/ null",
                      json.dumps(charge, ensure_ascii=False, separators=(",", ":")))
    with open(sortie, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Console autonome : {sortie}  ({len(out)//1024} ko, {len(modeles)} modèles)")


def affiche(snap):
    print(f"\n{'Point':<28}{'Passage':<12}{'T':>7}{'Ress.':>7}{'Pluie':>7}{'Raf.':>6}{'Iso0':>7}{'n':>4}")
    print("-" * 86)
    for p in snap["points"]:
        a = p["agg"]
        f = lambda k, d=1: (f"{a[k]['med']:.{d}f}" if a.get(k) else "—")
        ec = (f"±{(a['temperature_2m']['max'] - a['temperature_2m']['min']) / 2:.0f}"
              if a.get("temperature_2m") else "")
        print(f"{p['nom'][:27]:<28}{p['t'][5:16].replace('T',' '):<12}"
              f"{f('temperature_2m'):>7}{f('apparent_temperature'):>7}{f('precipitation'):>7}"
              f"{f('wind_gusts_10m',0):>6}{f('freezing_level_height',0):>7}{p['n_modeles']:>4}  {ec}")
    for nom, pr in (snap.get("probabilites") or {}).items():
        print(f"\n  {nom} — {pr['membres']} membres : pluie {pr['P_pluie']} % "
              f"(forte {pr['P_pluie_forte']} %) · rafales>50 {pr['P_rafales_50']} % · "
              f"T {pr['T_p10']} → {pr['T_p90']} °C")


def rapport_md(snap, chemin):
    L = [f"# Sonde météo — Échappée Belle Intégrale 2026",
         f"\nRelevé du {snap['releve']} · scénario **{snap['scenario_h']} h** · "
         f"{len(snap['modeles'])} modèles interrogés\n",
         "| Point | km | Alt | Passage | T °C | Ressenti | Pluie mm/h | Rafales | Iso 0 °C | Modèles | Écart T |",
         "|---|--:|--:|---|--:|--:|--:|--:|--:|--:|--:|"]
    for p in snap["points"]:
        a = p["agg"]
        f = lambda k, d=1: (f"{a[k]['med']:.{d}f}" if a.get(k) else "—")
        ec = (f"{a['temperature_2m']['max'] - a['temperature_2m']['min']:.1f}" if a.get("temperature_2m") else "—")
        L.append(f"| {p['nom']} | {p['km']:.1f} | {p['alt']} | {p['t'][5:16].replace('T',' ')} | "
                 f"{f('temperature_2m')} | {f('apparent_temperature')} | {f('precipitation')} | "
                 f"{f('wind_gusts_10m',0)} | {f('freezing_level_height',0)} | {p['n_modeles']} | {ec} |")
    if snap.get("probabilites"):
        L += ["\n## Probabilités (ensembles)\n",
              "| Point | Membres | P(pluie) | P(pluie forte) | P(rafales > 50) | T p10 | T p90 |", "|---|--:|--:|--:|--:|--:|--:|"]
        for n, pr in snap["probabilites"].items():
            L.append(f"| {n} | {pr['membres']} | {pr['P_pluie']} % | {pr['P_pluie_forte']} % | "
                     f"{pr['P_rafales_50']} % | {pr['T_p10']} | {pr['T_p90']} |")
    L.append("\n## Modèles\n")
    for m, n in snap["modeles"].items():
        L.append(f"- **{n}** (`{m}`)")
    if snap.get("echecs"):
        L.append("\nNon renvoyés : " + ", ".join(e.split(" : ")[0] for e in snap["echecs"]))
    open(chemin, "w", encoding="utf-8").write("\n".join(L))
    print(f"Rapport : {chemin}")


def convergence():
    if not os.path.isdir(ARCHIVE):
        print("Aucune archive.")
        return
    fichiers = sorted(f for f in os.listdir(ARCHIVE) if f.endswith(".json"))
    if not fichiers:
        print("Aucune archive.")
        return
    snaps = [json.load(open(os.path.join(ARCHIVE, f), encoding="utf-8")) for f in fichiers]
    print("Convergence des modèles — température médiane et écart inter-modèles\n")
    for cible in DECISION:
        lignes = []
        for f, s in zip(fichiers, snaps):
            p = next((x for x in s["points"] if x["nom"] == cible), None)
            if p and p["agg"].get("temperature_2m"):
                a = p["agg"]["temperature_2m"]
                pr = p["agg"].get("precipitation")
                lignes.append(f"    {f[:13]}  {a['med']:>6.1f} °C   écart {a['max']-a['min']:>4.1f} °C   "
                              f"pluie {pr['med'] if pr else 0:>4.1f} mm   ({p['n_modeles']} modèles)")
        if lignes:
            print(f"  {cible}")
            print("\n".join(lignes), "\n")
    print("Ce qui compte : l'écart inter-modèles doit se resserrer. Tant qu'il reste large,\n"
          "la valeur médiane n'est pas une prévision, c'est une moyenne d'hypothèses.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Sonde météo multi-modèles — Échappée Belle 2026")
    ap.add_argument("--scenario", type=int, default=43, help="temps total visé, en heures (36–52)")
    ap.add_argument("--ensemble", action="store_true", help="ajoute les probabilités d'ensemble (plus lent)")
    ap.add_argument("--md", metavar="FICHIER", help="écrit un rapport markdown")
    ap.add_argument("--convergence", action="store_true", help="compare les relevés archivés")
    ap.add_argument("--console", metavar="FICHIER",
                    help="écrit une console HTML autonome, données intégrées (repli hors ligne)")
    a = ap.parse_args()
    if a.convergence:
        convergence()
    else:
        s, donnees = releve(a.scenario, a.ensemble)
        affiche(s)
        if a.md:
            rapport_md(s, a.md)
        if a.console:
            console_html(donnees, s["echecs"], a.console)
