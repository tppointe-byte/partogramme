# Partogramme — à savoir sur ce projet

- Site statique sans étape de build : `index.html` + `style.css` + des fichiers JS séparés
  (un par onglet : `app.js` patientes et suivi du travail, `examens.js`, `grossesses.js`,
  `enfants.js`, `praticiens.js`, et `export.js` pour l'export Excel). Bibliothèques chargées
  depuis un CDN.
- Le dépôt GitHub public est https://github.com/tppointe-byte/partogramme (créé le
  2026-09-30). Le site est en ligne sur https://sps-g34-parto.professeurpetitchat.com/ :
  chaque `git push` dans `main` publie le site (workflow GitHub Actions).
- Pour prévisualiser : `node serveur-local.js` (à la racine du dossier Projets) sert le dossier
  sur http://127.0.0.1:8642/. Python n'est pas installé et PowerShell bloque `npx` (stratégie
  d'exécution), donc passer par Node directement.
- La clé Supabase dans `config.js` doit être **uniquement la clé publishable** (`sb_publishable_…`
  via `window.SUPABASE_KEY`). Une ancienne version contenait des clés secrètes collées bout à
  bout : elles ont été retirées du fichier mais restent dans l'historique une fois poussé —
  pensez à les régénérer dans Supabase (*Settings → API keys*) après la mise en ligne.
- Projet Supabase : `potrimpryfynwgbuceil`. Tables : `patiente`, `grossesse`, `enfant`,
  `praticien`, `orientation`, `examen`. RLS activée avec des règles ouvertes pour le rôle
  `anon` en lecture, ajout et modification (données fictives du TP).
- Convention : les noms de colonnes sont **sans accents** (`prenom`, `specialite`,
  `duree_travail`…). Des colonnes accentuées (`prénom`, `spécialité`, `durée_travail`,
  `durée_expulsion`, `Examen` en majuscule) ont été renommées le 2026-09-30 pour
  correspondre au code — ne recréez pas de colonnes avec accents.
- Une `maquette.png` à la racine sert de référence visuelle pour l'interface.
