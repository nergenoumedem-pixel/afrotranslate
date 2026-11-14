// AfroLuo – adaptation linguistique d'une interface existante, sans modifier son code source.
// Règles de sécurité : (1) un texte n'est remplacé que si TOUTES ses variables/chiffres sont conservés ;
// (2) sinon le français d'origine reste affiché ; (3) tout texte non validé est signalé.
(async () => {
  const api = (typeof chrome !== "undefined" && chrome.runtime) ? chrome : null;
  const cfg = api ? await api.storage.sync.get({ enabled: true, useDrafts: true, apiUrl: "", lang: "ewondo", bilingual: true, mtOnly: false, critiques: true, showButton: false, underline: false, alwaysFr: true, audio: true })
                  : { enabled: true, useDrafts: true, apiUrl: "", lang: "ewondo", bilingual: true, mtOnly: false, critiques: true, showButton: false, underline: false, alwaysFr: true, audio: true };
  let dict = { entries: [] };
  let L = { name: cfg.lang, mt: "" };
  try { L = (await (await fetch(api.runtime.getURL("languages.json"))).json()).find(x => x.code === cfg.lang) || L; } catch (e) {}
  try { dict = await (await fetch(api.runtime.getURL("dictionaries/" + cfg.lang + ".json"))).json(); } catch (e) {}

  // ---- Mémoire de traduction : conservée entre les pages ET entre les sites (chrome.storage.local) ----
  const LS = (api && api.storage && api.storage.local) || null;
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
  const ver = hash(JSON.stringify(dict.entries) + [cfg.useDrafts, cfg.critiques].join());   // dictionnaire modifié -> mémoire reconstruite
  const MEMK = "afroluo_mem_" + cfg.lang, MISK = "afroluo_missing_" + cfg.lang;
  const mem = new Map(); let memDirty = false;
  if (LS) { try { const o = (await LS.get(MEMK))[MEMK]; if (o && o.ver === ver) Object.entries(o.data).forEach(([k, v]) => mem.set(k, v)); } catch (e) {} }
  const norm = s => s.trim().replace(/[’]/g, "'").replace(/[.:!?…]+$/, "").replace(/\s+/g, " ").toLowerCase();
  const exact = new Map();                              // textes sans variable : recherche instantanée

  const VARS = /\{(\w+)\}/g;
  const varsOf = s => [...s.matchAll(VARS)].map(m => m[1]).sort().join(",");
  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]").replace(/\s+/g, "\\s+");

  // Compilation du dictionnaire : une entrée dont les variables diffèrent est REJETÉE.
  const rules = [], bloque = [];                        // bloque : lignes critiques non validées (jamais traduites par le modèle)
  if (!dict.entries.length) console.warn("[AfroLuo] dictionnaire vide pour la langue : " + cfg.lang);
  for (const e of dict.entries) {
    if (!e.tr || varsOf(e.fr) !== varsOf(e.tr)) continue;
    if (e.critique && e.status !== "valide" && !cfg.critiques) {   // option décochée : montant, frais, avertissement restent en français
      const p = e.fr.trim().replace(/[.:!?…]+$/, "").split(/\{\w+\}/).map(esc);
      bloque.push(new RegExp("^" + p.join("(.+?)") + "\\s*[.:!?…]*$", "i")); continue;
    }
    if (e.status !== "valide" && !cfg.useDrafts) continue;
    const names = [...e.fr.matchAll(VARS)].map(m => m[1]);
    if (!names.length && !exact.has(norm(e.fr))) exact.set(norm(e.fr), { tr: e.tr, kind: e.status || "a_confirmer", audio: e.audio });
    const parts = e.fr.trim().replace(/[.:!?…]+$/, "").split(/\{\w+\}/).map(esc);   // ponctuation finale facultative
    rules.push({ re: new RegExp("^" + parts.join("(.+?)") + "\\s*[.:!?…]*$", "i"), names, tr: e.tr, status: e.status || "a_confirmer", audio: e.audio });
  }

  const NUM = /\d[\d\s\u00a0\u202f.,]*\d|\d/g;
  const digits = s => (s.match(NUM) || []).map(x => x.replace(/[\s\u00a0\u202f]/g, "")).sort().join("|");
  const fromDict = text => {
    const t = text.trim();
    const hit = exact.get(norm(t)); if (hit) return hit;
    const m0 = mem.get(t); if (m0) return m0;           // déjà vu (sur cette page ou sur un autre site)
    for (const r of rules) {
      const m = t.match(r.re); if (!m) continue;
      let out = r.tr; r.names.forEach((n, i) => { out = out.split("{" + n + "}").join(m[i + 1]); });
      const res = { tr: out, kind: r.status, audio: r.audio }; mem.set(t, res); memDirty = true; return res;
    }
    return null;
  };

  const cache = new Map();
  const viaMT = async text => {                       // traduction automatique, avec garde-fous
    if (!cfg.apiUrl) return null;
    if (cache.has(text)) return cache.get(text);
    const nums = []; const masked = text.replace(NUM, x => { nums.push(x); return "X" + nums.length + "X"; });
    const r = await new Promise(res => api.runtime.sendMessage({ type: "mt", text: masked, lang: L.mt }, res));
    let out = null;
    if (r && r.ok && r.translated) {
      out = r.translated;
      nums.forEach((n, i) => { out = out.replace("X" + (i + 1) + "X", n); });
      if (digits(out) !== digits(text) || /X\d+X/.test(out)) out = null;   // montant altéré -> on garde le français
    }
    cache.set(text, out ? { tr: out, kind: "mt" } : null);
    return cache.get(text);
  };

  const missing = new Set();
  const persist = async () => {                          // enregistre la mémoire et la liste des textes jamais traduits (tous sites confondus)
    if (!LS) return;
    try {
      if (memDirty) { await LS.set({ [MEMK]: { ver, data: Object.fromEntries([...mem].slice(-3000)) } }); memDirty = false; }
      const old = (await LS.get(MISK))[MISK] || [], all = new Set(old); missing.forEach(t => all.add(t));
      if (all.size !== old.length) await LS.set({ [MISK]: [...all].slice(-2000) });
    } catch (e) {}
  };                           // textes que ni le dictionnaire ni la TA n'ont traduits
  const store = new WeakMap();                         // nœud/élément -> {fr, tr, kind}
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "INPUT", "SELECT"]);
  let on = cfg.enabled;

  const mark = (el, kind, fr) => {
    if (!el || !el.setAttribute) return;
    el.setAttribute("data-afroluo", kind);
    if (!el.hasAttribute("data-afroluo-title")) { el.setAttribute("data-afroluo-title", "1"); el.title = "FR : " + fr; }
  };
  // Audio : si l'entrée du dictionnaire a un fichier son (enregistré par un locuteur natif), une petite icône 🔊 permet de l'écouter.
  let player = null;
  const NOAUDIO = new Set(["SELECT", "OPTION", "INPUT", "TEXTAREA"]);
  function addAudio(el, path) {
    if (!el || NOAUDIO.has(el.tagName) || el.querySelector(":scope > .afroluo-audio")) return;
    const b = document.createElement("span"); b.className = "afroluo-audio"; b.textContent = "🔊"; b.title = "Écouter";
    b.setAttribute("role", "button"); b.tabIndex = 0;
    const jouer = e => { e.preventDefault(); e.stopPropagation(); try { if (player) player.pause(); player = new Audio(api.runtime.getURL(path)); player.play().catch(() => {}); } catch (x) {} };
    b.addEventListener("click", jouer); b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") jouer(e); });
    el.appendChild(b);
  }
  async function handleText(n) {
    const cur = n.nodeValue; if (!cur || !/\p{L}/u.test(cur)) return;
    const s = store.get(n); if (s && cur === s.tr) return;
    const lead = cur.match(/^\s*/)[0], trail = cur.match(/\s*$/)[0];
    if (bloque.some(re => re.test(cur.trim()))) return;        // ligne critique non validée : le français reste affiché
    const r = cfg.mtOnly ? ((await viaMT(cur.trim())) || fromDict(cur)) : (fromDict(cur) || await viaMT(cur.trim()));   // mtOnly : le modèle d'abord ; si le modèle échoue, le dictionnaire sert de secours
    if (!r) { if (cur.trim().length < 300) missing.add(cur.trim()); return; }
    // Mode bilingue : tout texte NON validé garde le français à côté (« ewondo (français) ») : un montant ou une condition reste lisible.
    const texte = lead + r.tr + (cfg.bilingual && (r.kind !== "valide" || cfg.alwaysFr) ? " (" + cur.trim() + ")" : "") + trail;
    store.set(n, { fr: cur, tr: texte, kind: r.kind });
    if (on) { n.nodeValue = texte; mark(n.parentElement, r.kind, cur.trim()); if (r.audio && cfg.audio) addAudio(n.parentElement, r.audio); }
  }
  async function handleAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v || el.hasAttribute("data-afroluo-title") && a === "title") continue;
      const r = fromDict(v) || await viaMT(v); if (!r) continue;
      store.set(el, Object.assign(store.get(el) || {}, { [a]: { fr: v, tr: r.tr } }));
      if (on) el.setAttribute(a, r.tr);
    }
  }
  async function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) return handleText(root);
    if (root.nodeType !== 1 || SKIP.has(root.tagName) || root.closest("#afroluo-toggle")) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && !SKIP.has(n.parentElement.tagName) && !n.parentElement.closest("#afroluo-toggle")) ? 1 : 2 });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    await Promise.all(nodes.map(handleText));
    root.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(handleAttrs);
  }
  function setLang(ewondo) {                           // bascule FR <-> ewondo (retour au français = sécurité)
    on = ewondo; document.body.classList.toggle("afroluo-fr", !ewondo);
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode, s = store.get(n); if (s) n.nodeValue = ewondo ? s.tr : s.fr; }
    document.querySelectorAll("[data-afroluo]").forEach(el => { const s = store.get(el);
      if (s) ATTRS.forEach(a => { if (s[a]) el.setAttribute(a, ewondo ? s[a].tr : s[a].fr); }); });
    if (btn) btn.textContent = ewondo ? L.name + " ▸ Français" : "Français ▸ " + L.name;
  }

  const st = document.createElement("style");
  st.textContent = (cfg.underline ? '[data-afroluo="a_confirmer"],[data-afroluo="mt"]{text-decoration:underline dotted #c2410c;text-underline-offset:3px}' : "") +
    '.afroluo-audio{cursor:pointer;margin-left:6px;font-size:.9em;opacity:.8;user-select:none}.afroluo-audio:hover{opacity:1}body.afroluo-fr .afroluo-audio{display:none}' +
    '#afroluo-toggle{position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:8px 12px;border:0;border-radius:8px;background:#14532d;color:#fff;font:600 13px system-ui;cursor:pointer;box-shadow:0 2px 8px #0004}';
  document.head.appendChild(st);
  let btn = null;                                       // bouton vert : facultatif (showButton), l'interface de l'équipe peut piloter la bascule elle-même
  if (cfg.showButton) { btn = document.createElement("button"); btn.id = "afroluo-toggle";
    btn.textContent = L.name + " ▸ Français"; btn.onclick = () => setLang(!on); document.body.appendChild(btn); }
  // Commande pour un autre design : window.dispatchEvent(new CustomEvent("afroluo:set", { detail: { on: true } }))   (true = ewondo, false = français)
  window.addEventListener("afroluo:set", e => setLang(!!(e.detail && e.detail.on)));

  await scan(document.body); persist();
  let timer; const pending = new Set();
  new MutationObserver(ms => {
    for (const m of ms) { if (m.type === "characterData") pending.add(m.target); else m.addedNodes.forEach(n => pending.add(n)); }
    clearTimeout(timer); timer = setTimeout(() => { const p = [...pending]; pending.clear(); Promise.all(p.map(scan)).then(persist); }, 80);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (api && api.runtime.onMessage) api.runtime.onMessage.addListener((m, _s, send) => { if (m.type === "missing") send([...missing]); if (m.type === "setLang") setLang(!!m.on); });
  window.__afroluo = { missingList: () => [...missing], setLang, rules: rules.length, memorySize: () => mem.size };
  console.log("[AfroLuo] " + rules.length + " regles chargees");   // utile pour la démonstration
})();
