const $ = s => document.querySelector(s);
const NOMS = Object.fromEntries(Object.entries(self.LANGUES).map(([k, v]) => [k, v.nom]));
document.getElementById('choix').innerHTML =
  Object.entries(self.LANGUES).map(([k, v], i) => `<label class="option"><input type="radio" name="sens" value="${k}"${i === 0 ? ' checked' : ''}>
    <span><b>Français → ${v.nom}</b><small>${v.modele ? 'Phrases validées + modèle' : 'Phrases connues seulement'}</small></span></label>`).join('') +
  `<label class="option"><input type="radio" name="sens" value="fr"><span><b>Retour au français</b><small>Revenir à la langue d'origine</small></span></label>`;
const onglet = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const sens = () => document.querySelector('input[name=sens]:checked').value;
const choisir = v => { const r = document.querySelector(`input[name=sens][value=${v}]`); if (r) r.checked = true; majBouton(); };
const msg = (t, err = false) => { $('#message').textContent = t; $('#message').className = err ? 'erreur' : ''; };

async function executer(func, args = []) {
  const tab = await onglet();
  const fichiers = ['langues.js', 'lib/decoderNnh.js', 'content.js'];
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: fichiers });
    return await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func, args });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: fichiers });
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  }
}
async function etat() {
  try {
    const tab = await onglet();
    const f = () => (window.__nnhEtat ? window.__nnhEtat() : null);
    let r;
    try { r = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: f }); }
    catch (_) { r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: f }); }
    const e = r.map(x => x.result).filter(Boolean);
    if (!e.length) return null;
    const a = e.find(x => x.actif) || e[0];
    return { actif: e.some(x => x.actif), langue: a.langue, nom: a.nomLangue, sansModele: a.sansModele,
             enCours: e.some(x => x.enCours), total: e.reduce((s, x) => s + x.total, 0), fait: e.reduce((s, x) => s + x.fait, 0),
             integriteKO: e.reduce((s, x) => s + (x.integriteKO || 0), 0), erreur: e.map(x => x.erreur).find(Boolean),
             memTaille: a.memTaille, memErreur: a.memErreur, source: a.source };
  } catch (_) { return null; }
}
function majBouton() { $('#go').textContent = sens() === 'fr' ? 'Revenir au français' : `Traduire en ${NOMS[sens()]}`; }

let premier = true;
async function suivre() {
  const e = await etat();
  if (!e) return;
  if (premier) { premier = false; if (e.actif) choisir('fr'); }     // page déjà traduite : l'action utile est le retour
  const diag = document.getElementById('diag');
  if (diag) diag.textContent = e.actif ? `${e.nom} · dictionnaire : ${e.memErreur ? 'ERREUR (' + String(e.memErreur).slice(0, 60) + ')' : (e.memTaille || 0) + ' phrases'} · modèle : ${e.source === 'serveur' ? 'serveur local' : 'aucun (lancez LANCER_SERVEUR.bat)'}` : '';
  if (e.erreur) { msg('Le modèle ne démarre pas : ' + String(e.erreur).slice(0, 160), true); $('#go').disabled = false; return; }
  if (e.actif && e.enCours && e.total) { msg(`Traduction en ${e.nom} en cours… ${Math.min(100, Math.round(100 * e.fait / e.total))} %`); return; }
  if (e.actif && e.enCours) { msg('Préparation…'); return; }
  $('#go').disabled = false;
  if (!e.actif) { msg(''); return; }
  const ko = e.integriteKO ? ` ${e.integriteKO} texte(s) gardé(s) en français pour protéger une valeur.` : ' Montants, noms et références intacts ✓';
  const conseil = e.sansModele && LANGUES[e.langue]?.serveur ? ' Pour le modèle : lancez LANCER_SERVEUR.bat puis retraduisez.' : '';
  msg(`Page traduite en ${e.nom}${e.sansModele ? ' (phrases connues seulement)' : ''}.` + ko + conseil);
}

document.querySelectorAll('input[name=sens]').forEach(r => r.addEventListener('change', async () => {
  majBouton();
  if (sens() !== 'fr' && $('#toujours').checked) await chrome.storage.local.set({ langueToujours: sens() });
}));
$('#go').addEventListener('click', async () => {
  try {
    if (sens() === 'fr') { await executer(() => window.__nnhFrancais()); msg('Texte d\'origine rétabli.'); }
    else { $('#go').disabled = true; msg('Préparation…'); await executer(lg => window.__nnhTraduire(lg), [sens()]); }
  } catch (e) {
    const t = String(e && e.message || e);
    msg(/chrome:|edge:|webstore|Cannot access a chrome/i.test(t) ? 'Page interne du navigateur : elle ne peut pas être traduite.' : 'Erreur : ' + t.slice(0, 200), true);
    $('#go').disabled = false;
  }
});
$('#toujours').addEventListener('change', async e => {
  await chrome.storage.local.set({ toujours: e.target.checked, langueToujours: sens() === 'fr' ? 'nnh' : sens() });
});
$('#memoire').addEventListener('change', e => chrome.storage.local.set({ memoire: e.target.checked }));
chrome.storage.local.get({ toujours: false, memoire: true, langueToujours: 'nnh' }).then(s => {
  $('#toujours').checked = s.toujours; $('#memoire').checked = s.memoire; choisir(s.langueToujours);
});
majBouton(); suivre(); setInterval(suivre, 800);
