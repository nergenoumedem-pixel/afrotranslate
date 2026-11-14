# -*- coding: utf-8 -*-
"""
Serveur de traduction LOCAL pour l'extension Safinum (modèles CTranslate2 : config.json + model.bin + shared_vocabulary.json).

- Écoute uniquement sur 127.0.0.1 (rien ne sort de l'ordinateur).
- Ne journalise, ne stocke et ne transmet aucun texte.
- Aucune conversion ONNX : le model.bin est lu tel quel, il n'entre jamais dans l'extension.

Dossiers attendus (à côté de ce fichier) :
    modeles_ct2/ewondo/   config.json  model.bin  shared_vocabulary.json  [source.spm facultatif]
    modeles_ct2/bamoun/   soit config.json model.bin shared_vocabulary.json (CTranslate2)
                          soit les 5 fichiers Hugging Face : config.json generation_config.json model.safetensors
                               tokenizer.json tokenizer_config.json  (lus tels quels, il faut torch + transformers)
Un dossier absent = langue ignorée.

Lancement : python serveur_traduction.py   (ou double-clic sur LANCER_SERVEUR.bat)
"""
import json, os, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8765
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.join(ICI, "modeles_ct2")

# code langue de l'extension -> dossier + codes NLLB (seulement pour un modèle NLLB)
LANGUES = {
    "ewo": {"dossier": "ewondo"},
    "bax": {"dossier": "bamoun", "src": "fra_Latn", "tgt": "bax_Latn"},
    "nnh": {"dossier": "ngiemboon"},
    "dua": {"dossier": "douala", "src": "fra_Latn", "tgt": "dua_Latn"},
}
TEST = "Ne communiquez jamais votre code secret."

try:
    import ctranslate2
except ImportError:
    sys.exit("Il manque ctranslate2 : lancez   python -m pip install ctranslate2 sentencepiece")
try:
    import sentencepiece as spm
except ImportError:
    spm = None


class Moteur:
    def __init__(self, code, conf):
        self.code, self.conf = code, conf
        d = os.path.join(RACINE, conf["dossier"])
        self.dossier = d
        vocab = json.load(open(os.path.join(d, "shared_vocabulary.json"), encoding="utf-8"))
        if isinstance(vocab, dict):                      # certains convertisseurs écrivent {token: id}
            vocab = sorted(vocab, key=vocab.get)
        self.vocab = set(vocab)
        self.nllb = "fra_Latn" in self.vocab
        if self.nllb:
            self.src, self.tgt = conf.get("src", "fra_Latn"), conf.get("tgt", "bax_Latn")
            f = os.path.join(d, "code_cible.txt")                 # facultatif : code de langue cible écrit à la main
            if os.path.exists(f):
                self.tgt = open(f, encoding="utf-8").read().strip() or self.tgt
            if self.tgt not in self.vocab:                         # sinon : un code qui commence comme le code attendu
                pref = self.tgt.split("_")[0] + "_"
                cands = [t for t in vocab if t.startswith(pref) and len(t) <= 12]
                if cands:
                    self.tgt = cands[0]
            if self.tgt not in self.vocab:
                import re
                codes = [t for t in vocab if re.fullmatch(r"[a-z]{3}_[A-Z][a-z]{3}", t)]
                ajoute = codes[-1] if codes and codes[-1] != "zul_Latn" else None   # code ajouté à l'entraînement = le dernier
                if not ajoute:
                    raise RuntimeError(f"code cible {self.tgt} absent du vocabulaire. Derniers codes : {codes[-5:]}"
                                       " -> corrigez 'tgt' dans LANGUES en haut du fichier.")
                print(f"      (code {self.tgt} absent : j'utilise le code ajouté au modèle, {ajoute})")
                self.tgt = ajoute
        self.sp = None
        if spm:
            for nom in ("source.spm", "sentencepiece.bpe.model", "spm.model", "sentencepiece.model"):
                p = os.path.join(d, nom)
                if os.path.exists(p):
                    self.sp = spm.SentencePieceProcessor(model_file=p)
                    break
        self.mode_tok = "sentencepiece" if self.sp else "vocabulaire (sans fichier .spm)"
        cpu = max(1, (os.cpu_count() or 2) - 1)
        try:
            self.tr = ctranslate2.Translator(d, device="cpu", compute_type="int8", intra_threads=cpu)
        except Exception:
            self.tr = ctranslate2.Translator(d, device="cpu", intra_threads=cpu)
        self.verrou = threading.Lock()

    def morceaux(self, texte):
        if self.sp:
            p = self.sp.encode(texte, out_type=str)
        else:                                            # découpage par plus long morceau connu du vocabulaire
            p = []
            for mot in texte.split():
                s, i = "▁" + mot, 0
                while i < len(s):
                    for j in range(len(s), i, -1):
                        if s[i:j] in self.vocab:
                            p.append(s[i:j]); i = j; break
                    else:
                        p.append("<unk>"); i += 1
        p = p[:250]
        return ([self.src] + p + ["</s>"]) if self.nllb else (p + ["</s>"])

    def traduire(self, textes):
        src = [self.morceaux(t) for t in textes]
        kw = dict(beam_size=2, max_decoding_length=200, repetition_penalty=1.1, max_batch_size=16)
        if self.nllb:
            kw["target_prefix"] = [[self.tgt]] * len(src)
        with self.verrou:
            res = self.tr.translate_batch(src, **kw)
        out = []
        for r in res:
            h = [t for t in r.hypotheses[0] if t not in ("</s>", "<s>", "<pad>", "<unk>")]
            if self.nllb and h and h[0] == self.tgt:
                h = h[1:]
            out.append("".join(h).replace("▁", " ").strip())
        return out


class MoteurHF:
    """Modèle Hugging Face tel quel (model.safetensors + fichiers du tokenizer) : Marian ou NLLB. Aucune conversion."""
    def __init__(self, code, conf):
        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        except ImportError:
            raise RuntimeError("modèle model.safetensors : il faut torch et transformers. Relancez LANCER_SERVEUR.bat "
                               "(il les installe) ou : python -m pip install torch transformers sentencepiece")
        d = os.path.join(RACINE, conf["dossier"])
        self.torch = torch
        torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))
        type_modele = json.load(open(os.path.join(d, "config.json"), encoding="utf-8")).get("model_type", "")
        self.nllb = type_modele in ("m2m_100", "nllb", "nllb-moe")
        self.bos = None
        if self.nllb:
            self.src, self.tgt = conf.get("src", "fra_Latn"), conf.get("tgt", "bax_Latn")
            f = os.path.join(d, "code_cible.txt")
            if os.path.exists(f):
                self.tgt = open(f, encoding="utf-8").read().strip() or self.tgt
            self.tok = AutoTokenizer.from_pretrained(d, src_lang=self.src)
            self.bos = self.tok.convert_tokens_to_ids(self.tgt)
            if self.bos is None or self.bos == self.tok.unk_token_id:
                raise RuntimeError(f"code cible {self.tgt} inconnu du tokenizer -> écrivez le bon code dans code_cible.txt")
        else:
            self.tok = AutoTokenizer.from_pretrained(d)
        self.mod = AutoModelForSeq2SeqLM.from_pretrained(d, torch_dtype=torch.float32, low_cpu_mem_usage=True).eval()
        try:                                             # int8 dynamique : plus rapide, moitié moins de mémoire
            self.mod = torch.quantization.quantize_dynamic(self.mod, {torch.nn.Linear}, dtype=torch.qint8)
            self.mode_tok = f"{type_modele}, safetensors, int8"
        except Exception:
            self.mode_tok = f"{type_modele}, safetensors, float32"
        self.verrou = threading.Lock()

    def traduire(self, textes):
        out = []
        kw = dict(num_beams=2, max_new_tokens=200, repetition_penalty=1.1)
        if self.bos is not None:
            kw["forced_bos_token_id"] = self.bos
        with self.verrou, self.torch.inference_mode():
            for k in range(0, len(textes), 8):
                x = self.tok(textes[k:k + 8], return_tensors="pt", padding=True, truncation=True, max_length=256)
                y = self.mod.generate(**x, **kw)
                out += [t.strip() for t in self.tok.batch_decode(y, skip_special_tokens=True)]
        return out


class Unigram:
    """Découpage identique à transformers.js pour un tokenizer.json de type Unigram (Marian, Xenova)."""
    def __init__(self, chemin):
        import unicodedata
        self.nfkc = lambda t: unicodedata.normalize("NFKC", t)
        tj = json.load(open(chemin, encoding="utf-8"))
        m = tj["model"]
        if m.get("type") != "Unigram":
            raise RuntimeError("tokenizer.json n'est pas de type Unigram")
        self.pieces = [p for p, _ in m["vocab"]]
        self.scores = {p: sc for p, sc in m["vocab"]}
        self.ids = {p: i for i, p in enumerate(self.pieces)}
        self.unk = m.get("unk_id", 1) or 0
        self.min = min(self.scores.values()) - 10.0
        self.lmax = max(len(p) for p in self.pieces)
        for a in tj.get("added_tokens", []):
            self.ids.setdefault(a["content"], a["id"])

    def _mot(self, w):
        n = len(w)
        best = [(-1e18, -1, None)] * (n + 1)
        best[0] = (0.0, -1, None)
        for i in range(n):
            if best[i][0] <= -1e17:
                continue
            trouve = False
            for j in range(i + 1, min(n, i + self.lmax) + 1):
                p = w[i:j]
                sc = self.scores.get(p)
                if sc is not None:
                    trouve = True
                    v = best[i][0] + sc
                    if v > best[j][0]:
                        best[j] = (v, i, p)
            if not trouve or best[i + 1][0] <= -1e17:
                v = best[i][0] + self.min
                if v > best[i + 1][0]:
                    best[i + 1] = (v, i, None)
        out, j = [], n
        while j > 0:
            _, i, p = best[j]
            out.append(self.ids[p] if p is not None else self.unk)
            j = i
        return out[::-1]

    def encoder(self, texte):
        t = " ".join(self.nfkc(texte).split())
        ids = []
        for mot in t.split(" "):
            if mot:
                ids += self._mot("▁" + mot)
        return ids

    def decoder(self, ids, speciaux):
        return "".join(self.pieces[i] for i in ids if i not in speciaux and i < len(self.pieces)).replace("▁", " ").strip()


class TokHF:
    """tokenizer.json lu par la bibliothèque tokenizers (BPE NLLB, etc.)."""
    def __init__(self, chemin):
        from tokenizers import Tokenizer
        self.t = Tokenizer.from_file(chemin)
    def encoder(self, texte):
        return self.t.encode(texte, add_special_tokens=False).ids
    def id(self, jeton):
        return self.t.token_to_id(jeton)
    def decoder(self, ids, speciaux):
        return "".join(self.t.id_to_token(i) or "" for i in ids if i not in speciaux).replace("▁", " ").strip()


class MoteurONNX:
    """Modèle Marian ou NLLB exporté en ONNX (dossier onnx/) lu avec onnxruntime. Aucune conversion."""
    def __init__(self, code, conf):
        try:
            import numpy as np
            import onnxruntime as ort
        except ImportError:
            raise RuntimeError("modèle ONNX : il faut onnxruntime. Relancez LANCER_SERVEUR.bat (il l'installe) "
                               "ou : python -m pip install onnxruntime tokenizers")
        self.np = np
        d = os.path.join(RACINE, conf["dossier"])
        def trouver(*noms):
            for n in noms:
                for base in (os.path.join(d, "onnx"), d):
                    if os.path.exists(os.path.join(base, n)):
                        return os.path.join(base, n)
            return None
        enc = trouver("encoder_model_quantized.onnx", "encoder_model_int8.onnx", "encoder_model.onnx")
        dec = trouver("decoder_model_quantized.onnx", "decoder_model_int8.onnx", "decoder_model.onnx",
                      "decoder_model_merged_quantized.onnx", "decoder_model_merged.onnx")
        if not enc or not dec:
            raise RuntimeError("il faut onnx/encoder_model*.onnx et onnx/decoder_model*.onnx")
        cfg = json.load(open(os.path.join(d, "config.json"), encoding="utf-8"))
        self.type = cfg.get("model_type", "marian")
        self.nllb = self.type in ("m2m_100", "nllb")
        self.pad = cfg.get("pad_token_id", 59513 if not self.nllb else 1)
        self.eos = cfg.get("eos_token_id", 0 if not self.nllb else 2)
        self.start = cfg.get("decoder_start_token_id", self.pad if not self.nllb else self.eos)
        tj = os.path.join(d, "tokenizer.json")
        self.tok = None
        if not self.nllb:
            try:
                self.tok = Unigram(tj)
            except Exception:
                self.tok = None
        if self.tok is None:
            try:
                self.tok = TokHF(tj)
            except BaseException as e:
                raise RuntimeError(f"tokenizer.json illisible ({str(e)[:80]}) : python -m pip install tokenizers")
        self.prefixe, self.debut = [], [self.start]
        if self.nllb:
            src = conf.get("src", "fra_Latn")
            tgt = conf.get("tgt", "")
            f = os.path.join(d, "code_cible.txt")
            if os.path.exists(f):
                tgt = open(f, encoding="utf-8").read().strip() or tgt
            idt = self.tok.id(tgt) if tgt else None
            if idt is None:                                 # code inconnu : chercher un code qui commence pareil
                pref = (tgt or "x_").split("_")[0] + "_"
                vocab = self.tok.t.get_vocab()
                c = sorted(k for k in vocab if k.startswith(pref) and len(k) <= 12)
                if c:
                    tgt, idt = c[0], vocab[c[0]]
            ids = self.tok.id(src)
            if idt is None or ids is None:
                raise RuntimeError(f"code de langue introuvable (source {src}, cible {tgt or '?'}) : "
                                   "écrivez le code cible dans code_cible.txt")
            self.prefixe, self.debut, self.tgt = [ids], [self.start, idt], tgt
        o = ort.SessionOptions()
        o.intra_op_num_threads = max(1, (os.cpu_count() or 2) - 1)
        o.log_severity_level = 3
        self.enc = ort.InferenceSession(enc, o, providers=["CPUExecutionProvider"])
        self.dec = ort.InferenceSession(dec, o, providers=["CPUExecutionProvider"])
        self.e_in = [i.name for i in self.enc.get_inputs()]
        self.d_inputs = self.dec.get_inputs()
        self.mode_tok = f"ONNX {self.type} ({os.path.basename(dec)})"
        self.verrou = threading.Lock()

    def _vides(self, B):
        """Entrées « past » factices pour un décodeur fusionné utilisé sans cache."""
        np, f = self.np, {}
        for i in self.d_inputs:
            if i.name == "use_cache_branch":
                f[i.name] = np.array([False])
            elif i.name.startswith("past_key_values"):
                dims = [B if k == 0 else (d if isinstance(d, int) else 1) for k, d in enumerate(i.shape)]
                f[i.name] = np.zeros(dims, dtype=np.float16 if "float16" in i.type else np.float32)
        return f

    def traduire(self, textes):
        np = self.np
        out = []
        noms = {i.name for i in self.d_inputs}
        with self.verrou:
            for k in range(0, len(textes), 8):
                lot = [self.prefixe + self.tok.encoder(t)[:250] + [self.eos] for t in textes[k:k + 8]]
                B, L = len(lot), max(len(x) for x in lot)
                ids = np.full((B, L), self.pad, dtype=np.int64)
                att = np.zeros((B, L), dtype=np.int64)
                for i, x in enumerate(lot):
                    ids[i, :len(x)] = x; att[i, :len(x)] = 1
                fe = {"input_ids": ids, "attention_mask": att}
                h = self.enc.run(None, {n: fe[n] for n in self.e_in if n in fe})[0]
                gen = np.array([self.debut] * B, dtype=np.int64)
                fini = np.zeros(B, dtype=bool)
                vides = self._vides(B)
                for _ in range(min(200, 2 * L + 20)):
                    fd = {"input_ids": gen, "encoder_attention_mask": att, "encoder_hidden_states": h, **vides}
                    logits = self.dec.run(None, {n: fd[n] for n in noms if n in fd})[0][:, -1, :].astype(np.float32)
                    logits[:, self.pad] = -1e9
                    nxt = logits.argmax(-1)
                    nxt[fini] = self.pad
                    gen = np.concatenate([gen, nxt[:, None]], axis=1)
                    fini |= nxt == self.eos
                    if fini.all():
                        break
                sp = {self.pad, self.eos, self.start} | set(self.debut) | set(self.prefixe)
                for row in gen[:, len(self.debut):]:
                    r = [int(v) for v in row]
                    if self.eos in r:
                        r = r[:r.index(self.eos)]
                    out.append(self.tok.decoder(r, sp))
        return out


MOTEURS = {}


def charger():
    if not os.path.isdir(RACINE):
        os.makedirs(RACINE)
    for code, conf in LANGUES.items():
        d = os.path.join(RACINE, conf["dossier"])
        ct2 = os.path.exists(os.path.join(d, "model.bin")) and os.path.exists(os.path.join(d, "shared_vocabulary.json"))
        hf = any(os.path.exists(os.path.join(d, f)) for f in ("model.safetensors", "pytorch_model.bin"))
        onnx = any(os.path.exists(os.path.join(d, b, f)) for b in ("onnx", "") for f in ("encoder_model_quantized.onnx", "encoder_model_int8.onnx", "encoder_model.onnx"))
        if not ct2 and not hf and not onnx:
            print(f"  - {conf['dossier']:<10} : aucun modèle -> langue ignorée")
            continue
        t0 = time.time()
        genre = "CTranslate2" if ct2 else "ONNX" if onnx else "Hugging Face, peut prendre 1 à 2 min"
        print(f"  … {conf['dossier']:<10} chargement ({genre})")
        try:
            m = Moteur(code, conf) if ct2 else MoteurONNX(code, conf) if onnx else MoteurHF(code, conf)
            essai = m.traduire([TEST])[0]
            MOTEURS[code] = m
            print(f"  ✓ {conf['dossier']:<10} chargé en {time.time()-t0:.0f} s  ({'NLLB' if m.nllb else 'Marian'}, {m.mode_tok})")
            print(f"      essai : « {TEST} » -> « {essai} »")
        except Exception as e:
            print(f"  ✗ {conf['dossier']:<10} : {e}")


class Gestion(BaseHTTPRequestHandler):
    def log_message(self, *a):                           # aucun texte n'est journalisé
        pass

    def entetes(self, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def envoyer(self, obj, code=200):
        self.entetes(code)
        self.wfile.write(json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.entetes(204)

    def do_GET(self):
        if self.path.startswith("/etat"):
            return self.envoyer({"ok": True, "langues": {c: {"nllb": m.nllb} for c, m in MOTEURS.items()}})
        self.envoyer({"ok": False, "erreur": "inconnu"}, 404)

    def do_POST(self):
        if not self.path.startswith("/traduire"):
            return self.envoyer({"ok": False, "erreur": "inconnu"}, 404)
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n).decode("utf-8"))
            m = MOTEURS.get(req.get("langue"))
            if not m:
                return self.envoyer({"ok": False, "sansModele": True})
            textes = [str(t)[:2000] for t in req.get("textes", [])][:64]
            self.envoyer({"ok": True, "sorties": m.traduire(textes)})
        except Exception as e:
            self.envoyer({"ok": False, "erreur": str(e)[:300]}, 500)


if __name__ == "__main__":
    print("Safinum — serveur de traduction local (127.0.0.1 uniquement)")
    charger()
    if not MOTEURS:
        print("\nAucun modèle chargé. Mettez config.json + model.bin + shared_vocabulary.json dans modeles_ct2/<langue>/")
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Gestion)
    except OSError:
        sys.exit(f"Le port {PORT} est déjà utilisé : le serveur tourne sans doute déjà dans une autre fenêtre.")
    print(f"\nPrêt : http://127.0.0.1:{PORT}  — laissez cette fenêtre ouverte pendant la démo (Ctrl+C pour arrêter).")
    srv.serve_forever()
