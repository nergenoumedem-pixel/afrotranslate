# -*- coding: utf-8 -*-
"""Traduit du français vers l'ewondo avec le modèle compressé (CTranslate2, int8). Fonctionne sur un ordinateur ordinaire, sans carte graphique.
   pip install ctranslate2 sentencepiece transformers
   python traduire_local.py "Solde disponible" "Confirmer le transfert"
   Les sorties sont des propositions : elles doivent être relues par un locuteur natif avant d'entrer dans le dictionnaire de l'extension."""
import sys, os, ctranslate2, transformers
DOSSIER = os.path.join(os.path.dirname(__file__), "modele_compresse")
tok = transformers.AutoTokenizer.from_pretrained(DOSSIER)
tr = ctranslate2.Translator(DOSSIER, device="cpu")
for texte in sys.argv[1:] or ["Solde disponible"]:
    src = tok.convert_ids_to_tokens(tok.encode(texte))
    hyp = tr.translate_batch([src], beam_size=5)[0].hypotheses[0]
    print(texte, "=>", tok.decode(tok.convert_tokens_to_ids(hyp), skip_special_tokens=True))
