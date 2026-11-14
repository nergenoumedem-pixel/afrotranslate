// Langues de l'extension. Pour ajouter une langue : sa mémoire dans memoire/, son modèle dans serveur_traduction/modeles_ct2/<dossier>/.
// Serveur arrêté ou modèle absent -> mémoire seule (le texte inconnu reste en français)
// alerte: null  -> une alerte de sécurité non validée reste entièrement en français
// serveur: true -> la traduction automatique passe par le serveur local (serveur_traduction.py, 127.0.0.1)
self.SERVEUR_LOCAL = 'http://127.0.0.1:8765';
self.LANGUES = {
  ewo: {
    nom: 'Ewondo',
    memoire: 'memoire/ewondo.json',      // dictionnaire AfroLuo (96 validées + 44 à confirmer)
    modele: 'ewondo',                    // MarianMT AfroLuo 
    translit: false,                     // à mettre à true seulement si translit.json du modèle dit "TRANSLIT": true
    options: {},
    serveur: true,                       // modèle compressé CTranslate2 (serveur local)
    alerte: null                         // aucune phrase d'alerte validée : une alerte non validée reste en français
  },
  nnh: {
    nom: 'Ngiemboon',
    memoire: 'memoire/ngiemboon.json',
    modele: 'ngiemboon',                 // MarianMT ONNX, lu par le serveur local
    serveur: true,
    translit: true,                      // sortie du modèle à décoder (q-codes)
    options: {},
    alerte: "ńkága tuŋó ḿbɔ́ɔnte : ńtóŋ nò na felaŋsée."
  },
  bax: {
    nom: 'Bamoun',
    memoire: 'memoire/bamoun.json',
    modele: 'bamoun',                    // NLLB réentraîné 
    translit: false,
    options: { src_lang: 'fra_Latn', tgt_lang: 'bax_Latn' },      // codes de langue du tokenizer NLLB
    serveur: true,                       // modèle compressé CTranslate2 (serveur local)
    alerte: null                         // aucune phrase d'alerte validée en bamoun pour l'instant
  },
  dua: {
    nom: 'Douala',
    memoire: 'memoire/douala.json',      // dictionnaire Douala {"français": "douala"} (vide tant qu'il n'est pas fourni)
    modele: 'douala',                    // pas d'ONNX : le modèle tourne sur le serveur local (modeles_ct2/douala/)
    translit: false,
    options: {},
    serveur: true,
    alerte: null                         // aucune phrase d'alerte validée en douala : une alerte reste en français
  }
};
