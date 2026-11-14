# AfroLuo – Interfaces financières dans les langues nationales du Cameroun

Extension Chrome qui affiche une interface financière (ici l'environnement de test **Safinum Pay**) dans une langue nationale, **sans modifier le code du site**. Les **montants, frais, numéros et bénéficiaires ne sont jamais altérés**, et le français reste affiché à côté de la traduction.

*Projet présenté au SAFINUM Innovate Challenge 2026.*

## Pourquoi AfroLuo ?
Les services financiers numériques sont presque tous en français ou en anglais. Une erreur de lecture sur un montant, des frais ou un avertissement de sécurité coûte de l'argent. AfroLuo rend ces écrans lisibles dans la langue de l'utilisateur, avec des garde-fous pour que l'information financière reste exacte.

## Fonctionnalités
- **Aucune modification du site** : l'extension s'ajoute au navigateur et traduit la page affichée.
- **Montants intouchables** : une traduction qui perd ou change un chiffre ou une variable est rejetée.
- **Affichage bilingue** : langue locale avec le français entre parenthèses.
- **Retour immédiat au français** (fenêtre de l'extension, ou événement de page `afroluo:set` pour un autre design).
- **Mémoire de traduction** entre les pages et les sites : affichage plus rapide à chaque visite.
- **Export des textes non traduits** (CSV) pour les faire valider par des locuteurs natifs.
- **Hors ligne** : le dictionnaire est embarqué, aucun serveur ni clé d'API.
- **Multilingue** : un fichier dictionnaire par langue.

## Installation (4 étapes)
1. Récupérer le dossier de l'extension voulue dans `extensions/` (par exemple `extensions/afroluo-ewondo/`), ou décompresser le zip de l'extension.
2. Ouvrir `chrome://extensions` et activer **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée** et choisir ce dossier (celui qui contient `manifest.json`).
4. Ouvrir `https://safinum.cm/hackathon-test`.

## Utilisation
- L'icône AfroLuo permet d'activer/désactiver la traduction, de choisir la langue et d'afficher ou non le français entre parenthèses.
- **Exporter les textes à faire valider** : génère un CSV des textes sans traduction, sur tous les sites visités.
- Pour piloter la bascule depuis une autre interface :
  ```js
  window.dispatchEvent(new CustomEvent("afroluo:set", { detail: { on: true } }))   // langue locale
  window.dispatchEvent(new CustomEvent("afroluo:set", { detail: { on: false } }))  // français
  ```

## Structure du dépôt
| Chemin | Contenu |
|---|---|
| `extensions/` | Un sous-dossier par extension de l'équipe, chacun chargeable seul dans Chrome |
| `extensions/afroluo-ewondo/` | L'extension ewondo : `content.js`, `popup.*`, `background.js`, `manifest.json`, `languages.json`, `dictionaries/` |
| `extensions/afroluo-ewondo/dictionaries/<langue>.json` | Le dictionnaire d'une langue |
| `build_dictionary.py` | Excel de traductions relues → dictionnaire |
| `modele_compresse/` + `traduire_local.py` | Modèle de traduction compressé (propositions de traductions) |
| `docs/` | Documentation technique |

## Ajouter ou valider des traductions
1. Remplir la colonne de la langue dans le fichier Excel et mettre **Statut = Validé**.
2. `python build_dictionary.py fichier.xlsx --langue <langue> [--a_confirmer]`
3. Recharger l'extension.

Format d'une entrée : `{"fr": "Solde", "tr": "Máan", "status": "valide", "critique": false}`. Les variables comme `{montant}` doivent être identiques en français et dans la langue cible.

## Méthode de validation linguistique
- `valide` : transcription et orthographe confirmées par écrit par un locuteur natif.
- `a_confirmer` : relu avec le locuteur ; transcription écrite à finaliser.
- Dans tous les cas, le français reste affiché à côté et les montants sont protégés.

## Rôle de l'intelligence artificielle
Un modèle MarianMT français → ewondo (Hugging Face Transformers) **propose** des traductions, relues ensuite par un locuteur natif. Il ne tourne pas dans l'extension : celle-ci applique le dictionnaire validé.

## Tests
Les tests automatisés de l'extension utilisent Playwright (traduction, rejet des chiffres altérés, mémoire, bascule français ↔ langue locale).

## Équipe
- [Nom] – [rôle, langue]
- [Nom] – [rôle, langue]
- [Nom] – [rôle, langue]
- [Nom] – [rôle, langue]

## Limites et suite
- Les textes absents du dictionnaire restent en français : le prototype ne traduit pas en direct.
- Suite : validation écrite par des locuteurs natifs, autres langues, audio natif, corpus de phrases financières pour réentraîner le modèle.
