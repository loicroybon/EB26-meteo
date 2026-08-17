/* ============================================================================
   Configuration des fournisseurs météo — EB26

   Ce fichier est commité volontairement : les clés utilisées ici sont des clés
   d'offre gratuite et leur exposition est assumée.

   Il fonctionne dans les deux environnements :
   - dans le navigateur, il pose `globalThis.EB26_CONFIG` ;
   - sous Node (runner GitHub Actions), il l'exporte aussi via module.exports,
     et chaque entrée peut être surchargée par une variable d'environnement.

   Une variable d'environnement contient une liste séparée par des virgules et
   prend le pas sur les valeurs écrites ici :
       EB26_METEOBLUE_CLES="cle1,cle2"
       EB26_WINDY_CLES="cle"
       EB26_METEOFRANCE_CLES="cle"

   index.html reste autonome : s'il est ouvert sans ce fichier, il retombe sur
   ses valeurs internes. Ne jamais faire dépendre le rendu de ce fichier.
   ========================================================================== */
(function (global) {
  var env = (typeof process !== 'undefined' && process.env) ? process.env : {};

  /* une variable d'environnement non vide remplace la liste écrite ici */
  function liste(nomEnv, ecrites) {
    var v = env[nomEnv];
    if (v) {
      return String(v).split(',').map(function (s) { return s.trim(); })
                      .filter(function (s) { return s.length > 0; });
    }
    return ecrites.slice();
  }

  var cfg = {
    /* meteoblue MOS : offre gratuite, une requête par point.
       Plusieurs clés peuvent être inventoriées ici, mais une seule est
       employée par relevé — voir `clePrincipale` plus bas. */
    meteoblue: liste('EB26_METEOBLUE_CLES', [
      'QTysmp2OSKP7ba3j',
      'wA5K7fDv1VmIF6US'
    ]),

    /* Windy point-forecast : offre gratuite.
       Réserve mesurée le 17/08/2026 : les clés d'offre gratuite répondent
       toutes avec l'avertissement « The testing API version is for development
       purposes only. This data is randomly shuffled and slightly modified ».
       Deux clés différentes donnent 17,1 et 17,9 °C pour le même point au même
       instant. Le moteur écarte donc ces valeurs du consensus (garde v35).
       Ce n'est pas un défaut de clé : c'est le niveau gratuit lui-même. */
    windy: liste('EB26_WINDY_CLES', [
      'LMtKS6ka4dr1ta1qijmvXBFLUorC6aar',
      'KeHHRQ2wd63hO06cL6uysgyRsgGurWEt',
      'Ht5EqAx3vxrr47kii04E9I3sTMnMcMo3'
    ]),

    /* Météo-France portail-api : clé gratuite à créer sur
       portail-api.meteofrance.fr. C'est la seule voie directe vers AROME
       1,3 km, le seul modèle qui résolve Belledonne. Vide pour l'instant. */
    meteofrance: liste('EB26_METEOFRANCE_CLES', []),

    /* Open-Meteo : l'offre gratuite ne demande aucune clé. Une clé payante
       peut être posée ici pour lever les quotas. */
    openmeteo: liste('EB26_OPENMETEO_CLES', []),

    /* MET Norway : libre, aucune clé. Présent pour mémoire. */
    metno: liste('EB26_METNO_CLES', [])
  };

  /* Les listes ci-dessus sont des roues de secours : une seule clé sert à la
     fois, la première de la liste. On ne passe à la suivante que si la clé
     employée est refusée en tant que clé — invalide, révoquée, domaine non
     autorisé. Un dépassement de crédits n'est pas un problème de clé et ne
     déclenche donc pas de bascule : le plafond est le plafond. */
  cfg.clePrincipale = function (fournisseur) {
    var l = cfg[fournisseur];
    return (l && l.length) ? l[0] : null;
  };

  cfg.aUneCle = function (fournisseur) {
    return !!cfg.clePrincipale(fournisseur);
  };

  cfg.nbCles = function (fournisseur) {
    var l = cfg[fournisseur];
    return l ? l.length : 0;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  global.EB26_CONFIG = cfg;
})(typeof globalThis !== 'undefined' ? globalThis : this);
