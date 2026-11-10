'use strict';
/* พูดจีนรอดใน 20 วัน — js/speech.js: Speech recognition + scoring · Recorder · Pitch / tones
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
 */

// ============================================================ Speech recognition (+ fallback levels)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Mic = {
  supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!(window.AudioContext || window.webkitAudioContext),
};
const Speech = {
  srBroken: false, micDenied: false, notified: false,
  snoozed: () => !!(S.settings.micSnoozeUntil && Date.now() < S.settings.micSnoozeUntil),
  canRecord() { return Mic.supported() && !this.micDenied; },
  // A = auto-check, B = record & self-compare, C = say it & confirm, off = skip speaking
  level() {
    const m = S.settings.micMode;
    if (m === 'off' || this.snoozed()) return 'off';
    if (m === 'manual') return 'C';
    if (m === 'record') return this.canRecord() ? 'B' : 'C';
    if (SR && !this.srBroken) return 'A';
    return this.canRecord() ? 'B' : 'C';
  },
  toneAvailable() { return S.settings.micMode !== 'off' && !this.snoozed() && this.canRecord(); },
  active: null,
  // Safari only marks a result final after a long pause, so we listen to interim results and
  // finish as soon as `isGood(alts)` is satisfied. Speech.stop() ends listening early (second tap).
  recognize({ timeoutMs = 6000, isGood, onStart } = {}) {
    return new Promise((resolve, reject) => {
      let r, tm = 0, done = false;
      const alts = [];
      const finish = (ok, arg) => {
        if (done) return;
        done = true; clearTimeout(tm); this.active = null;
        try { r.abort(); } catch {}
        ok ? resolve(arg) : reject(arg);
      };
      const settle = () => alts.length ? finish(true, alts) : finish(false, 'no-speech');
      try {
        r = new SR();
        r.lang = 'zh-CN'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
        r.onstart = () => onStart && onStart();
        r.onresult = e => {
          for (const res of e.results) for (let i = 0; i < res.length; i++) {
            const t = res[i].transcript;
            if (t && !alts.includes(t)) alts.push(t);
          }
          if (e.results[e.results.length - 1].isFinal || (isGood && isGood(alts))) finish(true, alts);
        };
        r.onerror = e => finish(false, e.error || 'error');
        r.onend = settle;
        this.active = { stop: () => { try { r.stop(); } catch {} setTimeout(settle, 700); } };
        tm = setTimeout(() => this.active && this.active.stop(), timeoutMs);
        r.start();
      } catch { finish(false, 'start-failed'); }
    });
  },
  stop() { if (this.active) this.active.stop(); },
};

const normZh = s => (s || '').replace(/[\s，。！？、,.!?…'"“”‘’：:；;]/g, '').toLowerCase();
// The recogniser often writes numbers as digits ("38块", "2:30", "308"). Spell them out every way a person
// could have said them: counting (三十八 / 两百), digit by digit (三零八 / 幺二零五), clock time (两点半).
const ZH_DIG = '零一二三四五六七八九';
function zhNum(n) {
  if (n < 10) return ZH_DIG[n];
  if (n < 100) { const t = Math.floor(n / 10), u = n % 10; return (t === 1 ? '' : ZH_DIG[t]) + '十' + (u ? ZH_DIG[u] : ''); }
  if (n < 1000) { const hh = Math.floor(n / 100), r = n % 100; return ZH_DIG[hh] + '百' + (!r ? '' : r < 10 ? '零' + ZH_DIG[r] : r < 20 ? '一' + zhNum(r) : zhNum(r)); }
  if (n < 10000) { const k = Math.floor(n / 1000), r = n % 1000; return ZH_DIG[k] + '千' + (!r ? '' : r < 100 ? '零' + zhNum(r) : zhNum(r)); }
  return String(n);
}
const liang = s => s.replace(/^二(?=[百千点个位块]|$)/, '两').replace(/(^|[^十])二(?=[点个位块])/g, '$1两');
function numVariants(raw) {
  if (!/\d/.test(raw)) return [raw];
  const clock = raw.replace(/(\d{1,2})[:：](\d{2})/g, (_, hh, mm) => zhNum(+hh) + '点' + (mm === '00' ? '' : mm === '30' ? '半' : zhNum(+mm) + '分'));
  const count = clock.replace(/\d+(\.\d+)?/g, m => m.includes('.') ? zhNum(+m.split('.')[0]) + '块' + [...m.split('.')[1]].map(d => ZH_DIG[d]).join('') : zhNum(+m));
  const digit = clock.replace(/\d+/g, m => [...m].map(d => ZH_DIG[d]).join(''));
  return uniq([raw, count, liang(count), digit, digit.replace(/一/g, '幺')]);
}
const expandAlts = alts => uniq(alts.flatMap(numVariants));
// Stop listening early only once the whole phrase is in: a short "accept" form (早 for 早上好, 那 for 那个)
// would otherwise end the mic while the learner is still mid-phrase.
function heardWhole(item, alts) {
  const main = normZh(item.hanzi);
  const full = [main, ...(item.accept || []).map(normZh).filter(x => x.length >= main.length)];
  return expandAlts(alts).some(raw => {
    const a = normZh(raw);
    if (full.some(t => t && a.includes(t))) return true;
    const d = speechDiff(item, raw);
    return !!d && !d.extra && d.syl.every(s => s.kind === 'ok');
  });
}
// Said alone, a syllable has no context, so the recogniser often writes an interjection with the right sound
// but its dictionary tone (一 yī → 咦 yí). Those don't count as a tone error for one-syllable words.
const INTERJ_PY = { 噫: 'yī', 咦: 'yí', 呃: 'è', 嗯: 'ng', 欸: 'ēi', 诶: 'éi', 哎: 'āi', 唉: 'āi', 喔: 'ō', 噢: 'ō', 哦: 'ó' };
// A lone syllable has no context, so the recogniser guesses the most common word (水 → 岁 / 对 / "Siri").
// After a miss, one-syllable words offer a short phrase around them; it passes because it contains the word.
const CARRIER = {
  shi4: ['是的', 'shì de'], hao3: ['好的', 'hǎo de'], dui4: ['对对对', 'duì duì duì'], yao4: ['我要', 'wǒ yào'],
  mao: ['五毛', 'wǔ máo'], liang3: ['两个', 'liǎng ge'], qian2: ['多少钱', 'duōshao qián'], mai3: ['我要买', 'wǒ yào mǎi'],
  mai4: ['卖完了', 'mài wán le'], gui4: ['太贵了', 'tài guì le'], xing2: ['行吗', 'xíng ma'], shui3: ['我要水', 'wǒ yào shuǐ'],
  la4: ['很辣', 'hěn là'], tian2: ['很甜', 'hěn tián'], suan1: ['很酸', 'hěn suān'], you3: ['有吗', 'yǒu ma'],
  zuo3: ['左边', 'zuǒbian'], you4: ['右边', 'yòubian'], piao4: ['一张票', 'yì zhāng piào'], dian3: ['快一点', 'kuài yìdiǎn'],
  ma2: ['很麻', 'hěn má'], kuai: ['几块', 'jǐ kuài'],
};
function carrierHint(it) {
  const c = CARRIER[it.id];
  if (!c) return null;
  return h('p', { class: 'hint' }, '💡 คำเดียวโดด ๆ ระบบฟังยาก ลองพูดเป็นวลี: ',
    h('button', { class: 'chip-btn', onclick: () => TTS.speak(c[0], 0.8) }, h('b', { lang: 'zh-CN' }, c[0]), ' ', pyEl(c[1]), ' 🔊'));
}
function scoreSpeech(item, alts) {
  const targets = [item.hanzi, ...(item.accept || [])].map(normZh).filter(Boolean);
  const rejects = (item.reject || []).map(normZh).filter(Boolean);
  alts = expandAlts(alts);
  let best = 0, heard = alts[0] || '', toneTrap = null;
  for (const raw of alts) {
    const a = normZh(raw);
    if (!a) continue;
    for (const t of targets) {
      const sim = a.includes(t) ? 1 : 1 - levenshtein(a, t) / Math.max(a.length, t.length);
      if (sim > best) { best = sim; heard = raw; }
    }
    // Homophones / tone-sandhi spellings (泥好 for 你好, 前 for 钱) are correct speech.
    if (best < 1) { const d = speechDiff(item, raw); if (d && !d.extra && d.syl.every(s => s.kind === 'ok')) { best = 1; heard = raw; } }
  }
  const one = [...normZh(item.hanzi)];
  // Curled vs flat tongue (sh/s, zh/z, ch/c) with the right tone: much of China says it this way and is understood,
  // so it passes — the diff still shows the tip.
  if (best < 0.85) for (const raw of alts) {
    const d = speechDiff(item, raw);
    if (d && !d.extra && d.syl.some(s => s.kind === 'initial') &&
      d.syl.every(s => s.kind === 'ok' || (s.kind === 'initial' && FLAT_CURL[s.a.ini] === s.b.ini && s.a.tone === s.b.tone))) { best = 0.85; heard = raw; break; }
  }
  if (best < 1 && one.length === 1) {
    const want = stripTones(sylls(item.pinyin)[0] ? sylls(item.pinyin)[0].text : '').toLowerCase();
    const raw = alts.find(r => { const a = [...normZh(r)]; return a.length && a.every(c => INTERJ_PY[c] && stripTones(INTERJ_PY[c]) === want); });
    if (raw) { best = 1; heard = raw; }
  }
  if (best < 0.8) {
    for (const raw of alts) {
      const a = normZh(raw);
      const r = rejects.find(x => a.includes(x) && !targets.some(t => a.includes(t)));
      if (r) { toneTrap = r; heard = raw; best = Math.min(best, 0.4); break; }
    }
  }
  let ctx = false;
  if (best < 1 && !toneTrap && one.length > 1) {
    const raw = alts.find(r => contextOK(contextScore(item, r)));
    if (raw) { ctx = true; heard = raw; best = Math.max(best, 0.8); }
  }
  return { best, heard, toneTrap, ctx };
}
function lookupHanzi(hz) {
  for (const it of Object.values(C.items)) if (normZh(it.hanzi) === hz) return { pinyin: it.pinyin, meaning: it.meaning };
  for (const ts of C.toneSets) { const i = ts.hanzi.indexOf(hz); if (i >= 0) return { pinyin: ts.pinyin[i], meaning: ts.meaning[i] }; }
  return null;
}

// Pinyin of single characters, learned from the content itself (item hanzi ↔ pinyin syllables).
// content/charpy.json (3755 common hanzi by toned syllable) fills in characters the lessons don't use,
// e.g. a homophone the recogniser wrote instead.
let charPyMap = null, charPyExtra = null;
fetch('content/charpy.json').then(r => r.ok ? r.json() : null).then(d => { charPyExtra = d; charPyMap = null; }).catch(() => {});
function charPy() {
  if (charPyMap) return charPyMap;
  charPyMap = {};
  if (charPyExtra) for (const [py, cs] of Object.entries(charPyExtra)) for (const c of cs) charPyMap[c] = py;
  Object.assign(charPyMap, INTERJ_PY);
  const add = (hz, py) => {
    const cs = [...normZh(hz)], ss = sylls(py);
    if (cs.length === ss.length) cs.forEach((c, i) => { if (!seen.has(c)) { seen.add(c); charPyMap[c] = ss[i].text.toLowerCase(); } });
  };
  const seen = new Set(); // lesson readings win over the generic table (first lesson reading wins)
  for (const it of Object.values(C.items)) add(it.hanzi, it.pinyin);
  for (const ts of C.toneSets) ts.hanzi.forEach((hz, i) => add(hz, ts.pinyin[i]));
  return charPyMap;
}
const INITIAL_RE = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?/;
// Same syllable with another tone mark (tone 5 = no mark).
function retone(py, tone) {
  const base = py.normalize('NFD').replace(/[̄́̌̀]/g, '');
  if (tone === 5) return base.normalize('NFC');
  const mark = { 1: '̄', 2: '́', 3: '̌', 4: '̀' }[tone];
  let at = /[ae]/.test(base) ? base.search(/[ae]/) : base.includes('ou') ? base.indexOf('o') : base.search(/[aeiou]̈?[^aeioü]*$/);
  if (base[at + 1] === '̈') at++; // ü: tone mark goes after the diaeresis
  return (base.slice(0, at + 1) + mark + base.slice(at + 1)).normalize('NFC');
}
function splitSyl(s) {
  const b = stripTones(s), ini = b.match(INITIAL_RE)[0];
  return { ini, fin: b.slice(ini.length), tone: toneOf(s) };
}
// Aligns what the recogniser wrote with the target, syllable by syllable, so a miss can say *what* was off:
// ok | tone | initial | final | other (different word) | missing.
function speechDiff(item, heardRaw) {
  const tc = [...normZh(item.hanzi)], ts = sylls(item.pinyin), hc = [...normZh(heardRaw)];
  if (!tc.length || tc.length !== ts.length || !hc.length) return null;
  const map = charPy();
  // What a native speaker actually says: 3+3 → 2+3; a neutral-tone syllable may come back with any tone.
  const spoken = spokenTones(ts.map(s => s.tone));
  const want = ts.map((s, i) => retone(s.text.toLowerCase(), spoken[i].tone));
  const same = (i, j) => {
    const hp = map[hc[j]];
    return tc[i] === hc[j] || (!!hp && (hp === want[i] || hp === ts[i].text.toLowerCase() || (ts[i].tone === 5 && stripTones(hp) === stripTones(want[i]))));
  };
  const n = tc.length, m = hc.length;
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i && j ? 0 : i + j)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    D[i][j] = Math.min(D[i - 1][j - 1] + (same(i - 1, j - 1) ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
  const got = Array(n).fill(null);
  let extra = 0;
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i && j && D[i][j] === D[i - 1][j - 1] + (same(i - 1, j - 1) ? 0 : 1)) { got[i - 1] = j - 1; i--; j--; }
    else if (i && D[i][j] === D[i - 1][j] + 1) i--;
    else { extra++; j--; }
  }
  const syl = tc.map((hz, i) => {
    const py = ts[i].text;
    if (got[i] === null) return { hz, py, kind: 'missing' };
    const heard = hc[got[i]];
    if (same(i, got[i])) return { hz, py, kind: 'ok' };
    const heardPy = map[heard];
    if (!heardPy) return { hz, py, kind: 'other', heard };
    const a = splitSyl(want[i]), b = splitSyl(heardPy);
    a.sandhi = spoken[i].tone !== ts[i].tone;
    const kind = a.ini === b.ini && a.fin === b.fin ? 'tone' : a.fin === b.fin ? 'initial' : a.ini === b.ini ? 'final' : 'other';
    return { hz, py, kind, heard, heardPy, a, b };
  });
  return { syl, extra };
}
// "Would a Chinese person get it from context?" The recogniser has no context, a taxi driver does: in a
// phrase, a listener copes with a consonant from the same family (z/zh/j, c/ch/q, s/sh/x), a close final
// (-n/-ng, ou/iu) or one wrong tone, as long as every syllable is there and no syllable is something else.
// Never used for one-syllable words (买/卖 is exactly what context can't fix) or when a tone trap was heard.
const INI_FAMILY = { z: 'z', zh: 'z', j: 'z', c: 'c', ch: 'c', q: 'c', s: 's', sh: 's', x: 's' };
const FIN_NEAR = [['an', 'ang'], ['en', 'eng'], ['in', 'ing'], ['ian', 'iang'], ['uan', 'uang'], ['ou', 'iu'], ['uo', 'o'], ['u', 'uo'], ['ao', 'iao'], ['u', 'ü'], ['e', 'ei']];
function sylLike(a, b) {
  const ini = a.ini === b.ini ? 1 : INI_FAMILY[a.ini] && INI_FAMILY[a.ini] === INI_FAMILY[b.ini] ? 0.7 : 0;
  const fin = a.fin === b.fin ? 1 : FIN_NEAR.some(([x, y]) => (a.fin === x && b.fin === y) || (a.fin === y && b.fin === x)) ? 0.6 : 0;
  const tone = a.tone === 5 || a.tone === b.tone ? 1 : 0;
  return 0.3 * ini + 0.4 * fin + 0.3 * tone;
}
function contextScore(item, heardRaw) {
  const tc = [...normZh(item.hanzi)], ts = sylls(item.pinyin), hc = [...normZh(heardRaw)];
  if (tc.length < 2 || tc.length !== ts.length || !hc.length) return null;
  const map = charPy();
  const spoken = spokenTones(ts.map(s => s.tone));
  const want = ts.map((s, i) => splitSyl(retone(s.text.toLowerCase(), spoken[i].tone)));
  const got = hc.map(c => (map[c] ? splitSyl(map[c]) : null));
  const sim = (i, j) => (tc[i] === hc[j] ? 1 : got[j] ? sylLike(want[i], got[j]) : 0);
  // Best alignment: every target syllable matched to a heard one in order; extra heard syllables are skipped.
  const n = tc.length, m = hc.length;
  const B = Array.from({ length: n + 1 }, () => Array(m + 1).fill(-Infinity));
  for (let j = 0; j <= m; j++) B[0][j] = 0;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) B[i][j] = Math.max(B[i][j - 1], B[i - 1][j - 1] + sim(i - 1, j - 1));
  if (B[n][m] === -Infinity) return null;
  const per = [];
  for (let i = n, j = m; i > 0;) {
    if (j > i && B[i][j] === B[i][j - 1]) { j--; continue; }
    per.unshift(sim(i - 1, j - 1)); i--; j--;
  }
  return { avg: per.reduce((a, b) => a + b, 0) / n, min: Math.min(...per), extra: m - n };
}
const contextOK = c => !!c && c.avg >= 0.75 && c.min >= 0.55 && c.extra <= 1;
const FLAT_CURL = { zh: 'z', ch: 'c', sh: 's', z: 'zh', c: 'ch', s: 'sh' };
const CURL_HOW = ' — วิธีทำ: ยกปลายลิ้นขึ้นไปใกล้เพดานแข็ง (เลยปุ่มเหงือกไปนิด) ลิ้นไม่แตะฟัน แล้วออกเสียง เสียงจะทุ้มกว่าภาษาไทย';
const INI_HINT = {
  zh: 'zh = "จ" แบบม้วนลิ้น' + CURL_HOW, ch: 'ch = "ช" แบบม้วนลิ้น + พ่นลมแรง' + CURL_HOW, sh: 'sh = "ซ" แบบม้วนลิ้น (ไม่ใช่ ซ/ส ไทย)' + CURL_HOW,
  r: 'r = ม้วนลิ้นคล้าย "ร" ปน "ย" ไม่รัวลิ้น',
  z: 'z = "ตซ" ไม่พ่นลม (เหมือน ds ใน kids) ปลายลิ้นแตะหลังฟันบน — ไม่ใช่ "จ" ไทย ถ้าออกเป็น จ คนจีนจะได้ยินเป็น j (zǒu → jiǔ, zuǒ → jiū)',
  c: 'c = "ทซ" (ไม่ใช่ ช) ปลายลิ้นแตะหลังฟัน แล้วพ่นลมแรงเหมือน ts ใน cats', s: 's = "ซ" ธรรมดา ไม่ม้วนลิ้น',
  j: 'j = "จ" ลิ้นแบน ไม่ม้วน', q: 'q = "ช" ลิ้นแบน + พ่นลมแรง', x: 'x = "ซ" ลิ้นแบน ยิ้มนิด ๆ',
  b: 'b = "ป" ไม่พ่นลม', p: 'p = "พ" พ่นลมแรง', d: 'd = "ต" ไม่พ่นลม', t: 't = "ท" พ่นลมแรง', g: 'g = "ก" ไม่พ่นลม', k: 'k = "ค" พ่นลมแรง',
  h: 'h = "ฮ" ขูดคอนิด ๆ', f: 'f = "ฟ" ฟันบนแตะริมฝีปากล่าง', l: 'l = "ล" ชัด ๆ', n: 'n = "น" ไม่ใช่ "ล"',
};
const FIN_HINT = {
  ui: 'ui (= uei) คือ "อุย" ติดกันในพยางค์เดียว ฟังคล้าย "เวย" สั้น ๆ — อย่าลากเป็นสองพยางค์ "กู่-อี้"',
  uo: 'uo = "อัว" ห่อปากแล้วเปิดเป็น "โอ" ในพยางค์เดียว', iu: 'iu (= iou) = "อิ่ว" ติดกันในพยางค์เดียว',
};
const finHint = fin => FIN_HINT[fin] ? [h('br'), '💡 ' + FIN_HINT[fin]] : null;
const DIFF_LABEL = { tone: 'วรรณยุกต์', initial: 'พยัญชนะ', final: 'สระ', other: 'คนละคำ', missing: 'ไม่ได้ยิน' };
function diffLine(s) {
  const P = p => h('b', {}, pyEl(p));
  switch (s.kind) {
    case 'missing': return [P(s.py), ' — ระบบไม่ได้ยินพยางค์นี้ ออกเสียงให้ครบ อย่ากลืนคำ'];
    case 'tone': return [P(s.py), ` — วรรณยุกต์ผิด: คุณออกเป็น `, P(s.heardPy), ` (${TONE_NAME[s.b.tone]}) ต้องเป็น ${TONE_NAME[s.a.tone]}`,
      s.a.sandhi ? ' (เสียง 3 ที่ตามด้วยเสียง 3 จะพูดเป็นเสียง 2)' : '',
      TONE_HINT[s.a.tone] ? [h('br'), '💡 ' + TONE_HINT[s.a.tone]] : null];
    case 'initial': return [P(s.py), ` — พยัญชนะต้นผิด: ได้ยินเป็น `, P(s.heardPy), ` ต้องขึ้นต้นด้วย "${s.a.ini || 'สระ'}"`,
      INI_HINT[s.a.ini] ? [h('br'), '💡 ' + INI_HINT[s.a.ini]] : null];
    case 'final': return [P(s.py), ' — สระ/เสียงท้ายผิด: ได้ยินเป็น ', P(s.heardPy), ` ต้องลงท้ายด้วย "${s.a.fin}"`,
      /ng$/.test(s.a.fin) !== /ng$/.test(s.b.fin) ? [h('br'), '💡 -ng = เสียงสะกด "ง" ส่วน -n = สะกด "น" ต้องแยกให้ชัด'] : null,
      s.a.fin === 'er' ? [h('br'), '💡 èr = "เอ้อ" แล้วม้วนลิ้นขึ้นท้ายเสียง (เหมือน r ภาษาอังกฤษ) ถ้าไม่ม้วนจะเหลือแค่ "เออ"'] : null,
      finHint(s.a.fin)];
    default: return [P(s.py), ' — ระบบได้ยินเป็น ', h('b', { lang: 'zh-CN' }, s.heard), s.heardPy ? [' ', pyEl(s.heardPy)] : null, ' ซึ่งเป็นคนละเสียง ฟังต้นแบบช้า ๆ แล้วลองใหม่',
      // cài heard as xià: Thai "ไช่" teaches a ch/q sound; name the consonant that has to change.
      s.a && s.b && s.a.ini !== s.b.ini && /^(zh|ch|sh|r|z|c|s|j|q|x)$/.test(s.a.ini) && INI_HINT[s.a.ini] ? [h('br'), '💡 ' + INI_HINT[s.a.ini]] : null,
      s.a && s.b && s.a.fin !== s.b.fin ? finHint(s.a.fin) : null,
      // shí/zhī/chī/rì heard as xu/ju/qu: the Thai "อือ" came out with rounded lips and a flat tongue.
      s.a && /^(zh|ch|sh|r)$/.test(s.a.ini) && s.a.fin === 'i' ? [h('br'), `💡 ${s.a.ini}i: ม้วนปลายลิ้นขึ้นไปใกล้เพดาน ปากไม่ห่อ (ยิ้มนิด ๆ) แล้วออกเสียง "อือ" ค้างไว้ — ถ้าห่อปากหรือลิ้นแบนจะกลายเป็น xu / ju`] : null];
  }
}
// Chips (one per syllable; tap = hear that syllable) plus one explanation line per wrong syllable.
function diffView(item, heard) {
  const d = speechDiff(item, heard);
  if (!d) return null;
  const bad = d.syl.filter(s => s.kind !== 'ok');
  const canPlay = s => toneOf(s.py) !== 5 && !/[一不]/.test(s.hz);
  return h('div', { class: 'diff' },
    h('div', { class: 'syl-row wrap' }, ...d.syl.map(s => h(canPlay(s) ? 'button' : 'div', {
      class: 'syl ' + (s.kind === 'ok' ? 'ok' : 'no'), onclick: canPlay(s) ? () => TTS.speak(s.hz, 0.6) : null,
    }, h('b', {}, pyEl(s.py)), h('small', {}, s.kind === 'ok' ? '✓' : '✕ ' + DIFF_LABEL[s.kind])))),
    ...bad.map(s => h('p', { class: 'hint' }, ...diffLine(s))),
    d.extra && !bad.length ? h('p', { class: 'hint' }, 'มีเสียงอื่นปนมาด้วย ลองพูดเฉพาะคำนี้') : null,
    bad.some(canPlay) ? h('p', { class: 'muted small' }, 'แตะพยางค์เพื่อฟังทีละพยางค์') : null);
}

// ============================================================ Recorder (getUserMedia → Float32 samples)
// autoStop: end ~0.7 s after the speaker goes quiet (once some speech was heard) instead of waiting for maxMs.
// iOS leaves the AudioContext "interrupted" after speech recognition has used the mic (log 11-02: zhǎoqián
// recorded 0.0 s twice right after a speak exercise). Resume it, or start a fresh one if it won't come back.
async function liveCtx(fresh) {
  const wait = (p, ms) => Promise.race([p.catch(() => {}), new Promise(r => setTimeout(r, ms))]);
  let ctx = audioCtx();
  if (ctx && !fresh && ctx.state !== 'running') await wait(ctx.resume(), 400);
  if (ctx && (fresh || ctx.state !== 'running')) {
    logW('mic', `AudioContext ${ctx.state} → สร้างใหม่`);
    try { ctx.close(); } catch {}
    actx = null;
    ctx = audioCtx();
    if (ctx.state !== 'running') await wait(ctx.resume(), 400);
  }
  return ctx;
}
function startRecording(maxMs, onLevel, { autoStop = false } = {}) {
  const ctl = { stop: () => { ctl.stopRequested = true; } };
  ctl.promise = (async () => {
    let ctx = await liveCtx();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) Speech.micDenied = true;
      logW('mic', 'getUserMedia ' + errText(e));
      throw e;
    }
    let src, proc, mute;
    const chunks = [];
    return new Promise(resolve => {
      let done = false, t = 0, dog = 0;
      const unwire = () => {
        if (proc) proc.onaudioprocess = null;
        try { src.disconnect(); proc.disconnect(); mute.disconnect(); } catch {}
      };
      const stop = () => {
        if (done) return;
        done = true; clearTimeout(t); clearTimeout(dog);
        unwire();
        stream.getTracks().forEach(tr => tr.stop());
        let len = 0;
        for (const c of chunks) len += c.length;
        if (!len) logW('mic', `อัดได้ 0 วินาที (AudioContext ${ctx.state})`);
        const out = new Float32Array(len);
        let o = 0;
        for (const c of chunks) { out.set(c, o); o += c.length; }
        resolve({ samples: out, sampleRate: ctx.sampleRate });
      };
      const dt = 2048 / ctx.sampleRate;
      let noise = Infinity, voiced = 0, quiet = 0;
      const onAudio = e => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
        const lvl = Math.sqrt(s / (d.length / 4));
        if (onLevel) onLevel(lvl);
        if (!autoStop) return;
        noise = Math.min(noise, Math.max(lvl, 0.002));
        if (lvl > Math.max(0.015, noise * 4)) { voiced += dt; quiet = 0; }
        else if (voiced > 0.2 && (quiet += dt) > 0.7) setTimeout(stop, 0);
      };
      const wire = () => {
        src = ctx.createMediaStreamSource(stream);
        proc = ctx.createScriptProcessor(2048, 1, 1);
        mute = ctx.createGain();
        mute.gain.value = 0;
        proc.onaudioprocess = onAudio;
        src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      };
      wire();
      // No audio after 0.8 s = the context is stuck: rebuild it once on the same mic stream.
      dog = setTimeout(async () => {
        if (done || chunks.length) return;
        unwire();
        ctx = await liveCtx(true);
        if (!done) wire();
      }, 800);
      t = setTimeout(stop, maxMs);
      ctl.stop = stop;
      if (ctl.stopRequested) setTimeout(stop, 0);
    });
  })();
  return ctl;
}
function playClip(clip) {
  if (!clip || !clip.samples.length) return;
  const ctx = audioCtx();
  const buf = ctx.createBuffer(1, clip.samples.length, clip.sampleRate);
  buf.getChannelData(0).set(clip.samples);
  const s = ctx.createBufferSource();
  s.buffer = buf; s.connect(ctx.destination); s.start();
}

// ============================================================ Pitch tracking (YIN) + tone classification
function yin(x, sr, start, size, minF = 70, maxF = 500, thr = 0.15) {
  const maxTau = Math.min(Math.floor(sr / minF), size >> 1);
  const minTau = Math.max(2, Math.floor(sr / maxF));
  const W = size - maxTau;
  const d = new Float32Array(maxTau + 2);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[start + i] - x[start + i + tau]; s += v * v; }
    d[tau] = s;
  }
  d[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxTau; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
  let tau = -1;
  for (let t = minTau; t < maxTau; t++) {
    if (d[t] < thr) { while (t + 1 < maxTau && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return 0;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const den = a + c - 2 * b;
  return sr / (tau + (den ? (a - c) / (2 * den) : 0));
}

function analyzeClip(clip) {
  const f = Math.max(1, Math.round(clip.sampleRate / 16000));
  const sr = clip.sampleRate / f;
  const n = Math.floor(clip.samples.length / f);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += clip.samples[i * f + k]; x[i] = s / f; }
  const size = Math.round(sr * 0.04), hop = Math.round(sr * 0.01);
  const frames = [];
  let maxRms = 0;
  for (let st = 0; st + size < n; st += hop) {
    let e = 0;
    for (let i = 0; i < size; i++) e += x[st + i] * x[st + i];
    const rms = Math.sqrt(e / size);
    frames.push({ rms, f0: 0 });
    if (rms > maxRms) maxRms = rms;
  }
  // Loudness reference = 95th percentile, not the max: one click (the tap on the mic button) used to set the
  // gate so high that a soft voice fell under it and the take came back "quiet".
  const sorted = frames.map(fr => fr.rms).sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || maxRms;
  const gate = Math.max(0.002, ref * 0.15), keep = Math.max(0.0015, ref * 0.06);
  const voicedN = () => frames.filter(fr => fr.f0 > 0).length;
  // 50 Hz floor: a low male tone 3 (mǎi, jǐ) dips into creak well under 70 Hz.
  // Hysteresis: once voiced, keep tracking down to a lower level, so the quiet falling tail of tone 4 isn't cut off.
  let on = false;
  frames.forEach((fr, i) => {
    if (fr.rms >= gate || (on && fr.rms >= keep)) fr.f0 = yin(x, sr, i * hop, size, 50);
    on = fr.f0 > 0;
  });
  const passes = [voicedN()];
  // Buzzy vowels (shì, zhè, cì) and creaky low tones are not periodic enough for the strict threshold: retry looser.
  for (const thr of [0.3, 0.45]) {
    if (voicedN() >= 12) break;
    frames.forEach((fr, i) => { if (!fr.f0 && fr.rms >= keep) fr.f0 = yin(x, sr, i * hop, size, 50, 500, thr); });
    passes.push(voicedN());
  }
  const diag = `len=${(n / sr).toFixed(1)}s max=${maxRms.toFixed(3)} p95=${ref.toFixed(3)} loud=${frames.filter(fr => fr.rms >= gate).length}/${frames.length} pitch=${passes.join('>')}`;
  return { frames, voiced: voicedN(), maxRms, diag };
}

function segmentVoiced(frames, n) {
  let segs = [], cur = null, gap = 99;
  frames.forEach((fr, i) => {
    if (fr.f0 > 0) {
      if (cur && gap <= 3) cur.end = i; else { cur = { start: i, end: i }; segs.push(cur); }
      gap = 0;
    } else gap++;
  });
  segs = segs.filter(s => s.end - s.start + 1 >= 6);
  while (segs.length > n) {
    let bi = 0, bg = Infinity;
    for (let i = 0; i < segs.length - 1; i++) { const g = segs[i + 1].start - segs[i].end; if (g < bg) { bg = g; bi = i; } }
    segs.splice(bi, 2, { start: segs[bi].start, end: segs[bi + 1].end });
  }
  if (segs.length === 1 && n === 2) {
    const s = segs[0], len = s.end - s.start;
    if (len >= 20) {
      let mi = -1, mv = Infinity;
      for (let i = s.start + Math.floor(len * 0.3); i <= s.start + Math.ceil(len * 0.7); i++) if (frames[i].rms < mv) { mv = frames[i].rms; mi = i; }
      segs = [{ start: s.start, end: mi - 1 }, { start: mi + 1, end: s.end }];
    }
  }
  return segs.length === n ? segs : null;
}

function fixOctaves(st) {
  const m = median(st);
  return st.map(v => { while (v - m > 7) v -= 12; while (m - v > 7) v += 12; return v; });
}
function medianFilter(a, k) {
  const r = k >> 1;
  return a.map((_, i) => median(a.slice(Math.max(0, i - r), i + r + 1)));
}
function bins(a, n) {
  if (!a.length) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const s = Math.floor(i * a.length / n), e = Math.max(s + 1, Math.floor((i + 1) * a.length / n));
    return mean(a.slice(s, e));
  });
}

// Chao 5-level contours: 1 = 55, 2 = 35, 3 = 214 (21 when not final), 4 = 51
const TPL = { 1: [5, 5, 5, 5, 5], 2: [3, 3.2, 3.6, 4.3, 5], 3: [2.2, 1.5, 1, 1.6, 3.2], '3h': [2.2, 1.7, 1.3, 1.1, 1], 4: [5, 4.3, 3.4, 2.4, 1.3] };
const tplSt = (key, step) => TPL[key].map(c => (c - 3) * step);

// Shape first, tuned on real learner recordings: learners move pitch far less than the textbook contours
// (a tone 4 that falls 3 semitones is heard as tone 4), and the "อา" calibration is a rough voice centre at best,
// so level only separates tone 1 (high/mid flat) from tone 3 (low).
function classifyTone(curve, hasProfile, step) {
  const c = curve, m = mean(c), mx = Math.max(...c), mn = Math.min(...c), imn = c.indexOf(mn);
  const fall = Math.max(c[0], c[1], c[2]) - c[4];
  const rise = c[4] - Math.min(c[0], c[1], c[2]);
  if (fall >= 2 && c[4] <= c[3] + 0.3 && rise < 1.5) return { tone: hasProfile && c[0] < -1 ? 3 : 4, margin: fall - 2 };
  // Right direction all the way but small: counted, flagged "weak" so the learner is told to exaggerate.
  const steps = c.slice(1).map((v, i) => v - c[i]);
  if (fall >= 1.5 && steps.every(d => d <= 0.3)) return { tone: 4, weak: true, margin: 0 };
  if (rise >= 1.5 && steps.every(d => d >= -0.3) && !(hasProfile && m < -1.5)) return { tone: 2, weak: true, margin: 0 };
  if (rise >= 2 && c[4] >= mx - 0.8) {
    // A deep dip (2.5+ semitones) is tone 3 at any height: yuǎn in log 11-04 dipped 2.6 but only to -0.9.
    const dipped = imn >= 1 && imn <= 3 && c[0] - mn >= 1.5 && (!hasProfile || mn < -1 || c[0] - mn >= 2.5);
    return { tone: dipped ? 3 : 2, margin: rise - 2 };
  }
  if (mx - mn < 2.5) return { tone: hasProfile && m < -1.5 ? 3 : 1, margin: 2.5 - (mx - mn) };
  return classifyByTemplate(curve, hasProfile, step);
}

function classifyByTemplate(curve, hasProfile, step) {
  const um = mean(curve);
  // Without a calibrated voice centre the level is unreliable, so judge almost purely by contour shape.
  const lw = hasProfile ? 0.45 : 0.03;
  const dist = key => {
    const t = tplSt(key, step), tm = mean(t);
    let s = 0;
    for (let i = 0; i < 5; i++) s += Math.abs((curve[i] - um) - (t[i] - tm));
    return s / 5 + lw * Math.abs(um - tm);
  };
  const d = { 1: dist(1), 2: dist(2), 3: Math.min(dist(3), dist('3h')), 4: dist(4) };
  const sorted = Object.entries(d).sort((a, b) => a[1] - b[1]);
  return { tone: +sorted[0][0], margin: sorted[1][1] - sorted[0][1] };
}

function toneCheck(clip, tones, pinyin) {
  const A = analyzeClip(clip);
  if (A.voiced < 8) return { reason: 'quiet', diag: A.diag };
  const segs = segmentVoiced(A.frames, tones.length);
  if (!segs) return { reason: 'segments' };
  const f0s = segs.flatMap(s => A.frames.slice(s.start, s.end + 1).map(f => f.f0).filter(Boolean));
  const ref = (S.pitchProfile && S.pitchProfile.medianHz) || median(f0s);
  const sts = segs.map(s => medianFilter(fixOctaves(A.frames.slice(s.start, s.end + 1).map(f => f.f0).filter(Boolean).map(f => 12 * Math.log2(f / ref))), 5));
  return judgeTones(sts, tones, pinyin);
}

// sts: one pitch track per syllable, in semitones around the voice centre.
function judgeTones(sts, tones, pinyin) {
  const step = ((S.pitchProfile && S.pitchProfile.rangeSt) || 10) / 4;
  const sp = spokenTones(tones);
  const py = pinyin ? sylls(pinyin) : [];
  // A word said lower than the "อา" calibration (tired voice, càidān in log 10-31) made every syllable "low",
  // so a flat tone 1 or a low-starting tone 4 came back as tone 3. With 2+ syllables and no tone 3 in the word,
  // the word itself is the reference: raise it until its middle sits at the voice centre.
  if (sts.length > 1 && !sp.some(t => t.tone === 3)) {
    const mid = median(sts.flat());
    if (mid < 0) { const up = Math.min(4, -mid); sts = sts.map(st => st.map(v => v + up)); }
  }
  const syl = sts.map((st, i) => {
    // Trim the consonant transition at the start, but keep almost all of the end, where tone 4 does its falling.
    // Unvoiced initials (c, t, sh…) have no transition to trim, and cutting there loses the high start of tone 4.
    const ini = py[i] ? splitSyl(py[i].text).ini : '';
    const head = /^[mnlrwy]?$/.test(ini) ? 0.15 : 0.06;
    const core = st.slice(Math.floor(st.length * head), st.length - Math.floor(st.length * 0.05));
    const curve = bins(core.length ? core : st, 5);
    const target = sp[i];
    if (target.tone === 5) return { target: 5, got: 5, ok: true, raw: st };
    const c = classifyTone(curve, !!S.pitchProfile, step);
    // Tone 3 is above all "low": a calibrated speaker staying well below their centre without a big rise counts.
    // So does the everyday "half" tone 3 at the end of a word (21: from mid down to low, no rise), e.g. suǒ in
    // cèsuǒ — as long as it doesn't start high like a tone 4.
    const half3 = Math.max(curve[0], curve[1]) <= 2 && curve[4] <= -2 && Math.min(...curve) === curve[4] &&
      (i === 0 || curve[0] < Math.max(...sts[i - 1]) - 3);
    const low3 = target.tone === 3 && S.pitchProfile && ((mean(curve) < -1.5 && curve[4] - curve[0] < 4) || half3);
    // Tone 4 that drops at least 1.5 semitones and then levels off (no rise after the low point) is still a fall.
    const mn = Math.min(...curve), imn = curve.indexOf(mn);
    const drop4 = target.tone === 4 && c.tone !== 4 && imn >= 2 && Math.max(curve[0], curve[1]) - mn >= 1.5 && curve[4] - mn <= 0.5;
    // Tone 1 drifting down up to 2 semitones (normal at the end of a word) is still level, as long as it isn't low.
    const flat1 = target.tone === 1 && c.tone !== 1 && Math.max(...curve) - mn <= 2 && mean(curve) >= -1.5;
    const got = low3 ? 3 : drop4 ? 4 : flat1 ? 1 : c.tone;
    return { target: target.tone, half: target.half, got, ok: got === target.tone, weak: drop4 || flat1 || (!low3 && !!c.weak), raw: st, curve };
  });
  return { ok: syl.every(r => r.ok), syl, step };
}

function calibrateFrom(clip) {
  const A = analyzeClip(clip);
  const f0s = A.frames.map(f => f.f0).filter(Boolean);
  if (f0s.length < 30) return null;
  S.pitchProfile = { medianHz: Math.round(median(f0s)), rangeSt: 10, samples: f0s.length };
  logI('tone', `calibrate ${S.pitchProfile.medianHz}Hz (${f0s.length} frames)`);
  save();
  return S.pitchProfile;
}
