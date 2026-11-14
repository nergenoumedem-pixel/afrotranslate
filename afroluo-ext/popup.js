const $ = i => document.getElementById(i);
fetch("languages.json").then(r => r.json()).then(ls => {
  ls.forEach(l => { const o = document.createElement("option"); o.value = l.code; o.textContent = l.name; $("lang").appendChild(o); });
  chrome.storage.sync.get({ lang: "ewondo" }, c => { $("lang").value = c.lang; });
});
chrome.storage.sync.get({ enabled: true, useDrafts: true, bilingual: true, critiques: true, underline: false, alwaysFr: true, audio: true }, c => { $("underline").checked = c.underline; $("audio").checked = c.audio;
  $("enabled").checked = c.enabled; $("bilingual").checked = c.bilingual; $("critiques").checked = c.critiques; $("useDrafts").checked = c.useDrafts;
});
// Bascule français <-> langue immédiate sur la page ouverte
$("enabled").onchange = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "setLang", on: $("enabled").checked });
};
$("save").onclick = () => chrome.storage.sync.set({ lang: $("lang").value, bilingual: $("bilingual").checked, critiques: $("critiques").checked, underline: $("underline").checked, alwaysFr: $("bilingual").checked, audio: $("audio").checked,
  enabled: $("enabled").checked, useDrafts: $("useDrafts").checked }, async () => { $("ok").textContent = "✓"; const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab) chrome.tabs.reload(tab.id); });

$("exp").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "missing" }, list => {
    if (!list || !list.length) { $("n").textContent = "Aucun texte non traduit (rechargez la page ?)"; return; }
    const csv = "﻿Français;Ewondo\n" + list.map(t => '"' + t.replace(/"/g, '""') + '";').join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "textes_non_traduits.csv"; a.click(); $("n").textContent = list.length + " textes exportés";
  });
};

// Mémoire : tout ce qui a été vu sur tous les sites reste enregistré dans le navigateur (traduction plus rapide à chaque visite)
const keys = () => ["afroluo_mem_" + $("lang").value, "afroluo_missing_" + $("lang").value];
const csv = l => "\ufeffFrançais;Ewondo\n" + l.map(t => '"' + t.replace(/"/g, '""') + '";').join("\n");
const save = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); };
$("expAll").onclick = async () => { const o = await chrome.storage.local.get(keys()[1]); const l = o[keys()[1]] || [];
  $("n2").textContent = l.length ? l.length + " textes exportés" : "Rien à exporter pour l'instant"; if (l.length) save("textes_non_traduits_tous_sites.csv", csv(l)); };
$("clr").onclick = async () => { await chrome.storage.local.remove(keys()); $("mem").textContent = "mémoire vidée ✓"; };
setTimeout(async () => { const o = await chrome.storage.local.get(keys()); const m = o[keys()[0]]; $("mem").textContent = m ? Object.keys(m.data).length + " phrases en mémoire" : ""; }, 150);
