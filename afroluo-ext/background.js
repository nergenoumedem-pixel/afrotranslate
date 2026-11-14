// Appel du service de traduction automatique (optionnel) pour les textes absents du dictionnaire.
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg.type !== "mt") return;
  (async () => {
    try {
      const { apiUrl, model } = await chrome.storage.sync.get({ apiUrl: "", model: "" });
      if (!apiUrl) return send({ ok: false, error: "api non configuree" });
      const r = await fetch(apiUrl.replace(/\/$/, "") + "/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.text, source_lang: "fr", target_lang: msg.lang || "ew", model: model || undefined })
      });
      if (!r.ok) return send({ ok: false, error: "HTTP " + r.status });
      const j = await r.json();
      if (j.error) return send({ ok: false, error: j.error });
      send({ ok: true, translated: j.translated_text });
    } catch (e) { send({ ok: false, error: String(e) }); }
  })();
  return true;
});
