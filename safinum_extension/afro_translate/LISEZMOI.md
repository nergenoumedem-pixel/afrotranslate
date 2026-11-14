# Safinum — Traduction en langues nationales (v3.0.0)

Langues : Ngiemboon · Ewondo · Bamoun · Douala.
L'extension est légère : la traduction automatique est faite par un **serveur local** (`serveur_traduction`, sur 127.0.0.1).
Aucune donnée ne quitte l'ordinateur. Si le serveur est arrêté, seules les phrases validées des dictionnaires sont traduites.

## Installation
1. Lancer le serveur : `serveur_traduction\LANCER_SERVEUR.bat` (Python 3.10+ requis). Laisser la fenêtre ouverte.
2. chrome://extensions (ou edge://extensions) -> Mode développeur -> « Charger l'extension non empaquetée » -> ce dossier.
3. Popup : choisir la langue -> « Traduire en … » ; « Retour au français » rétablit la page.
   La ligne grise du popup indique le dictionnaire et le modèle utilisés.

## Dictionnaires (memoire/)
Format : {"phrase en français": "traduction"}. Toujours prioritaires sur le modèle.
