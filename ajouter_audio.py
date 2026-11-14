# -*- coding: utf-8 -*-
"""Relie les fichiers audio (extensions/afroluo-ewondo/audio/ewondo/NNN.ext) aux entrées du dictionnaire.
   python ajouter_audio.py enregistrements_audio.xlsx [--langue ewondo]"""
import sys, os, json, openpyxl
f = sys.argv[1]; langue = sys.argv[sys.argv.index("--langue") + 1] if "--langue" in sys.argv else "ewondo"
dossier = f"extensions/afroluo-ewondo/audio/{langue}"; dico = f"extensions/afroluo-ewondo/dictionaries/{langue}.json"
D = json.load(open(dico, encoding="utf-8")); par_fr = {e["fr"].lower(): e for e in D["entries"]}
ws = openpyxl.load_workbook(f)["Audio"]; n = 0
for r in ws.iter_rows(min_row=2, values_only=True):
    num, fr = str(r[0]).zfill(3), r[1]
    for ext in ("mp3", "wav", "ogg", "m4a"):
        if os.path.exists(f"{dossier}/{num}.{ext}") and fr and fr.lower() in par_fr:
            par_fr[fr.lower()]["audio"] = f"audio/{langue}/{num}.{ext}"; n += 1; break
json.dump(D, open(dico, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(n, "audios reliés au dictionnaire", langue)
