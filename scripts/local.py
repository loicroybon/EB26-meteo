#!/usr/bin/env python3
"""Producteurs locaux d'assets statiques, à commiter.

À quoi ça sert. Le rafraîchissement normal passe par le cron horaire, ou par le
bouton de la page. Ce script est le **filet** : il permet de produire depuis
votre poste les mêmes assets, quand le runner n'y arrive pas ou n'y a pas droit.

Trois cas réels, tous rencontrés le 17/08 :

  - Open-Meteo limite par adresse IP. Le runner GitHub n'a obtenu que 2 modèles
    quand ce poste en obtenait 9. Un relevé local donne alors un bien meilleur
    point de départ à la version déployée.
  - la clé Infoclimat est liée à une IPv4 fixe, celle de ce poste. Le runner ne
    peut donc jamais l'utiliser : seul un producteur local le peut.
  - AROME 1,3 km demande Python et ecCodes. Ça marche sur le runner Linux et
    dans WSL, pas sous Windows nativement.

Les assets vont dans data/ et sont commités. La page les lit s'ils existent et
s'en passe sinon : rien de l'affichage ne doit dépendre de leur présence.

    python scripts/local.py              # liste ce qui est possible ici
    python scripts/local.py releve       # relevé complet depuis ce poste
    python scripts/local.py arome        # AROME, si la fenêtre est à portée
    python scripts/local.py tout
"""
import os
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DATA = os.path.join(RACINE, "data")


def journal(m):
    print(m, flush=True)


def dispo_selenium():
    try:
        import selenium  # noqa: F401
        return True
    except ImportError:
        return False


def dispo_wsl():
    if os.name != "nt":
        return False
    try:
        r = subprocess.run(["wsl.exe", "-l", "-q"], capture_output=True, timeout=20)
        return r.returncode == 0
    except Exception:
        return False


def produit_releve():
    """Relevé complet depuis ce poste, écrit data/dernier.json.

    Même script que le runner : index.html reste la source unique de vérité, et
    la provenance sera étiquetée « poste-local » dans le journal de la page."""
    if not dispo_selenium():
        journal("  selenium absent : pip install selenium")
        return 1
    env = dict(os.environ, EB26_ORIGINE="poste-local", FORCER="1")
    return subprocess.call(
        [sys.executable, os.path.join(ICI, "releve.py"),
         "https://loicroybon.github.io/EB26-meteo/",
         os.path.join(DATA, "dernier.json")],
        cwd=RACINE, env=env)


def produit_arome():
    """AROME 1,3 km, écrit data/arome.json. Décline si hors portée.

    Sous Windows le décodage GRIB n'aboutit pas : on passe par WSL, où la roue
    pip apporte ecCodes. Le script rend 3 quand la course n'est pas encore dans
    la portée de 51 h du dernier run, ce qui est le cas normal avant le 19/08."""
    sortie = os.path.join(DATA, "arome.json")
    if os.name == "nt":
        if not dispo_wsl():
            journal("  WSL indisponible : AROME ne peut pas être décodé ici")
            return 1
        cmd = ("cd /mnt/c/dev/_perso/EB26-meteo && "
               "/tmp/mf/bin/python scripts/arome.py --sortie data/arome.json")
        code = subprocess.call(["wsl.exe", "-d", "Debian", "--", "bash", "-lc", cmd])
    else:
        code = subprocess.call([sys.executable, os.path.join(ICI, "arome.py"),
                                "--sortie", sortie], cwd=RACINE)
    if code == 3:
        journal("  AROME hors portée pour l'instant : rien écrit, c'est normal "
                "avant le run du 19/08 03Z")
        return 0
    return code


PRODUCTEURS = {
    "releve": ("relevé complet depuis ce poste -> data/dernier.json", produit_releve),
    "arome": ("AROME 1,3 km aux 52 points -> data/arome.json", produit_arome),
}


def etat():
    journal("Producteurs disponibles depuis ce poste :\n")
    for nom, (desc, _) in PRODUCTEURS.items():
        journal(f"  {nom:8s} {desc}")
    journal("")
    journal(f"  selenium : {'oui' if dispo_selenium() else 'non'}")
    journal(f"  WSL      : {'oui' if dispo_wsl() else 'non (inutile hors Windows)'}")
    journal("")
    if os.path.isdir(DATA):
        journal("Assets déjà présents dans data/ :")
        for f in sorted(os.listdir(DATA)):
            p = os.path.join(DATA, f)
            journal(f"  {f:20s} {os.path.getsize(p)/1024:7.0f} ko")
    journal("\nAprès production, commiter data/ pour que la version déployée en profite.")


def main():
    os.makedirs(DATA, exist_ok=True)
    args = sys.argv[1:]
    if not args:
        etat()
        return 0
    cibles = list(PRODUCTEURS) if args[0] == "tout" else args
    pire = 0
    for nom in cibles:
        if nom not in PRODUCTEURS:
            journal(f"inconnu : {nom}. Attendu : {', '.join(PRODUCTEURS)} ou tout")
            pire = 2
            continue
        desc, fn = PRODUCTEURS[nom]
        journal(f"\n=== {nom} : {desc} ===")
        code = fn()
        journal(f"=== {nom} : {'ok' if code == 0 else 'code ' + str(code)}")
        pire = max(pire, code)
    return pire


if __name__ == "__main__":
    sys.exit(main())
