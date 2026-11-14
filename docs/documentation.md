---
title: "AfroLuo – Dossier technique"
subtitle: "SAFINUM Innovate Challenge 2026 – Épreuve de présélection"
---

# 1. En une phrase

AfroLuo est une **extension de navigateur** qui affiche une interface financière en **ewondo**, **sans modifier le code du site**, et qui **garantit que les montants, les frais et les bénéficiaires ne sont jamais altérés**.

# 2. Le problème

Les services financiers numériques sont presque tous en français ou en anglais. Pour beaucoup de Camerounais, lire un montant, des frais ou un avertissement de sécurité dans une langue qui n'est pas la leur est un risque réel d'erreur, donc de perte d'argent. Traduire automatiquement n'est pas une solution sûre : une traduction fausse sur un montant est pire que pas de traduction.

# 3. Notre solution et ce qui la distingue

1. **Aucune modification du site.** L'extension s'ajoute au navigateur et traduit la page affichée. Elle s'adapte à tout site, dont l'environnement de test Safinum Pay.
2. **Montants intouchables.** Une traduction qui perd ou change une variable ou un chiffre est rejetée avant l'affichage. Les montants, frais, numéros de téléphone et noms ne changent jamais.
3. **Affichage bilingue.** La langue locale s'affiche avec le **français entre parenthèses** : l'utilisateur lit sa langue et peut toujours vérifier l'information dans la langue de la plateforme.
4. **Retour immédiat au français**, depuis la fenêtre de l'extension ou depuis le propre design de la plateforme (événement de page `afroluo:set`).
5. **Mémoire de traduction.** Ce qui a déjà été traduit est conservé et réutilisé sur tous les sites : l'affichage est instantané et le dictionnaire s'enrichit à chaque visite.
6. **Cycle de validation intégré.** L'extension exporte en un clic la liste des textes encore sans traduction (tous sites confondus), pour que des locuteurs natifs les complètent. Chaque validation entre directement dans le dictionnaire.
7. **Fonctionne hors ligne**, sans serveur ni clé d'API.
8. **Multilingue par conception** : une langue de plus = un fichier dictionnaire de plus.

# 4. Architecture

| Élément | Rôle |
|---|---|
| Script de contenu (`content.js`) | Parcourt le texte de la page (TreeWalker), observe les changements (MutationObserver) et remplace les textes connus. |
| Dictionnaire par langue (`dictionaries/ewondo.json`) | Entrées « français → ewondo » avec statut, indicateur de ligne critique et variables `{montant}`, `{beneficiaire}`… |
| Mémoire de traduction (`chrome.storage.local`) | Réutilise ce qui a déjà été traité, sur tous les sites. Reconstruite automatiquement quand le dictionnaire change. |
| Fenêtre de l'extension | Choix de la langue, mode bilingue, export des textes non traduits. |
| Outils (`build_dictionary.py`) | Transforme un fichier Excel de traductions relues en dictionnaire. |

# 5. Rôle de l'intelligence artificielle

Un modèle de traduction **MarianMT français → ewondo** (Hugging Face Transformers, base Helsinki-NLP/opus-mt), affiné sur des données bibliques alignées, un dictionnaire et un lexique ewondo–français, **aide à produire les propositions de traduction**. Sur 715 exemples jamais vus pendant l'entraînement : **BLEU 19,7 ; chrF++ 42,1**. Un second modèle (NLLB-200, 600 M) a été évalué (chrF++ 45,1).

Le modèle produit des propositions ; **une locutrice native les relit** avant leur entrée dans le dictionnaire de l'extension. L'extension applique ensuite ce dictionnaire sur la page. Ce choix est volontaire : en finance, aucune traduction automatique ne doit s'afficher sans relecture humaine.

# 6. Langue prise en charge

- **Ewondo** : incluse dans le prototype.
- Architecture prête pour d'autres langues nationales (un dictionnaire par langue).

# 7. Méthode de validation linguistique

1. **Glossaire financier** (*máan* solde, *nkus* frais, *mfuan* montant, *evéban* bénéficiaire, *wómolo* confirmer, *nsómba* paiement, *mvọẹ* sécurité…), établi à partir du lexique ewondo–français et relu par une locutrice native.
2. **Libellés et phrases de l'interface** : proposés par le modèle ou assemblés à partir du glossaire, puis relus avec la locutrice native **[à compléter : nom complet, qualité, date de la relecture]**.
3. **Statuts dans le dictionnaire** : `valide` (transcription et orthographe confirmées par écrit) et `a_confirmer` (relu avec la locutrice ; transcription écrite et normalisation orthographique en cours).
4. **Plateformes** : le français reste affiché à côté de la langue locale, et les montants sont protégés quel que soit le statut.

**État actuel** : 140 entrées, dont 96 confirmées par écrit. Sur les 42 textes relevés dans les 5 écrans de la page de test, 30 sont traduits en ewondo.

# 8. Perspectives

- Finaliser la transcription et l'orthographe de toutes les entrées avec des locuteurs natifs, puis étendre à d'autres langues nationales.
- Ajouter l'**audio** : l'extension sait déjà lire un fichier sonore ; il reste à collecter des enregistrements natifs.
- Constituer un corpus de phrases financières validées pour réentraîner le modèle et couvrir des phrases nouvelles.

# 9. Composants et outils déclarés

- Extension : JavaScript, Chrome Manifest V3 ; tests automatisés avec Playwright ; construction du dictionnaire : Python 3, openpyxl.
- Modèles : Hugging Face Transformers (MarianMT, NLLB-200), entraînement sur Google Colab.
- Données : versets bibliques alignés, dictionnaire et lexique ewondo–français (extraction de pages scannées assistée par l'API Gemini), glossaires relus par une locutrice native.
- Développement assisté par un assistant d'IA (Claude, Anthropic).

# Annexe : installation et utilisation

**Installation (4 étapes, hors ligne)**

1. Décompresser `afroluo-ext.zip` : le dossier `afroluo-ext` contient `manifest.json`.
2. Ouvrir `chrome://extensions` et activer **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `afroluo-ext`.
4. Ouvrir `https://safinum.cm/hackathon-test` (ou recharger la page).

**Utilisation** : l'icône AfroLuo permet d'activer ou de désactiver la traduction (bascule immédiate français ↔ ewondo), de régler le mode bilingue et d'exporter les textes non traduits.
