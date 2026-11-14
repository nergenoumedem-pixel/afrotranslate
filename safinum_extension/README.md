# Safinum — Traduction de sites financiers en langues nationales du Cameroun

Extension Chrome / Edge qui traduit l'interface d'un site financier du **français** vers le **Ngiemboon**, l'**Ewondo**, le **Bamoun** et le **Douala**, sans modifier les montants, noms, numéros de compte, références ni dates.
La traduction est faite **sur l'ordinateur de l'utilisateur** : aucune donnée affichée n'est envoyée sur internet.

Projet présenté au SAFINUM Innovate Challenge (CNEF Cameroun).

---

## 1. Architecture

```
Navigateur (Chrome / Edge)                     Même ordinateur
┌──────────────────────────────┐   127.0.0.1   ┌───────────────────────────────┐
│ afro_translate/ (extension)  │ ───────────▶  │ serveur_traduction/           │
│  - dictionnaires validés     │  port 8765    │  - modèles de traduction      │
│  - garde-fous (montants,     │ ◀───────────  │    (ONNX / CTranslate2)       │
│    noms, références)         │               │  - n'enregistre aucun texte   │
└──────────────────────────────┘               └───────────────────────────────┘
```

Ordre de traduction pour chaque texte de la page :
1. **Dictionnaire validé** (`memoire/*.json`) : phrase traduite par un locuteur, toujours prioritaire.
2. **Modèle local** (via le serveur) : les montants, noms et références sont masqués avant traduction puis remis à l'identique.
3. **Garde-fous** : si une valeur protégée a changé ou si la sortie est suspecte, le texte reste **en français**.

Si le serveur est arrêté, l'extension fonctionne quand même avec les dictionnaires seuls.

---

## 2. Prérequis

- Windows 10/11 (testé), Google Chrome ou Microsoft Edge récent
- **Python 3.10 ou plus récent** : https://www.python.org/downloads/ — cocher **« Add python.exe to PATH »** à l'installation
- Connexion internet **uniquement au premier lancement** (installation des bibliothèques Python)
- 8 Go de mémoire vive conseillés (les 4 modèles chargés ensemble)

---

## 3. Récupérer les modèles

Les modèles sont trop volumineux pour Git (jusqu'à 600 Mo par fichier). Ils sont disponibles ici :

**Lien des modèles : [À COMPLÉTER — lien Google Drive]**

Les placer **directement** (sans sous-dossier supplémentaire) dans `serveur_traduction/modeles_ct2/` :

```
serveur_traduction/modeles_ct2/
├── ngiemboon/   config.json, tokenizer.json, encoder_model_quantized.onnx, decoder_model_quantized.onnx
├── ewondo/      config.json, model.bin, shared_vocabulary.json
├── bamoun/      config.json, model.bin, shared_vocabulary.json
└── douala/      config.json, generation_config.json, tokenizer.json, tokenizer_config.json,
                 onnx/encoder_model_quantized.onnx (+ .onnx_data),
                 onnx/decoder_model_merged_quantized.onnx (+ .onnx_data)
```

Une langue dont le dossier est vide est simplement ignorée par le serveur.

---

## 4. Lancement

### Étape 1 — Démarrer le serveur local
1. Ouvrir le dossier `serveur_traduction/`
2. Double-cliquer sur **`LANCER_SERVEUR.bat`**
   - Au premier lancement, il installe automatiquement `ctranslate2`, `sentencepiece`, `onnxruntime` et `tokenizers`.
3. Attendre l'affichage :
   ```
   ✓ ngiemboon  chargé …
   ✓ ewondo     chargé …
   ✓ bamoun     chargé …
   ✓ douala     chargé …
   Prêt : http://127.0.0.1:8765
   ```
4. **Laisser cette fenêtre ouverte** pendant toute l'utilisation.

Vérification : ouvrir http://127.0.0.1:8765/etat dans le navigateur → la liste des langues chargées s'affiche.

### Étape 2 — Installer l'extension
1. Ouvrir `chrome://extensions` (Chrome) ou `edge://extensions` (Edge)
2. Activer le **Mode développeur** (en haut à droite / à gauche sur Edge)
3. Cliquer sur **« Charger l'extension non empaquetée »**
4. Sélectionner le dossier **`afro_translate/`**
5. Épingler l'icône de l'extension dans la barre d'outils

### Étape 3 — Traduire une page
1. Ouvrir le site financier et actualiser la page (**F5**)
2. Cliquer sur l'icône de l'extension
3. Choisir la langue → **« Traduire en … »**
4. **« Retour au français »** rétablit la page d'origine à l'identique
5. Option **« Toujours traduire dans cette langue »** : les pages suivantes sont traduites automatiquement

La ligne grise du popup indique ce qui est utilisé, par exemple :
`Ewondo · dictionnaire : 139 phrases · modèle : serveur local`

---

## 5. Vérifications rapides

| Test | Résultat attendu |
|---|---|
| Traduire une page | Popup : « Montants, noms et références intacts ✓ » |
| Montants, noms, n° de compte, références, dates | Identiques au français |
| « Retour au français » | Page exactement comme avant |
| Contenu ajouté après traduction (menu, fenêtre) | Traduit automatiquement |
| Fermer la fenêtre du serveur puis traduire | Seules les phrases des dictionnaires sont traduites, le reste reste en français |

---

## 6. Sécurité et confidentialité

- Le serveur écoute **uniquement** sur `127.0.0.1` : il n'est pas accessible depuis le réseau.
- Aucun texte n'est enregistré, journalisé ni transmis à un service extérieur.
- L'extension ne modifie que le texte affiché : jamais les champs de saisie, les valeurs des formulaires ni le code HTML.
- Les montants, noms, numéros de compte, références, codes et dates ne sont jamais traduits ; chaque texte est contrôlé avant/après traduction.
- Une alerte de sécurité dont la traduction n'a pas été validée par un locuteur reste en français.

---

## 7. Langues

| Langue | Dictionnaire validé | Modèle | Format du modèle |
|---|---|---|---|
| Ngiemboon | oui | MarianMT réentraîné | ONNX (int8) |
| Ewondo | oui | MarianMT (AfroLuo) | CTranslate2 (int8) |
| Bamoun | oui | NLLB-200 réentraîné | CTranslate2 (int8) |
| Douala | en cours de validation | modèle réentraîné | ONNX (int8) |

Les traductions produites par les modèles doivent être relues par un locuteur ; les phrases validées sont ajoutées aux dictionnaires (`memoire/<langue>.json`, format `{"phrase en français": "traduction"}`), qui sont toujours prioritaires.

---

## 8. Dépannage

| Problème | Solution |
|---|---|
| La fenêtre du serveur affiche « Python n'est pas installé » | Installer Python en cochant « Add python.exe to PATH », relancer |
| « ✗ <langue> : … » au démarrage | Vérifier que les fichiers du modèle sont directement dans `modeles_ct2/<langue>/` |
| « Le port 8765 est déjà utilisé » | Le serveur tourne déjà dans une autre fenêtre |
| Popup : « modèle : aucun (lancez LANCER_SERVEUR.bat) » | Démarrer le serveur, puis retraduire |
| Popup : « Page interne du navigateur » | Les pages `chrome://`, `edge://` et le Web Store ne peuvent pas être traduites |
| Rien ne change après une mise à jour | `chrome://extensions` → bouton ↻ de l'extension, puis F5 sur la page |

---

## 9. Structure du dépôt

```
afro_translate/            Extension (Manifest V3)
├── manifest.json
├── background.js          Relais vers le serveur local, chargement des dictionnaires
├── content.js             Traduction de la page, masquage et garde-fous
├── langues.js             Liste des langues
├── popup.html / popup.js  Interface
├── lib/decoderNnh.js      Décodage de l'écriture ngiemboon
└── memoire/               Dictionnaires validés (JSON)
serveur_traduction/        Serveur local (Python)
├── LANCER_SERVEUR.bat
├── serveur_traduction.py
└── modeles_ct2/           Modèles (non versionnés, voir section 3)
```
