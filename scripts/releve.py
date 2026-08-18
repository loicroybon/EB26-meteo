#!/usr/bin/env python3
"""Relevé partagé — exécuté par GitHub Actions, jamais par un navigateur d'utilisateur.

Le principe : on charge la page réellement déployée dans un Chrome sans écran, on
force un relevé, puis on récupère le paquet de cache que la page vient de
construire et on l'écrit dans data/dernier.json.

Pourquoi charger la page plutôt que réécrire le pipeline en Python : index.html
reste la source unique de vérité pour la prévision. Aucune logique de consensus,
de doublon ou de physique de terrain n'est dupliquée ici. En prime, le Referer
envoyé est celui du domaine autorisé pour les clés restreintes.

Usage :
    python scripts/releve.py [url] [chemin_sortie]
"""
import json
import os
import sys
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

URL = sys.argv[1] if len(sys.argv) > 1 else "https://loicroybon.github.io/EB26-meteo/"
SORTIE = sys.argv[2] if len(sys.argv) > 2 else "data/dernier.json"

# Provenance : le meme script sert le runner et le poste. On la deduit de
# l'environnement plutot que de la passer a la main, pour qu'un relevé local
# soit toujours etiquete comme tel dans le journal de la page.
ORIGINE = os.environ.get("EB26_ORIGINE") or ("github-actions" if os.environ.get("CI") else "poste-local")

CLE_CACHE = "cache:v3"          # doit suivre index.html
ATTENTE_MAX_S = 420             # une reprise Open-Meteo dure une minute pleine
STABLE_REQUIS = 4               # nombre de sondages identiques avant de conclure

# La page est IMMOBILE pendant qu'elle patiente entre deux tentatives : juger sur
# le seul texte affiche faisait conclure trop tot. On lit donc l'etat reel des
# ordonnanceurs - requetes en vol et pauses programmees.
# Reference DIRECTE et non eval() : les ordonnanceurs sont des `const` de portee
# lexicale globale, atteignables par leur nom mais pas par eval() dans le contexte
# injecte. La version precedente renvoyait donc toujours null, et le releve
# repartait au bout de douze secondes sans attendre la moindre reprise.
OCCUPE_JS = """
  const now = Date.now(), O = [];
  try { O.push(ORD_OM); } catch(e) {}
  try { O.push(ORD_MB); } catch(e) {}
  try { O.push(ORD_WY); } catch(e) {}
  try { O.push(ORD_MN); } catch(e) {}
  if (!O.length) return null;                // rien a observer : on retombe sur le texte
  return O.some(o => o && ((o.enCours|0) > 0 || (o.pause|0) > now));
"""


def journal(msg):
    print(msg, flush=True)


def navigateur():
    opts = Options()
    for a in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
              "--disable-gpu", "--window-size=1400,2400", "--lang=fr-FR"):
        opts.add_argument(a)
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    return webdriver.Chrome(options=opts)


def main():
    journal(f"Relevé partagé — {URL}")
    d = navigateur()
    try:
        d.get(URL)
        time.sleep(5)

        version = d.execute_script("return document.title") or "?"
        journal(f"  page chargée : {version}")

        # On ne force PAS. Le cron tourne chaque heure mais les mailles fines ne
        # changent de run que toutes les 3 h : on laisse le garde-fou de la page
        # décider. Tant qu'aucun run nouveau n'est publié, il refuse et aucun
        # quota n'est dépensé. `force` n'est utilisé que si FORCER=1, pour un
        # déclenchement manuel qui veut vraiment un relevé.
        forcer = os.environ.get("FORCER", "") == "1"
        avant = d.execute_script("return TS_DONNEES")
        d.execute_script("interroger(arguments[0])", forcer)

        precedent, stable = None, 0
        debut = time.time()
        while time.time() - debut < ATTENTE_MAX_S:
            time.sleep(3)
            try:
                courant = d.find_element(By.TAG_NAME, "body").text
            except Exception:
                break
            try:
                occupe = d.execute_script(OCCUPE_JS)
            except Exception:
                occupe = None
            if courant == precedent:
                stable += 1
                # immobile ET plus rien en vol ni en attente de reprise
                if stable >= STABLE_REQUIS and not occupe:
                    break
            else:
                stable = 0
            precedent = courant
        journal(f"  relevé terminé en {time.time()-debut:.0f} s")

        # Rien n'a bougé : le garde-fou a refusé parce qu'aucun run nouveau
        # n'est publié. On sort proprement sans rien écrire, donc sans commit.
        apres = d.execute_script("return TS_DONNEES")
        if not forcer and avant and apres == avant:
            journal("  aucun run nouveau publié : rien à faire, aucun quota dépensé")
            return 3

        # on demande explicitement l'écriture du cache, puis on le relit
        d.execute_script("try{cacheEcrire()}catch(e){console.error(e.message)}")
        time.sleep(2)
        brut = d.execute_script(
            "return localStorage.getItem(arguments[0])", CLE_CACHE)
        if not brut:
            journal("  ÉCHEC : aucun paquet de cache produit")
            return 1

        paquet = json.loads(brut)
        modeles = sorted((paquet.get("modeles") or {}).keys())
        if not modeles:
            journal("  ÉCHEC : paquet sans aucun modèle, rien à publier")
            return 1

        # métadonnées propres au relevé partagé, pour que la page sache d'où ça vient
        paquet["partage"] = {
            "genere_par": ORIGINE,
            "version_page": version,
            "url": URL,
            "modeles": modeles,
        }

        couverture = d.execute_script("""
          const out = {};
          for (const id in DATA) {
            const arr = (DATA[id].pts && DATA[id].pts[SCENARIO]) || [];
            let n = 0; arr.forEach(e => { if (e && e.t !== null && e.t !== undefined) n++; });
            out[id] = n + '/' + POIS.length;
          }
          return out;
        """) or {}
        for mid in modeles:
            journal(f"    {mid} : {couverture.get(mid, '?')}")

        for e in d.get_log("browser"):
            if e["level"] == "SEVERE" and "favicon" not in e["message"]:
                journal(f"    [navigateur] {e['message'][:160]}")

        os.makedirs(os.path.dirname(SORTIE) or ".", exist_ok=True)
        with open(SORTIE, "w", encoding="utf-8") as f:
            json.dump(paquet, f, ensure_ascii=False, separators=(",", ":"))
        taille = os.path.getsize(SORTIE)
        journal(f"  écrit : {SORTIE}, {taille/1024:.0f} ko, {len(modeles)} modèle(s)")
        return 0
    finally:
        d.quit()


if __name__ == "__main__":
    sys.exit(main())
