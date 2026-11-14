// Safinum — traduction en langues nationales (Ngiemboon, Bamoun). Ne modifie que le texte affiché : jamais le HTML, les champs de saisie ni les valeurs.
// Ordre : 1) phrase validée (mémoire)  2) alerte de sécurité non validée -> ligne validée + français complet
//         3) modèle local (valeurs remplacées par 9001, 9112…)  4) garde-fous, sinon le français reste.
(() => {
  'use strict';
  if (window.__safinumNnh) return;
  window.__safinumNnh = true;

  let langue = 'nnh';                                               // langue cible choisie dans le popup
  const LG = () => (self.LANGUES || {})[langue] || {};
  const NOMS_CONNUS = ['Amina Ngo Bell', 'Jean-Paul Mbarga', 'Amina'];
  const MOIS = 'janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec';
  const LOT = 8;

  // ---------- 1. Valeurs protégées ----------
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const L = '[\\p{L}\\p{N}]';
  const DEVISE = '(?:\\s?(?:FCFA|XAF|€|EUR|USD|%))?';
  const RE_VAL = new RegExp([
    '\\{[A-Z_]+\\}(?:\\s?FCFA)?',                                   // jetons des phrases de la mémoire
    'https?://\\S+', '[\\w.+-]+@[\\w-]+\\.[\\w.]+',
    '\\b[A-Z]{2,}-\\d{4}-[A-Z0-9]{4,}\\b',                           // référence SAF-2026-XT2M6F
    '\\b[A-Z]+(?:_[A-Z0-9]+)+\\b',                                   // code SECURITY_001
    '\\bCM(?:\\s?\\d){8,}',                                          // numéro de compte
    '\\+\\d{1,3}(?:[\\s.]?\\d){6,14}',                               // téléphone
    `\\b\\d{1,2}\\s(?:${MOIS})[a-zéû]*\\.?\\s\\d{4}\\b`,             // date 05 nov. 2026
    '\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b',
    '\\b\\d{1,2}\\s?[:h]\\s?\\d{2}\\b',                              // heure
    `(?<!${L})(?:[+\\-−]\\s?)?\\d{1,3}(?:[ \\u00a0\\u202f.]\\d{3})+(?:,\\d+)?${DEVISE}`,   // montant signé
    `(?<!${L})(?:[+\\-−]\\s?)?\\d+(?:[.,]\\d+)?${DEVISE}`,
    ...NOMS_CONNUS.sort((a, b) => b.length - a.length).map(n => `(?<!${L})${esc(n)}(?!${L})`),
  ].join('|'), 'gu');
  const RE_NOM = /(?<=[^\s.!?…]\s)(?!(?:FCFA|XAF|EUR|USD)\b)\p{Lu}[\p{L}'’\-]*(?:\s\p{Lu}[\p{L}'’\-]*){0,3}/gu;
  const RE_VAL_NOM = new RegExp(RE_VAL.source + '|' + RE_NOM.source, 'gu');
  const RE_DEVISE_FIN = /\s?(?:FCFA|XAF|€|EUR|USD|%)$/;

  const idItem = raw => raw.startsWith('{') ? raw.replace(/\s?FCFA$/, '')
                                            : raw.replace(/[\s  ]|FCFA/g, '').toLowerCase();
  const inventaire = t => (t.match(RE_VAL) || []).filter(m => !m.startsWith('{')).map(idItem).sort().join('|');
  const cleRecherche = t => t.toLowerCase().replace(/[’`]/g, "'").replace(/[,.;:!?…«»"()]/g, ' ').replace(/\s+/g, ' ').trim();

  // ---------- 2. Mémoire validée par le locuteur ----------
  let MEM = new Map();
  const MEMS = {};                                                  // une mémoire par langue
  function gabarit(texte, avecNoms) {
    const items = [];
    const g = texte.replace(avecNoms ? RE_VAL_NOM : RE_VAL, m => { items.push({ raw: m, id: idItem(m) }); return ' § '; });
    return { cle: cleRecherche(g), items };
  }
  // Accepte {"français": "traduction"}, [["français","traduction"]] ou [{francais:…, traduction:…}]
  function normaliserMemoire(obj) {
    if (!Array.isArray(obj)) return obj || {};
    const out = {};
    const CLES_FR = ['francais', 'français', 'fr', 'source', 'french', 'fra'];
    for (const x of obj) {
      if (Array.isArray(x) && x.length >= 2) { out[x[0]] = x[1]; continue; }
      if (!x || typeof x !== 'object') continue;
      const k = Object.keys(x), kfr = k.find(c => CLES_FR.includes(c.toLowerCase()));
      const ktr = k.find(c => c !== kfr && typeof x[c] === 'string' && !/^(id|categorie|catégorie|contexte|statut|status)$/i.test(c));
      if (kfr && ktr && x[kfr] && x[ktr]) out[x[kfr]] = x[ktr];
    }
    return out;
  }
  function construireMemoire(obj) {
    MEM = new Map();
    for (const [fr, nnh] of Object.entries(normaliserMemoire(obj))) {
      if (typeof fr !== 'string' || typeof nnh !== 'string' || !nnh.trim()) continue;
      const { cle, items } = gabarit(fr, false);
      if (cle && !MEM.has(cle)) MEM.set(cle, { nnh, ids: items.map(i => i.id) });
    }
  }
  function memoire1(texte, avecNoms) {
    const { cle, items } = gabarit(texte, avecNoms);
    const e = MEM.get(cle);
    if (!e || e.ids.length !== items.length) return null;
    const vus = {}; let echec = false;
    const sortie = e.nnh.replace(RE_VAL, m => {
      const id = idItem(m), n = vus[id] = (vus[id] || 0) + 1;
      let k = -1, c = 0;
      for (let i = 0; i < e.ids.length; i++) if (e.ids[i] === id && ++c === n) { k = i; break; }
      if (k < 0) { echec = true; return m; }
      return items[k].raw;
    });
    return echec ? null : sortie;
  }
  const depuisMemoire = t => (reglages.memoire && MEM.size) ? (memoire1(t, false) ?? memoire1(t, true)) : null;

  // ---------- 3. Modèle local ----------
  function masquer(texte) {
    const codes = new Map();
    const code = raw => { if (!codes.has(raw)) codes.set(raw, String(9001 + 111 * codes.size)); return codes.get(raw); };
    const t = texte.replace(RE_VAL, m => {                     // « 25 000 FCFA » -> « 9001 FCFA » (forme apprise)
      const dev = (m.match(RE_DEVISE_FIN) || [''])[0];
      return code(dev ? m.slice(0, -dev.length) : m) + dev;
    }).replace(RE_NOM, m => code(m));
    return { t, codes };
  }
  function sortieSure(entree, sortie, codes) {
    if (!sortie || !sortie.trim()) return false;
    for (const c of codes.values()) {
      if (entree.split(c).length !== sortie.split(c).length) return false;
      // « 9001 FCFA » doit rester collé : le modèle ne doit pas séparer un montant de sa devise
      for (const dev of [' FCFA', 'FCFA', ' XAF', ' €', ' EUR', ' USD', ' %', '%'])
        if (entree.split(c + dev).length !== sortie.split(c + dev).length) return false;
    }
    if ((sortie.match(/9\d{3}/g) || []).some(x => ![...codes.values()].includes(x))) return false;
    const r = sortie.length / Math.max(entree.length, 1);
    if (r < 0.3 || r > 3) return false;
    if (/(\S+)(?:\s+\1){3,}/u.test(sortie)) return false;
    return true;
  }
  const CACHE = new Map();
  let etatModele = null;
  async function modele(phrases) {
    const res = phrases.map(p => CACHE.has(langue + '|' + p) ? CACHE.get(langue + '|' + p) : undefined);
    const aFaire = res.map((r, i) => r === undefined ? i : -1).filter(i => i >= 0);
    for (let k = 0; k < aFaire.length; k += LOT) {
      if (!actif) break;                                         // « Revenir au français » : on arrête tout de suite
      const idx = aFaire.slice(k, k + LOT);
      const prep = idx.map(i => masquer(phrases[i]));
      let r;
      try { r = await chrome.runtime.sendMessage({ type: 'traduire', langue, textes: prep.map(p => p.t) }); }
      catch (e) { r = { ok: false, erreur: String(e) }; }
      if (r?.sansModele) { idx.forEach(i => { res[i] = null; }); continue; }   // langue en mémoire seule
      etatModele = r?.etat || { erreur: r?.erreur };
      if (!r?.ok) { idx.forEach(i => { res[i] = null; }); continue; }
      r.sorties.forEach((s, j) => {
        const brut = LG().translit ? decoderNnh(s) : s;
        let out = null;
        if (sortieSure(prep[j].t, brut, prep[j].codes)) {
          out = brut;
          for (const [raw, c] of prep[j].codes) out = out.split(c).join(raw);
        }
        CACHE.set(langue + '|' + phrases[idx[j]], out); res[idx[j]] = out;
      });
      progression.fait += idx.length;
    }
    return res.map(r => r ?? null);
  }

  // ---------- 4. Repérage des textes ----------
  const ORIG = new WeakMap(), TRAD = new WeakMap(), ATTR = new WeakMap();
  const SAUTER = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE', 'SVG', 'MATH', 'TEMPLATE']);
  const RE_CLASSE_VALEUR = /(^|[-_])(nom|name|montant|amount|ref|reference|numero|phone|tel|iban|valeur|value)([-_]|$)/i;
  const RE_ALERTE_TXT = /fraud|arnaque|escroc|code\s+(pin|secret|confidentiel)|mot de passe|\bOTP\b|ne\s+(communiquez|partagez|donnez|divulguez)\s+jamais|ne cliquez pas|SECURITY_/i;
  let reglages = { memoire: true };
  let actif = false;
  let modeleOK = false;
  let memErreur = null;
  let sourceModele = null;
  const progression = { total: 0, fait: 0, enCours: 0, integriteKO: 0 };

  function aSauter(el, attribut = false) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if ((SAUTER.has(e.tagName) && !(attribut && e === el)) || e.isContentEditable ||
          e.getAttribute('translate') === 'no' || e.classList?.contains('notranslate')) return true;
      if (!(attribut && e === el) && [e.id, ...(e.classList || [])].filter(Boolean).some(x => RE_CLASSE_VALEUR.test(x))) return true;
    }
    return false;
  }
  function estAlerte(el, texte) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.getAttribute?.('role') === 'alert' || e.getAttribute?.('aria-live') === 'assertive') return true;
    }
    return RE_ALERTE_TXT.test(texte);
  }
  // Sigles, initiales et codes de langue (« AN », « EN », « FCFA », « A.N. ») : jamais traduits
  const estSigle = t => /^[\p{Lu}\d][\p{Lu}\d.\-]{0,5}$/u.test(t.trim()) && !/\p{Ll}/u.test(t);
  const aTraduire = t => /\p{L}{2,}/u.test(t.replace(RE_VAL, ' ')) && !estSigle(t);
  const ressembleNom = t => /^\p{Lu}[\p{L}'’\-]*(?:\s\p{Lu}[\p{L}'’\-]*){1,3}$/u.test(t.trim()) && !depuisMemoire(t.trim());
  const decouper = t => t.split(/(?<=[.!?])\s+(?=\S)/u);

  // Traduit une liste de textes ; renvoie pour chacun la traduction ou null (= on garde le français)
  async function traduireTextes(textes, alertes) {
    const plan = textes.map((t, i) => {
      const m = depuisMemoire(t);
      if (m) return { final: m };
      if (alertes[i]) return { final: LG().alerte ? `${LG().alerte} ${t}` : null };   // alerte non validée : jamais le modèle seul
      const morceaux = decouper(t);
      return { morceaux, mem: morceaux.map(depuisMemoire) };
    });
    const aEnvoyer = [];
    plan.forEach(p => p.morceaux?.forEach((m, j) => { if (!p.mem[j]) aEnvoyer.push(m); }));
    if (!LG().modele || !modeleOK) aEnvoyer.length = 0;                         // pas de modèle : le texte inconnu reste en français
    progression.total += aEnvoyer.filter(p => !CACHE.has(langue + '|' + p)).length;
    const sorties = aEnvoyer.length ? await modele(aEnvoyer) : [];
    let k = 0;
    return plan.map(p => {
      if ('final' in p) return p.final;
      const parts = p.morceaux.map((m, j) => p.mem[j] || sorties[k++] || null);
      return parts.every(x => !x) ? null : parts.map((x, j) => x || p.morceaux[j]).join(' ');
    });
  }

  function collecter(racine) {
    const noeuds = [];
    if (racine.nodeType === Node.TEXT_NODE) noeuds.push(racine);
    else { const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT); while (w.nextNode()) noeuds.push(w.currentNode); }
    const textes = noeuds.filter(n => n.parentElement && !aSauter(n.parentElement) && TRAD.get(n) !== n.data &&
                                      aTraduire(n.data) && !ressembleNom(n.data));
    const attrs = [];
    if (racine.querySelectorAll) {
      for (const el of [racine, ...racine.querySelectorAll('[placeholder],[aria-label],[title],[alt],input[type=submit],input[type=button]')]) {
        if (!el.getAttribute || aSauter(el, true)) continue;
        const noms = ['placeholder', 'aria-label', 'title', 'alt'];
        if (el.tagName === 'INPUT' && /^(submit|button)$/i.test(el.type)) noms.push('value');
        for (const a of noms) {
          const v = el.getAttribute(a);
          if (v && aTraduire(v) && ATTR.get(el)?.[a]?.trad !== v) attrs.push({ el, a, v });
        }
      }
    }
    return { textes, attrs };
  }

  // Le modèle ne traite que ce qui est à l'écran (ou presque) ; le reste attend qu'on fasse défiler.
  // Les phrases validées et les alertes, instantanées, sont traitées partout tout de suite.
  let ATTENTE = new WeakSet();
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(entrees => {
    for (const e of entrees) if (e.isIntersecting) { io.unobserve(e.target); ATTENTE.delete(e.target); if (actif) traduireRacine(e.target, false); }
  }, { rootMargin: '600px 0px' }) : null;
  function visible(el) {
    if (!io) return true;
    const r = el.getBoundingClientRect();
    return (r.width || r.height) && r.bottom >= -300 && r.top <= innerHeight + 600;
  }
  function differer(liste) {
    const garder = [];
    for (const n of liste) {
      const el = n.parentElement;
      if (depuisMemoire(n.data.trim()) || estAlerte(el, n.data) || visible(el)) garder.push(n);
      else if (!ATTENTE.has(el)) { ATTENTE.add(el); io.observe(el); }
    }
    return garder;
  }

  async function traduireRacine(racine, paresseux = true) {
    let { textes, attrs } = collecter(racine);
    if (paresseux) textes = differer(textes);
    if (!textes.length && !attrs.length) return;
    progression.enCours++;
    try {
      const sources = [...textes.map(n => n.data.trim()), ...attrs.map(x => x.v.trim())];
      const alertes = [...textes.map(n => estAlerte(n.parentElement, n.data)), ...attrs.map(() => false)];
      const origs = textes.map(n => n.data);
      const outs = await traduireTextes(sources, alertes);
      if (!actif) return;
      textes.forEach((n, i) => {
        const orig = origs[i], t = outs[i];
        if (!t || n.data !== orig) return;                         // rien à mettre, ou la page a changé entre-temps
        const nouveau = orig.match(/^\s*/)[0] + t + orig.match(/\s*$/)[0];
        if (inventaire(orig) !== inventaire(nouveau)) { progression.integriteKO++; return; }   // valeur touchée : français
        ORIG.set(n, orig); TRAD.set(n, nouveau); n.data = nouveau;
      });
      attrs.forEach(({ el, a, v }, j) => {
        const t = outs[textes.length + j];
        if (!t || el.getAttribute(a) !== v || inventaire(v) !== inventaire(t)) return;
        const d = ATTR.get(el) || {}; d[a] = { orig: v, trad: t }; ATTR.set(el, d); el.setAttribute(a, t);
      });
    } finally { progression.enCours--; }
  }

  function revenirAuFrancais() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode, o = ORIG.get(n);
      if (o !== undefined && TRAD.get(n) === n.data) { n.data = o; TRAD.delete(n); }
    }
    document.querySelectorAll('[placeholder],[aria-label],[title],[alt],input[type=submit],input[type=button]').forEach(el => {
      const d = ATTR.get(el);
      if (d) { for (const [a, { orig, trad }] of Object.entries(d)) if (el.getAttribute(a) === trad) el.setAttribute(a, orig); ATTR.delete(el); }
    });
  }

  // ---------- 5. Contenu injecté ou modifié par la page ----------
  const enAttente = new Set();
  let minuteur = null;
  const obs = new MutationObserver(muts => {
    if (!actif) return;
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(x => enAttente.add(x));
      else if (m.type === 'characterData') { if (TRAD.get(m.target) !== m.target.data) enAttente.add(m.target); }
      else if (ATTR.get(m.target)?.[m.attributeName]?.trad !== m.target.getAttribute(m.attributeName)) enAttente.add(m.target);
    }
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      const lot = [...enAttente].filter(x => x.isConnected); enAttente.clear();
      for (const x of lot) await traduireRacine(x);
    }, 150);
  });

  async function chargerMemoire() {
    if (!MEMS[langue]) {
      memErreur = null;
      try {
        const r = await chrome.runtime.sendMessage({ type: 'memoire', langue });
        if (r?.ok) { construireMemoire(r.memoire); MEMS[langue] = MEM; } else memErreur = r?.erreur || 'mémoire illisible';
      } catch (e) { memErreur = String(e); }
    }
    MEM = MEMS[langue] || new Map();
  }
  async function activer(nouvelle) {
    if (nouvelle && nouvelle !== langue) { if (actif) desactiver(); langue = nouvelle; }
    if (actif) return;
    actif = true; etatModele = null;
    Object.assign(progression, { total: 0, fait: 0, integriteKO: 0 });
    reglages = { ...reglages, ...(await chrome.storage.local.get({ memoire: true })) };
    await chargerMemoire();
    modeleOK = false; sourceModele = null;
    if (LG().modele) {
      const rp = await chrome.runtime.sendMessage({ type: 'modele-present', langue }).catch(() => null);
      modeleOK = !!rp?.ok; sourceModele = rp?.source || null;
      if (modeleOK) chrome.runtime.sendMessage({ type: 'charger-modele', langue }).then(r => { etatModele = r?.etat; }).catch(() => {});
    }
    obs.observe(document.body, { childList: true, subtree: true, characterData: true,
                                  attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt', 'value'] });
    await traduireRacine(document.body);
  }
  function desactiver() { actif = false; obs.disconnect(); io?.disconnect(); ATTENTE = new WeakSet(); revenirAuFrancais(); }

  // ---------- 6. Commandes du popup ----------
  window.__nnhTraduire = (lg) => { activer(lg); return true; };
  window.__nnhFrancais = () => { desactiver(); return true; };
  window.__nnhEtat = () => ({ actif, langue, nomLangue: LG().nom, sansModele: !LG().modele || !modeleOK, enCours: progression.enCours > 0, total: progression.total, fait: progression.fait,
                              integriteKO: progression.integriteKO, erreur: etatModele?.erreur || null,
                              memTaille: MEM.size, memErreur, source: modeleOK ? sourceModele : null });
  chrome.storage.local.get({ toujours: false, langueToujours: 'nnh' }).then(s => { if (s.toujours) activer(s.langueToujours); });
  window.__nnhTest = { masquer, sortieSure, inventaire, construireMemoire, depuisMemoire };
})();
