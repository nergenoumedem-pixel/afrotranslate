# -*- coding: utf-8 -*-
"""xlsx SAFINUM -> extensions/afroluo-ewondo/dictionaries/<langue>.json
 python build_dictionary.py fichier.xlsx --langue ewondo   (colonne du fichier = nom dans languages.json)
 python build_dictionary.py fichier.xlsx            -> uniquement les lignes Statut = "Validé"
 python build_dictionary.py fichier.xlsx --a_confirmer -> + lignes remplies non validées (marquées 'a_confirmer', soulignées dans l'extension)"""
import sys, re, json, openpyxl
f = sys.argv[1]; inclure = "--a_confirmer" in sys.argv
langue = sys.argv[sys.argv.index("--langue") + 1] if "--langue" in sys.argv else "ewondo"
L = next(x for x in json.load(open("extensions/afroluo-ewondo/languages.json", encoding="utf-8")) if x["code"] == langue)
ws = openpyxl.load_workbook(f)["Phrases"]; H = {c.value: c.column for c in ws[1]}
if L["column"] not in H:
    sys.exit(f"Colonne « {L['column']} » introuvable dans le fichier. Colonnes présentes : {[k for k in H if k]}")
V = re.compile(r"\{\w+\}"); out = []; rej = 0
for r in range(2, ws.max_row + 1):
    fr = ws.cell(r, H["Français (variables entre {accolades})"]).value; ew = ws.cell(r, H[L["column"]]).value
    st = str(ws.cell(r, H["Statut"]).value or "")
    if not fr or not ew: continue
    ok = st == "Validé"
    if not ok and not inclure: continue
    if sorted(V.findall(fr)) != sorted(V.findall(ew)): rej += 1; continue      # variable perdue -> rejet
    out.append({"fr": fr, "tr": ew, "status": "valide" if ok else "a_confirmer"})
json.dump({"lang": langue, "entries": out}, open(f"extensions/afroluo-ewondo/dictionaries/{langue}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "entrées écrites,", rej, "rejetées (variables perdues)")
