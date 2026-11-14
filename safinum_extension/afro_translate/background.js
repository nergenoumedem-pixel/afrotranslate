// Service worker : fournit les mémoires validées et relaie les traductions vers le serveur local (127.0.0.1, rien ne sort de l'ordinateur).
importScripts('langues.js');
const memoires = {};
// Serveur local de traduction (serveur_traduction.py)
async function serveurOK(code) {
  try {
    const r = await fetch(SERVEUR_LOCAL + '/etat', { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return !!(j.langues && j.langues[code]);
  } catch (_) { return false; }
}
// 'serveur' | null
async function source(code, L) {
  if (!L || !L.modele || !L.serveur) return null;
  return (await serveurOK(code)) ? 'serveur' : null;
}
async function viaServeur(code, textes) {
  try {
    const r = await fetch(SERVEUR_LOCAL + '/traduire', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ langue: code, textes }), signal: AbortSignal.timeout(180000)
    });
    const j = await r.json();
    return { ...j, etat: { charge: true, source: 'serveur' } };
  } catch (e) {
    return { ok: false, erreur: 'Serveur local arrêté : relancez LANCER_SERVEUR.bat (' + String(e).slice(0, 80) + ')' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, repondre) => {
  const L = LANGUES[msg.langue];
  if (msg.type === 'modele-present') {
    source(msg.langue, L).then(s => repondre({ ok: !!s, source: s }));
    return true;
  }
  if (msg.type === 'memoire') {
    if (!L) { repondre({ ok: false, erreur: 'langue inconnue' }); return false; }
    (memoires[msg.langue] ? Promise.resolve(memoires[msg.langue])
      : fetch(chrome.runtime.getURL(L.memoire)).then(r => r.json()).then(m => (memoires[msg.langue] = m)))
      .then(m => repondre({ ok: true, memoire: m })).catch(e => repondre({ ok: false, erreur: String(e) }));
    return true;
  }
  if (msg.type === 'traduire' || msg.type === 'charger-modele') {
    source(msg.langue, L).then(s => {
      if (!s) return repondre({ ok: false, sansModele: true, etat: { sansModele: true } });
      if (msg.type === 'charger-modele') return repondre({ ok: true, etat: { charge: true, source: 'serveur' } });
      viaServeur(msg.langue, msg.textes).then(repondre);
    });
    return true;
  }
  return false;
});
