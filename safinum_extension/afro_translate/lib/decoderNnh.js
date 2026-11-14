// Décodeur de translittération Ngiemboon : même table que translit.py (à appliquer à la SORTIE du modèle si "translit": true)
const R_NNH = {o:'ɔ',O:'Ɔ',e:'ɛ',E:'Ɛ',n:'ŋ',N:'Ŋ',u:'ʉ',U:'Ʉ',a:'ə',A:'Ə',z:'ǝ',Z:'Ǝ',y:'ʼ',i:'ɨ',I:'Ɨ',
  h:'́',l:'̀',c:'̂',v:'̌',d:'̈',t:'̃',m:'̄',s:'̧',p:'̇'};
function decoderNnh(s) {
  let o = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c !== 'q') { o += c; i++; continue; }
    const d = s[i + 1];
    if (d === undefined) break;
    if (d === 'q') { o += 'q'; i += 2; }
    else if (d === 'x') {
      const h = s.slice(i + 2, i + 7);
      if (/^[0-9a-f]{5}$/.test(h)) { o += String.fromCodePoint(parseInt(h, 16)); i += 7; } else i += 2;
    } else { if (R_NNH[d]) o += R_NNH[d]; i += 2; }
  }
  return o.normalize('NFC');
}
if (typeof module !== 'undefined') module.exports = { decoderNnh };
