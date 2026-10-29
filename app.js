'use strict';
/* พูดจีนรอดใน 20 วัน — app.js
 * Sections: Utils · Storage · Content · Pinyin · Sound · TTS · Recognition · Recorder · Pitch ·
 *           Game · Engine · UI kit · Views · Lesson · Router · Boot
 * Content lives in content/units.json — adding lessons never requires editing this file.
 */

// ============================================================ Utils
const $ = (s, el = document) => el.querySelector(s);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const params = new URLSearchParams(location.search);
const z2 = n => String(n).padStart(2, '0');
const dateStr = (d = new Date()) => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
const today = () => dateStr();
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return dateStr(new Date(y, m - 1, d + n)); }
function dayDiff(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = Math.random;
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (arr, n) => shuffle(arr).slice(0, n);
const uniq = arr => [...new Set(arr)];
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ============================================================ Storage
const STORE_KEY = 'pandaTalk.v1';
const SCHEMA = 1;
let storageOK = true;
try { localStorage.setItem('__pt', '1'); localStorage.removeItem('__pt'); } catch { storageOK = false; }

function defaultState() {
  return {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    onboarded: false,
    settings: {
      dailyGoalXp: 60, ttsRate: 0.9, voiceURI: null, showThai: true, showHanzi: true, sfx: true,
      micMode: 'auto', micSnoozeUntil: null, unlimitedHearts: false,
    },
    lessons: {},
    unlockedUpTo: null,
    xp: { total: 0, byDate: {} },
    streak: { current: 0, longest: 0, lastDate: null, freezes: 0 },
    hearts: { count: 5, updatedAt: Date.now(), lastFullRefillDate: null },
    srs: {},
    pitchProfile: null,
    toneStats: {},
    stats: { speakAuto: 0, speakAutoPass: 0, speakSelf: 0 },
    lastExportDate: null,
  };
}

// Future schema bumps transform old saves here.
function migrate(s) { return s; }

function normalizeState(s) {
  const base = defaultState();
  s = migrate(s);
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  for (const k of ['settings', 'xp', 'streak', 'hearts', 'stats']) s[k] = { ...base[k], ...s[k] };
  return s;
}

function loadState() {
  if (!storageOK) return defaultState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch { return defaultState(); }
}

let S = loadState();
let saveTimer = 0;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!storageOK) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { storageOK = false; logE('storage', errText(e)); toast('บันทึกความคืบหน้าไม่ได้ (พื้นที่เต็มหรือถูกปิด)'); }
}
addEventListener('pagehide', () => { saveNow(); Log.flush(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); Log.flush(); } });

// ============================================================ Debug log (ring buffer, kept across sessions → LINE / file)
const APP_VERSION = '1.3.1';
const LOG_KEY = 'pandaTalk.log';
const LOG_MAX = 400;
const safeJson = v => { try { return JSON.stringify(v); } catch { return String(v); } };
const Log = {
  items: [], timer: 0,
  load() { try { this.items = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { this.items = []; } },
  add(l, g, msg) {
    let m = typeof msg === 'string' ? msg : safeJson(msg);
    if (m.length > 600) m = m.slice(0, 600) + '…';
    this.items.push({ t: Date.now(), l, g, m });
    if (this.items.length > LOG_MAX) this.items.splice(0, this.items.length - LOG_MAX);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1000);
  },
  flush() { clearTimeout(this.timer); if (!storageOK) return; try { localStorage.setItem(LOG_KEY, JSON.stringify(this.items)); } catch {} },
  clear() { this.items = []; this.flush(); },
  errors() { return this.items.filter(e => e.l === 'E').length; },
};
if (storageOK) Log.load();
const logI = (g, m) => Log.add('I', g, m);
const logW = (g, m) => Log.add('W', g, m);
const logE = (g, m) => Log.add('E', g, m);
const errText = e => (e && (e.name ? e.name + ': ' : '') + (e.message || '')) || String(e);

let lastErrToast = 0;
function onAppError(msg) {
  logE('error', msg);
  if (Date.now() - lastErrToast > 30000) { lastErrToast = Date.now(); toast('เกิดข้อผิดพลาด 🐞', 0, { label: 'ส่ง log', fn: reportSheet }); }
}
addEventListener('error', e => onAppError(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}` +
  (e.error && e.error.stack ? '\n' + e.error.stack.split('\n').slice(0, 4).join('\n') : '')));
addEventListener('unhandledrejection', e => onAppError('promise: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
for (const [k, l] of [['error', 'E'], ['warn', 'W']]) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { Log.add(l, 'console', a.map(x => x instanceof Error ? x.stack || x.message : typeof x === 'string' ? x : safeJson(x)).join(' ')); orig(...a); };
}

// ============================================================ Content
const C = { items: {}, cats: {}, units: [], order: [], byId: {}, toneSets: [], itemUnit: {}, version: '' };

async function loadContent() {
  const res = await fetch('content/units.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  C.items = data.items || {};
  C.cats = data.categories || {};
  C.units = data.units || [];
  C.toneSets = data.toneSets || [];
  C.version = data.contentVersion || '';
  for (const [id, it] of Object.entries(C.items)) it.id = id;
  C.order = []; C.byId = {}; C.itemUnit = {};
  for (const u of C.units) {
    u.items = uniq(u.lessons.flatMap(l => l.newItems || []));
    const add = e => { e.index = C.order.length; C.order.push(e); C.byId[e.id] = e; };
    for (const l of u.lessons) add({ id: l.id, kind: 'lesson', unit: u, lesson: l, title: l.title });
    if (u.checkpoint) add({ id: u.checkpoint.id, kind: 'checkpoint', unit: u, lesson: u.checkpoint, title: u.checkpoint.final ? 'ด่านสอบสุดท้าย' : 'ด่านทบทวน' });
    for (const id of u.items) if (!C.itemUnit[id]) C.itemUnit[id] = u;
  }
}

function lintContent() {
  const issues = [];
  const ref = (id, where) => { if (!C.items[id]) issues.push(`${where}: ไม่พบคำ "${id}"`); };
  for (const [id, it] of Object.entries(C.items)) {
    for (const f of ['hanzi', 'pinyin', 'thai', 'meaning']) if (!it[f]) issues.push(`${id}: ขาด ${f}`);
    if (it.pinyin && !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(it.pinyin)) issues.push(`${id}: pinyin ไม่มีเครื่องหมายวรรณยุกต์`);
    if (it.pinyin && it.thai && words(it.pinyin).length !== words(it.thai).length)
      issues.push(`${id}: จำนวนคำ pinyin (${words(it.pinyin).length}) ไม่เท่าคำอ่านไทย (${words(it.thai).length})`);
  }
  const seen = new Set();
  for (const e of C.order) {
    if (seen.has(e.id)) issues.push(`id บทซ้ำ: ${e.id}`);
    seen.add(e.id);
    if (e.kind !== 'lesson') continue;
    (e.lesson.newItems || []).forEach(id => ref(id, e.id));
    (e.lesson.reviewItems || []).forEach(id => ref(id, e.id));
    for (const d of e.lesson.dialogs || []) for (const ln of d.lines) {
      if (ln.item) ref(ln.item, d.id);
      if (ln.answer) ref(ln.answer, d.id);
      (ln.distractors || []).forEach(id => ref(id, d.id));
    }
  }
  const used = new Set(C.units.flatMap(u => u.items));
  for (const [id, it] of Object.entries(C.items)) if (!it.npc && !used.has(id)) issues.push(`${id}: ยังไม่อยู่ในบทเรียนใด`);
  for (const u of C.units) if (u.items.length && u.items.length < 4 && !u.checkpoint?.final) issues.push(`${u.id}: คำใน unit น้อยกว่า 4 ตัวหลอกอาจไม่พอ`);
  return issues;
}

// ============================================================ Pinyin
const MARKS = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const V = 'aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const SYL_RE = new RegExp(`(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[${V}]+(?:ng|n(?![${V}])|r(?![${V}]))?`, 'gi');

function toneOf(s) {
  for (const ch of s.normalize('NFC')) { const i = MARKS.indexOf(ch.toLowerCase()); if (i >= 0) return (i % 4) + 1; }
  return 5;
}
const sylls = p => [...(p || '').matchAll(SYL_RE)].map(m => ({ text: m[0], tone: toneOf(m[0]) }));
const words = s => (s || '').trim().split(/\s+/).filter(Boolean);
const stripTones = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Tones as actually spoken: 3+3 → 2+3. (不/一 are already written with their changed tone in content.)
function spokenTones(tones) {
  const t = tones.slice();
  for (let i = 0; i < t.length - 1; i++) if (t[i] === 3 && t[i + 1] === 3) t[i] = 2;
  return t.map((tone, i) => ({ tone, half: tone === 3 && i < t.length - 1 }));
}

function pyEl(p, cls = '') {
  const el = h('span', { class: 'py ' + cls });
  let last = 0;
  for (const m of p.matchAll(SYL_RE)) {
    if (m.index > last) el.append(p.slice(last, m.index));
    el.append(h('span', { class: 't' + toneOf(m[0]) }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < p.length) el.append(p.slice(last));
  return el;
}

const TONE_NAME = { 1: 'เสียง 1 (สูงราบ)', 2: 'เสียง 2 (ขึ้น)', 3: 'เสียง 3 (ต่ำ)', 4: 'เสียง 4 (ตก)', 5: 'เสียงเบา' };
const TONE_HINT = {
  1: 'เสียง 1 ต้องสูงและราบ ลากเสียงสูงค้างไว้ — สูงกว่าเสียงสามัญของไทย',
  2: 'เสียง 2 ต้องไล่ขึ้น คล้ายเสียงจัตวา หรือตอนถามว่า "ห๊ะ?"',
  3: 'เสียง 3 ต้องกดต่ำลง คล้ายเสียงเอกลากยาว แล้วเชิดขึ้นนิดท้าย',
  4: 'เสียง 4 ต้องตกแรงจากสูงลงต่ำ คล้ายเสียงโทแบบสั่ง',
};

// ============================================================ Sound effects (Web Audio, no files)
let actx = null;
function audioCtx() {
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function sfx(kind) {
  if (!S.settings.sfx) return;
  const ctx = audioCtx();
  if (!ctx) return;
  const seq = {
    ok: [[660, 0], [880, 0.09]], bad: [[240, 0], [190, 0.12]], heart: [[330, 0], [220, 0.12]],
    done: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]], tap: [[520, 0]],
  }[kind];
  const t0 = ctx.currentTime;
  for (const [f, dt] of seq) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + dt); o.stop(t0 + dt + 0.22);
  }
}

// ============================================================ TTS (speechSynthesis)
const TTS = {
  supported: 'speechSynthesis' in window,
  voices: [], voice: null, unlocked: false,
  init() {
    if (!this.supported) return;
    const load = () => {
      const n = this.voices.length;
      this.voices = speechSynthesis.getVoices().filter(v => /^(zh[-_](cn|hans)|cmn)/i.test(v.lang));
      this.pick();
      if (this.voices.length !== n) logI('tts', `เสียงจีน ${this.voices.length}: ${this.voices.map(v => v.name + (v.localService ? '' : '(net)')).join(', ')} → ใช้ ${this.voice ? this.voice.name : '-'}`);
    };
    load();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', load) : (speechSynthesis.onvoiceschanged = load);
  },
  pick() {
    const pref = S.settings.voiceURI && this.voices.find(v => v.voiceURI === S.settings.voiceURI);
    const good = /enhanced|premium|ปรับปรุง|พรีเมียม|增强|高级/i;
    this.voice = pref || this.voices.find(v => v.localService && good.test(v.name)) ||
      this.voices.find(v => v.localService) || this.voices[0] || null;
  },
  unlock() {
    if (!this.supported || this.unlocked) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    this.unlocked = true;
  },
  speak(text, rate) {
    return new Promise(resolve => {
      if (!this.supported || !text) return resolve();
      // Safari may drop an utterance queued right after an unnecessary cancel()
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      if (this.voice) u.voice = this.voice;
      u.rate = rate || S.settings.ttsRate;
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      u.onend = fin;
      u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') logW('tts', `speak "${text}" error ${e.error}`); fin(); };
      setTimeout(fin, 2500 + text.length * 600);
      speechSynthesis.speak(u);
    });
  },
};

const speakText = it => (typeof it === 'string' ? it : it.hanzi).replace(/[…]/g, '').trim();
function play(it, slow = false) {
  if (it && it.audio && !slow) {
    const a = new Audio(it.audio);
    return a.play().catch(() => TTS.speak(speakText(it)));
  }
  return TTS.speak(speakText(it), slow ? 0.6 : undefined);
}

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
function scoreSpeech(item, alts) {
  const targets = [item.hanzi, ...(item.accept || [])].map(normZh).filter(Boolean);
  const rejects = (item.reject || []).map(normZh).filter(Boolean);
  let best = 0, heard = alts[0] || '', toneTrap = null;
  for (const raw of alts) {
    const a = normZh(raw);
    if (!a) continue;
    for (const t of targets) {
      const sim = a.includes(t) ? 1 : 1 - levenshtein(a, t) / Math.max(a.length, t.length);
      if (sim > best) { best = sim; heard = raw; }
    }
  }
  if (best < 0.8) {
    for (const raw of alts) {
      const a = normZh(raw);
      const r = rejects.find(x => a.includes(x) && !targets.some(t => a.includes(t)));
      if (r) { toneTrap = r; heard = raw; best = Math.min(best, 0.4); break; }
    }
  }
  return { best, heard, toneTrap };
}
function lookupHanzi(hz) {
  for (const it of Object.values(C.items)) if (normZh(it.hanzi) === hz) return { pinyin: it.pinyin, meaning: it.meaning };
  for (const ts of C.toneSets) { const i = ts.hanzi.indexOf(hz); if (i >= 0) return { pinyin: ts.pinyin[i], meaning: ts.meaning[i] }; }
  return null;
}

// ============================================================ Recorder (getUserMedia → Float32 samples)
// autoStop: end ~0.7 s after the speaker goes quiet (once some speech was heard) instead of waiting for maxMs.
function startRecording(maxMs, onLevel, { autoStop = false } = {}) {
  const ctl = { stop: () => { ctl.stopRequested = true; } };
  ctl.promise = (async () => {
    const ctx = audioCtx();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) Speech.micDenied = true;
      logW('mic', 'getUserMedia ' + errText(e));
      throw e;
    }
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const chunks = [];
    return new Promise(resolve => {
      let done = false, t = 0;
      const stop = () => {
        if (done) return;
        done = true; clearTimeout(t);
        proc.onaudioprocess = null;
        try { src.disconnect(); proc.disconnect(); mute.disconnect(); } catch {}
        stream.getTracks().forEach(tr => tr.stop());
        let len = 0;
        for (const c of chunks) len += c.length;
        const out = new Float32Array(len);
        let o = 0;
        for (const c of chunks) { out.set(c, o); o += c.length; }
        resolve({ samples: out, sampleRate: ctx.sampleRate });
      };
      const dt = 2048 / ctx.sampleRate;
      let noise = Infinity, voiced = 0, quiet = 0;
      proc.onaudioprocess = e => {
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
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
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
  const gate = Math.max(0.004, maxRms * 0.15);
  frames.forEach((fr, i) => { if (fr.rms >= gate) fr.f0 = yin(x, sr, i * hop, size); });
  return { frames, voiced: frames.filter(fr => fr.f0 > 0).length, maxRms };
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

function classifyTone(curve, hasProfile, step) {
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

function toneCheck(clip, tones) {
  const A = analyzeClip(clip);
  if (A.voiced < 8) return { reason: 'quiet' };
  const segs = segmentVoiced(A.frames, tones.length);
  if (!segs) return { reason: 'segments' };
  const f0s = segs.flatMap(s => A.frames.slice(s.start, s.end + 1).map(f => f.f0).filter(Boolean));
  const ref = (S.pitchProfile && S.pitchProfile.medianHz) || median(f0s);
  const step = ((S.pitchProfile && S.pitchProfile.rangeSt) || 10) / 4;
  const sp = spokenTones(tones);
  const syl = segs.map((s, i) => {
    let st = A.frames.slice(s.start, s.end + 1).map(f => f.f0).filter(Boolean).map(f => 12 * Math.log2(f / ref));
    st = medianFilter(fixOctaves(st), 5);
    const k = Math.floor(st.length * 0.1);
    const core = st.slice(k, st.length - k);
    const curve = bins(core.length ? core : st, 5);
    const target = sp[i];
    if (target.tone === 5) return { target: 5, got: 5, ok: true, raw: st };
    const c = classifyTone(curve, !!S.pitchProfile, step);
    // Tone 3 is above all "low": a calibrated speaker staying well below their centre without a big rise counts.
    const low3 = target.tone === 3 && S.pitchProfile && mean(curve) < -1.5 && curve[4] - curve[0] < 4;
    const got = low3 ? 3 : c.tone;
    return { target: target.tone, half: target.half, got, ok: got === target.tone, raw: st, curve };
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

// ============================================================ Game: hearts, XP, streak, SRS, progress
const HEART_MAX = 5, HEART_MS = 30 * 60 * 1000;
function hearts() {
  if (S.settings.unlimitedHearts) return Infinity;
  const H = S.hearts;
  if (H.count >= HEART_MAX) return HEART_MAX;
  const now = Math.max(Date.now(), H.updatedAt);
  const gained = Math.floor((now - H.updatedAt) / HEART_MS);
  if (gained > 0) {
    H.count = Math.min(HEART_MAX, H.count + gained);
    H.updatedAt = H.count >= HEART_MAX ? now : H.updatedAt + gained * HEART_MS;
    save();
  }
  return H.count;
}
function loseHeart() {
  if (S.settings.unlimitedHearts) return;
  if (hearts() >= HEART_MAX) S.hearts.updatedAt = Date.now();
  S.hearts.count = Math.max(0, S.hearts.count - 1);
  save();
}
function addHearts(n) {
  hearts();
  S.hearts.count = Math.min(HEART_MAX, S.hearts.count + n);
  if (S.hearts.count >= HEART_MAX) S.hearts.updatedAt = Date.now();
  save();
}
function nextHeartMs() { return Math.max(0, HEART_MS - (Math.max(Date.now(), S.hearts.updatedAt) - S.hearts.updatedAt)); }
const fmtMs = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`; };

const xpToday = () => S.xp.byDate[today()] || 0;
function addXp(n) {
  const t = today();
  const before = xpToday();
  S.xp.total += n;
  S.xp.byDate[t] = before + n;
  const cutoff = addDays(t, -60);
  for (const d of Object.keys(S.xp.byDate)) if (d < cutoff) delete S.xp.byDate[d];
  let goalHit = false;
  if (before < S.settings.dailyGoalXp && before + n >= S.settings.dailyGoalXp && S.hearts.lastFullRefillDate !== t) {
    S.hearts.lastFullRefillDate = t;
    addHearts(HEART_MAX);
    goalHit = true;
  }
  save();
  return goalHit;
}
function touchStreak() {
  const t = today(), st = S.streak;
  if (st.lastDate === t || xpToday() < S.settings.dailyGoalXp) return false;
  const gap = st.lastDate ? dayDiff(st.lastDate, t) : null;
  if (gap === 1) st.current++;
  else if (gap === 2 && st.freezes > 0) { st.freezes--; st.current++; }
  else st.current = 1;
  st.lastDate = t;
  st.longest = Math.max(st.longest, st.current);
  if (st.current % 5 === 0 && st.freezes < 2) st.freezes++;
  save();
  return true;
}
function streakShown() {
  const st = S.streak;
  if (!st.lastDate) return 0;
  const gap = dayDiff(st.lastDate, today());
  return gap <= 1 || (gap === 2 && st.freezes > 0) ? st.current : 0;
}

const BOX_DAYS = [0, 1, 2, 4, 7, 14];
function srsUpdate(id, ok) {
  if (!C.items[id] || C.items[id].npc) return;
  const r = S.srs[id] || (S.srs[id] = { box: 0, due: today(), right: 0, wrong: 0 });
  if (ok) { r.right++; r.box = Math.min(5, r.box + 1); } else { r.wrong++; r.box = 1; }
  r.due = addDays(today(), BOX_DAYS[r.box]);
  save();
}
const learnedIds = () => Object.keys(S.srs).filter(id => C.items[id] && !C.items[id].npc);
const dueIds = () => Object.entries(S.srs).filter(([id, r]) => C.items[id] && r.due <= today()).sort((a, b) => a[1].box - b[1].box).map(([id]) => id);
const weakIds = () => Object.entries(S.srs).filter(([id, r]) => C.items[id] && r.wrong > 0)
  .sort((a, b) => b[1].wrong / (b[1].right + b[1].wrong) - a[1].wrong / (a[1].right + a[1].wrong)).map(([id]) => id);

const isDone = id => !!S.lessons[id];
function unlockedIdx() { const e = S.unlockedUpTo && C.byId[S.unlockedUpTo]; return e ? e.index : 0; }
function unlockTo(idx) {
  if (idx > unlockedIdx() && C.order[idx]) { S.unlockedUpTo = C.order[idx].id; save(); }
}
function nodeState(e) {
  if (isDone(e.id)) return 'done';
  const u = unlockedIdx();
  if (e.index === u) return 'current';
  return e.index < u ? 'open' : 'locked';
}
const courseDone = () => C.order.length > 0 && C.order.every(e => isDone(e.id));

// ============================================================ Engine: build exercises
const meaningKey = m => (m || '').replace(/\s*\(.*?\)\s*/g, '').trim();

function distractorIds(item, n, pool = []) {
  const used = new Set([item.id]);
  const seenMeaning = new Set([meaningKey(item.meaning)]);
  const unit = C.itemUnit[item.id];
  const tiers = [pool, unit ? unit.items : [], learnedIds(), Object.keys(C.items)];
  const out = [];
  for (const tier of tiers) {
    for (const id of shuffle(tier)) {
      if (out.length >= n) return out;
      const it = C.items[id];
      if (!it || it.npc || used.has(id) || seenMeaning.has(meaningKey(it.meaning))) continue;
      out.push(id); used.add(id); seenMeaning.add(meaningKey(it.meaning));
    }
  }
  return out;
}

const mkListen = (it, pool) => ({ type: 'listen', item: it, options: shuffle([it.id, ...distractorIds(it, 3, pool)]) });
const mkMeaning = (it, pool) => ({ type: 'meaning', item: it, options: shuffle([it.id, ...distractorIds(it, 3, pool)]) });
const canBuild = it => words(it.pinyin).length >= 2 && !it.pinyin.includes('…');
function mkBuild(it) {
  const py = words(it.pinyin), th = words(it.thai);
  const tiles = py.map((w, i) => ({ py: w, th: th.length === py.length ? th[i] : '' }));
  const extra = [];
  for (const id of distractorIds(it, 6)) {
    const o = C.items[id];
    const opy = words(o.pinyin), oth = words(o.thai);
    opy.forEach((w, i) => {
      if (extra.length < 2 && w !== '…' && !py.includes(w) && !extra.some(x => x.py === w)) extra.push({ py: w, th: oth.length === opy.length ? oth[i] : '' });
    });
    if (extra.length >= 2) break;
  }
  return { type: 'build', item: it, answer: py, bank: shuffle(tiles.concat(extra)).map((t, k) => ({ ...t, k })) };
}
function mkMatch(items) { return { type: 'match', items: pick(items, Math.min(5, items.length)) }; }
function toneSetFor(items) {
  const hz = new Set(items.flatMap(it => [it.hanzi, ...(it.reject || [])]));
  return C.toneSets.find(ts => ts.hanzi.some(x => hz.has(x)));
}
function mkTone(set) {
  set = set || pick(C.toneSets, 1)[0];
  return set ? { type: 'tone', set, answer: Math.floor(rand() * set.hanzi.length) } : null;
}
const toneSpeakable = it => !it.npc && !it.pinyin.includes('…') && !/[A-Z]{2}|[a-z][A-Z]/.test(it.pinyin) &&
  sylls(it.pinyin).length >= 1 && sylls(it.pinyin).length <= 2 && sylls(it.pinyin).some(s => s.tone !== 5);
function mkToneSpeakItem(it) {
  return { type: 'tone_speak', target: { hanzi: it.hanzi, pinyin: it.pinyin, thai: it.thai, meaning: it.meaning, tones: sylls(it.pinyin).map(s => s.tone) } };
}
function mkToneSpeakSet(ts) {
  const i = Math.floor(rand() * ts.hanzi.length);
  return { type: 'tone_speak', target: { hanzi: ts.hanzi[i], pinyin: ts.pinyin[i], thai: ts.thai[i], meaning: ts.meaning[i], tones: sylls(ts.pinyin[i]).map(s => s.tone) } };
}
function expandDialog(d) {
  return d.lines.map((ln, i) => (ln.who === 'me' && C.items[ln.answer] ? { type: 'dialog', dialog: d, upto: i } : null)).filter(Boolean);
}
const items = ids => ids.map(id => C.items[id]).filter(it => it && !it.npc);

function mixedFor(its, n, pool, { speak = 1, tone = true } = {}) {
  const out = [];
  const list = shuffle(its);
  for (let k = 0; k < n && list.length; k++) {
    const it = list[k % list.length];
    const r = rand();
    out.push(canBuild(it) && r < 0.25 ? mkBuild(it) : r < 0.62 ? mkListen(it, pool) : mkMeaning(it, pool));
  }
  if (Speech.level() !== 'off') for (const it of pick(its, speak)) out.push({ type: 'speak', item: it });
  if (tone) { const t = mkTone(toneSetFor(its)); if (t) out.push(t); }
  return out;
}

function buildSession(mode, entry) {
  rand = params.has('seed') ? makeRng(+params.get('seed') || 1) : Math.random;
  const q = [];
  const speakOK = Speech.level() !== 'off';
  if (mode === 'lesson') {
    const L = entry.lesson;
    const news = items(L.newItems || []);
    const newIds = news.map(it => it.id);
    const reviewIds = uniq((L.reviewItems || []).concat(pick(dueIds().filter(id => !newIds.includes(id)), news.length ? 3 : 4)));
    const reviews = items(reviewIds);
    const pool = newIds.concat(reviewIds);
    for (const it of news) { q.push({ type: 'intro', item: it }); q.push(mkListen(it, pool)); }
    const p2 = [];
    for (const it of news) {
      p2.push(mkMeaning(it, pool));
      if (speakOK) p2.push({ type: 'speak', item: it });
      if (canBuild(it)) p2.push(mkBuild(it));
    }
    for (const it of reviews) {
      p2.push(rand() < 0.5 ? mkListen(it, pool) : mkMeaning(it, pool));
      if (!news.length && canBuild(it) && rand() < 0.5) p2.push(mkBuild(it));
    }
    if (!news.length && speakOK) for (const it of pick(reviews, 2)) p2.push({ type: 'speak', item: it });
    const ts = toneSetFor(news.concat(reviews));
    if (ts || rand() < 0.5) { const t = mkTone(ts); if (t) p2.push(t); }
    q.push(...shuffle(p2));
    const all = news.concat(reviews);
    if (all.length >= 4) q.push(mkMatch(all));
    const ttsItem = news.find(toneSpeakable);
    if (ttsItem && Speech.toneAvailable()) q.push(mkToneSpeakItem(ttsItem));
    for (const d of L.dialogs || []) q.push(...expandDialog(d));
  } else if (mode === 'checkpoint') {
    const final = !!entry.lesson.final;
    const ids = final ? uniq(C.units.flatMap(u => u.items)) : entry.unit.items;
    const its = items(ids);
    q.push(...shuffle(mixedFor(its, entry.lesson.size || 12, ids, { speak: final ? 3 : 2 })));
    if (its.length >= 4) q.push(mkMatch(its));
    if (final) {
      const dialogs = C.units.flatMap(u => u.lessons.flatMap(l => l.dialogs || []));
      for (const d of pick(dialogs, 2)) q.push(...expandDialog(d));
    }
  } else if (mode === 'review') {
    let ids = uniq(dueIds().concat(weakIds())).slice(0, 8);
    if (ids.length < 4) ids = uniq(ids.concat(pick(learnedIds(), 8))).slice(0, 8);
    const its = items(ids);
    q.push(...shuffle(mixedFor(its, 10, ids)));
    if (its.length >= 4) q.push(mkMatch(its));
  } else if (mode === 'skip') {
    const ids = uniq(C.units.filter(u => u.day < entry.unit.day).flatMap(u => u.items));
    const its = items(ids);
    for (const it of pick(its, 10)) q.push(rand() < 0.5 ? mkListen(it, ids) : mkMeaning(it, ids));
  } else if (mode === 'tone') {
    const speakable = items(learnedIds()).filter(toneSpeakable);
    for (let k = 0; k < 10; k++) {
      if (k % 2 === 0 || !Speech.toneAvailable()) { const t = mkTone(); if (t) q.push(t); }
      else q.push(speakable.length && rand() < 0.5 ? mkToneSpeakItem(pick(speakable, 1)[0]) : mkToneSpeakSet(pick(C.toneSets, 1)[0]));
    }
  }
  return { mode, entry, queue: q.map((ex, i) => ({ ...ex, uid: i })), i: 0, results: {}, xp: 0, combo: 0, heartsLost: 0, nextUid: q.length };
}

const GRADED = new Set(['listen', 'meaning', 'build', 'tone', 'dialog', 'match']);
const HEART_MODES = new Set(['lesson', 'checkpoint', 'skip']);

// ============================================================ UI kit
const screen = () => $('#screen');
let toastTimer = 0;
function toast(msg, ms = 2600, action) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, msg));
  if (action) el.append(h('button', { class: 'toast-btn', onclick: () => { el.classList.remove('show'); action.fn(); } }, action.label));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 9000 : ms);
}

function openSheet(content, { onClose } = {}) {
  const root = $('#sheet-root');
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); onClose && onClose(); };
  const wrap = h('div', { class: 'sheet-wrap' },
    h('div', { class: 'sheet-backdrop', onclick: close }),
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet-grip' }), content));
  root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return close;
}
function confirmBox(title, msg, ok = 'ตกลง', cancel = 'ยกเลิก', danger = false) {
  return new Promise(resolve => {
    let answered = false;
    const done = v => { if (!answered) { answered = true; resolve(v); } close(); };
    const close = openSheet(h('div', { class: 'confirm' },
      h('h3', {}, title), msg ? h('p', {}, msg) : null,
      h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => done(true) }, ok),
      h('button', { class: 'btn btn-ghost', onclick: () => done(false) }, cancel)),
    { onClose: () => { if (!answered) { answered = true; resolve(false); } } });
  });
}

function panda(mood = 'hi', size = 96) {
  const eyes = {
    happy: '<path d="M31 49q5-6 10 0M59 49q5-6 10 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
    party: '<path d="M31 49q5-6 10 0M59 49q5-6 10 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
    sleep: '<path d="M31 50h10M59 50h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  }[mood] || '<circle cx="36" cy="49" r="4.5" fill="#fff"/><circle cx="64" cy="49" r="4.5" fill="#fff"/><circle cx="37" cy="50" r="2.2" fill="#1d1d1d"/><circle cx="65" cy="50" r="2.2" fill="#1d1d1d"/>';
  const mouth = {
    hi: 'M43 68q7 7 14 0', happy: 'M41 67q9 10 18 0', party: 'M41 66q9 12 18 0', sad: 'M43 72q7-6 14 0',
    think: 'M46 70h8', sleep: 'M46 70q4 3 8 0',
  }[mood] || 'M43 68q7 7 14 0';
  const extra = {
    sad: '<path d="M70 58q3 6 0 9q-3-3 0-9z" fill="#5aa9e6"/>',
    think: '<text x="80" y="22" font-size="20" font-weight="700" fill="var(--brand)">?</text>',
    sleep: '<text x="76" y="20" font-size="14" font-weight="700" fill="var(--muted)">z</text><text x="84" y="12" font-size="10" font-weight="700" fill="var(--muted)">z</text>',
    party: '<rect x="8" y="10" width="5" height="9" fill="#f2b705" transform="rotate(-20 10 14)"/><rect x="86" y="30" width="5" height="9" fill="#0fa37f" transform="rotate(25 88 34)"/><circle cx="90" cy="12" r="3" fill="#d7263d"/><circle cx="12" cy="36" r="3" fill="#1c7ed6"/>',
  }[mood] || '';
  const svg = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="24" cy="24" r="13" fill="#1d1d1d"/><circle cx="76" cy="24" r="13" fill="#1d1d1d"/>
    <rect x="28" y="80" width="44" height="12" rx="6" fill="var(--brand)"/>
    <ellipse cx="50" cy="54" rx="38" ry="33" fill="#fff" stroke="#1d1d1d" stroke-width="2.5"/>
    <ellipse cx="36" cy="51" rx="10" ry="13" fill="#1d1d1d" transform="rotate(-28 36 51)"/>
    <ellipse cx="64" cy="51" rx="10" ry="13" fill="#1d1d1d" transform="rotate(28 64 51)"/>
    ${eyes}
    <circle cx="27" cy="64" r="5" fill="#ffb3c1" opacity=".7"/><circle cx="73" cy="64" r="5" fill="#ffb3c1" opacity=".7"/>
    <ellipse cx="50" cy="62" rx="5.5" ry="3.8" fill="#1d1d1d"/>
    <path d="${mouth}" stroke="#1d1d1d" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    ${extra}</svg>`;
  const el = h('div', { class: 'panda' });
  el.innerHTML = svg;
  return el;
}
const pandaSay = (mood, text) => h('div', { class: 'panda-say' }, panda(mood, 72), h('div', { class: 'bubble' }, text));

function toneShapes(tones) {
  const path = { 1: 'M3 5H25', 2: 'M3 19L25 4', 3: 'M3 10L12 20L25 6', 4: 'M3 4L25 21', 5: 'M13 13h1' };
  return h('div', { class: 'tone-shapes' }, ...tones.map(t => {
    const s = h('span', { class: 'shape t' + t });
    s.innerHTML = `<svg viewBox="0 0 28 24" width="28" height="24"><path d="${path[t]}" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return s;
  }));
}

function playBtns(it) {
  return h('div', { class: 'play-row' },
    h('button', { class: 'btn-play', 'aria-label': 'ฟังเสียง', onclick: () => play(it) }, '🔊'),
    h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(it, true) }, '🐢'));
}
function wordCard(it, { big = true } = {}) {
  return h('div', { class: 'word' + (big ? ' big' : '') },
    h('div', { class: 'word-py' }, pyEl(it.pinyin)),
    S.settings.showThai ? h('div', { class: 'word-th' }, it.thai) : null,
    h('div', { class: 'word-mean' }, it.meaning),
    S.settings.showHanzi && it.hanzi ? h('button', { class: 'hanzi-chip', 'aria-label': 'ขยายตัวจีนเพื่อให้คนจีนดู', onclick: () => showCard(it) }, it.hanzi, h('span', { class: 'chip-ic' }, ' ⤢')) : null);
}

// S10 — show-to-locals card
let wakeLock = null;
async function showCard(it) {
  const el = $('#card');
  const close = () => { el.hidden = true; el.replaceChildren(); try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; };
  el.replaceChildren(h('div', { class: 'card-inner' },
    h('button', { class: 'icon-btn card-close', 'aria-label': 'ปิด', onclick: close }, '✕'),
    h('div', { class: 'card-hanzi', lang: 'zh-CN' }, it.hanzi.replace('…', ' …')),
    h('div', { class: 'card-py' }, pyEl(it.pinyin)),
    h('div', { class: 'card-th' }, it.thai + ' · ' + it.meaning),
    h('button', { class: 'btn btn-primary card-play', onclick: () => TTS.speak(speakText(it), 0.85) }, '🔊 เล่นเสียงให้ฟัง')));
  el.hidden = false;
  try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}

// ============================================================ Views
let phraseState = { q: '', cat: 'all' };

function heartsLabel() { const n = hearts(); return n === Infinity ? '∞' : String(n); }
function topStats() {
  const goal = S.settings.dailyGoalXp, x = xpToday();
  return h('header', { class: 'topstats' },
    h('button', { class: 'stat', onclick: streakSheet, 'aria-label': 'สตรีค' }, '🔥 ', h('b', {}, streakShown())),
    h('div', { class: 'goal', 'aria-label': `เป้าวันนี้ ${x}/${goal} XP` },
      h('div', { class: 'goal-bar' }, h('i', { style: `width:${Math.min(100, x / goal * 100)}%` })),
      h('small', {}, `${Math.min(x, goal)}/${goal} XP วันนี้`)),
    h('button', { class: 'stat', onclick: heartsSheet, 'aria-label': 'หัวใจ' }, '❤️ ', h('b', {}, heartsLabel())));
}
function streakSheet() {
  const st = S.streak;
  openSheet(h('div', { class: 'info-sheet' }, h('h3', {}, `🔥 สตรีค ${streakShown()} วัน`),
    h('p', {}, `ทำครบเป้า ${S.settings.dailyGoalXp} XP ในวันเดียวเพื่อนับสตรีค · ยาวสุด ${st.longest} วัน`),
    h('p', {}, `🎋 ไม้ไผ่กันขาด: ${st.freezes}/2 (ได้ 1 อันทุก 5 วันติด — ช่วยให้สตรีคไม่ขาดถ้าพลาด 1 วัน)`)));
}
function heartsSheet() {
  const n = hearts();
  openSheet(h('div', { class: 'info-sheet' }, h('h3', {}, `❤️ หัวใจ ${n === Infinity ? 'ไม่จำกัด' : n + '/' + HEART_MAX}`),
    h('p', {}, 'ตอบผิดในบทเรียนใหม่ = เสีย 1 ดวง (ข้อพูดไม่หักหัวใจ)'),
    n !== Infinity && n < HEART_MAX ? h('p', {}, `ดวงถัดไปในอีก ${fmtMs(nextHeartMs())}`) : null,
    h('p', {}, 'เติมได้: ทบทวนจบ 1 บท = +1 · ห้องฝึกวรรณยุกต์ = +1 · ครบเป้า XP วันนี้ = เต็ม'),
    n !== Infinity && n < HEART_MAX ? h('button', { class: 'btn btn-primary', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession('review'); } }, '🔁 ทบทวนเพื่อเติมหัวใจ') : null));
}

function renderLearn() {
  const wrap = h('div', { class: 'learn' }, topStats());
  if (!storageOK) wrap.append(h('div', { class: 'warn' }, '⚠️ เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้ ความคืบหน้าจะหายเมื่อปิดแอป'));
  if (isIOS && !isStandalone() && S.onboarded) wrap.append(h('button', { class: 'warn', onclick: installGuideSheet }, '📲 เพิ่มลงหน้าจอโฮม เพื่อไม่ให้ความคืบหน้าหาย — แตะดูวิธี'));
  if (S.lastExportDate === null ? Object.keys(S.lessons).length >= 6 : dayDiff(S.lastExportDate, today()) >= 5)
    wrap.append(h('button', { class: 'warn soft', onclick: exportProgress }, '💾 สำรองความคืบหน้า (แนะนำทุก 5 วัน) — แตะเพื่อบันทึกไฟล์'));
  let lastStage = null;
  let currentEl = null;
  for (const u of C.units) {
    if (u.stage !== lastStage) { wrap.append(h('div', { class: 'stage' }, u.stage)); lastStage = u.stage; }
    const entries = C.order.filter(e => e.unit === u);
    const unitDone = entries.every(e => isDone(e.id));
    const path = h('div', { class: 'path' });
    entries.forEach((e, k) => {
      const st = nodeState(e);
      const off = [0, 46, 0, -46][k % 4];
      const rec = S.lessons[e.id];
      const ic = e.kind === 'checkpoint' ? '👑' : st === 'locked' ? '🔒' : st === 'done' ? '✓' : '▶';
      const node = h('div', { class: 'node-wrap', style: `transform:translateX(${off}px)` },
        st === 'current' ? h('div', { class: 'node-tip' }, 'เริ่มตรงนี้') : null,
        h('button', { class: `node ${st} ${e.kind}`, 'aria-label': `${e.title} (${{ done: 'จบแล้ว', current: 'บทถัดไป', open: 'เปิดแล้ว', locked: 'ล็อค' }[st]})`, onclick: () => openNode(e) }, ic),
        rec && !rec.skipped ? h('div', { class: 'stars' }, '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars)) : null);
      if (st === 'current') currentEl = node;
      path.append(node);
    });
    wrap.append(h('section', { class: 'unit' + (unitDone ? ' done' : '') },
      h('div', { class: 'unit-head' }, h('div', { class: 'unit-day' }, `วันที่ ${u.day}`), h('div', { class: 'unit-title' }, u.title), h('div', { class: 'unit-goal' }, u.goal)),
      path));
  }
  if (courseDone()) wrap.append(h('section', { class: 'unit finish' }, pandaSay('party', 'จบหลักสูตร 20 วันแล้ว! ทบทวนและฝึกวรรณยุกต์ต่อได้ในแท็บทบทวน'),
    h('button', { class: 'btn btn-primary', onclick: certificateSheet }, '🏅 ดูใบประกาศ')));
  else wrap.append(h('p', { class: 'muted center' }, 'บทเรียนวันที่ 21+ จะเพิ่มในอนาคต'));
  screen().replaceChildren(wrap);
  if (currentEl && !renderLearn.scrolled) { renderLearn.scrolled = true; setTimeout(() => currentEl.scrollIntoView({ block: 'center' }), 50); }
}

function openNode(e) {
  const st = nodeState(e);
  if (st === 'locked') {
    const first = C.order.find(x => x.unit === e.unit);
    if (first === e && e.unit.day > 1) {
      openSheet(h('div', { class: 'info-sheet' },
        h('h3', {}, `ข้ามไปวันที่ ${e.unit.day}?`),
        h('p', {}, `ทำแบบทดสอบ 10 ข้อจากวันที่ 1–${e.unit.day - 1} ถูก 80% ขึ้นไปจะปลดล็อคถึงวันนี้`),
        h('button', { class: 'btn btn-primary', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession('skip', e); } }, '⚡ เริ่มทดสอบข้าม')));
    } else toast('ทำบทก่อนหน้าให้จบก่อนนะ 🐼');
    return;
  }
  const rec = S.lessons[e.id];
  const its = items(e.kind === 'lesson' ? (e.lesson.newItems || []) : e.unit.items);
  openSheet(h('div', { class: 'info-sheet' },
    h('div', { class: 'muted' }, `วันที่ ${e.unit.day} · ${e.unit.title}`),
    h('h3', {}, e.title),
    rec ? h('div', { class: 'stars big' }, '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars)) : null,
    its.length ? h('div', { class: 'chips' }, ...its.slice(0, 8).map(it => h('span', { class: 'chip' }, it.meaning))) : h('p', {}, 'สถานการณ์จำลอง ใช้ทุกอย่างที่เรียนมา'),
    h('button', { class: 'btn btn-primary', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession(e.kind === 'checkpoint' ? 'checkpoint' : 'lesson', e); } }, rec ? 'เล่นอีกครั้ง' : 'เริ่มเรียน')));
}

function renderPhrases() {
  const list = h('div', { class: 'phrase-list' });
  const learned = new Set(learnedIds());
  const all = Object.values(C.items).filter(it => !it.npc).sort((a, b) => (C.itemUnit[a.id]?.day || 99) - (C.itemUnit[b.id]?.day || 99));
  const draw = () => {
    const q = stripTones(phraseState.q.trim());
    const rows = all.filter(it => {
      if (phraseState.cat === 'survival' && !it.survival) return false;
      if (phraseState.cat !== 'all' && phraseState.cat !== 'survival' && it.cat !== phraseState.cat) return false;
      if (!q) return true;
      return [it.meaning, it.thai, it.hanzi, stripTones(it.pinyin).replace(/\s/g, ''), stripTones(it.pinyin)].some(s => s.toLowerCase().includes(q));
    });
    list.replaceChildren(...(rows.length ? rows.map(it => h('div', { class: 'phrase' + (learned.has(it.id) ? ' learned' : '') },
      h('button', { class: 'phrase-main', onclick: () => showCard(it), 'aria-label': `ขยาย ${it.meaning}` },
        h('div', { class: 'phrase-mean' }, it.meaning, learned.has(it.id) ? h('span', { class: 'ok' }, ' ✓') : null),
        h('div', { class: 'phrase-py' }, pyEl(it.pinyin), S.settings.showThai ? h('span', { class: 'phrase-th' }, ' · ' + it.thai) : null),
        h('div', { class: 'phrase-hz', lang: 'zh-CN' }, it.hanzi)),
      h('button', { class: 'btn-play', 'aria-label': 'ฟังเสียง', onclick: () => play(it) }, '🔊'))) : [h('p', { class: 'muted center' }, 'ไม่พบวลีที่ค้นหา')]));
  };
  const chip = (key, label) => h('button', { class: 'chip-btn' + (phraseState.cat === key ? ' on' : ''), onclick: () => { phraseState.cat = key; renderPhrases(); } }, label);
  const input = h('input', { type: 'search', class: 'search', placeholder: 'ค้นหา เช่น ห้องน้ำ, เผ็ด, xie', value: phraseState.q, 'aria-label': 'ค้นหาวลี' });
  input.addEventListener('input', () => { phraseState.q = input.value; draw(); });
  screen().replaceChildren(h('div', { class: 'phrases' },
    h('h2', { class: 'page-title' }, 'การ์ดพูด'),
    h('p', { class: 'muted' }, 'แตะวลีเพื่อขยายตัวจีนให้คนจีนดู ใช้ได้แม้ไม่มีเน็ต'),
    input,
    h('div', { class: 'chips scroll' }, chip('all', 'ทั้งหมด'), chip('survival', '⭐ เอาตัวรอด'),
      ...Object.entries(C.cats).map(([k, c]) => chip(k, `${c.icon} ${c.title}`))),
    list));
  draw();
}

function toneStatBars() {
  return h('div', { class: 'tone-stats' }, ...[1, 2, 3, 4].map(t => {
    const s = S.toneStats[t] || { ok: 0, n: 0 };
    const pct = s.n ? Math.round(s.ok / s.n * 100) : 0;
    return h('div', { class: 'tone-stat' }, h('span', { class: 't' + t }, TONE_NAME[t]),
      h('div', { class: 'bar' }, h('i', { class: 'bg-t' + t, style: `width:${pct}%` })), h('small', {}, s.n ? `${pct}% (${s.n})` : '—'));
  }));
}

function renderReview() {
  const due = dueIds(), learned = learnedIds();
  const weak = weakIds().slice(0, 6).map(id => C.items[id]);
  screen().replaceChildren(h('div', { class: 'review' },
    h('h2', { class: 'page-title' }, 'ทบทวน'),
    h('section', { class: 'card-box' },
      h('h3', {}, `🔁 คำที่ถึงเวลาทบทวน: ${due.length} คำ`),
      h('p', { class: 'muted' }, 'ทบทวนไม่เสียหัวใจ และจบ 1 บทได้หัวใจคืน +1'),
      h('button', { class: 'btn btn-primary', disabled: learned.length < 3, onclick: () => startSession('review') }, learned.length < 3 ? 'เรียนบทแรกก่อน' : 'เริ่มทบทวน')),
    h('section', { class: 'card-box' },
      h('h3', {}, '🎵 ห้องฝึกวรรณยุกต์'),
      h('p', { class: 'muted' }, Speech.toneAvailable() ? 'ฟังแยกเสียง + พูดแล้วดูเส้นเสียงของคุณเทียบกับเป้าหมาย (ทดลอง)' : 'ฝึกฟังแยกวรรณยุกต์ (เปิดสิทธิ์ไมค์เพื่อฝึกพูดด้วย)'),
      toneStatBars(),
      h('button', { class: 'btn btn-jade', onclick: () => startSession('tone') }, 'เข้าห้องฝึก')),
    weak.length ? h('section', { class: 'card-box' }, h('h3', {}, '😵 คำที่ผิดบ่อย'),
      ...weak.map(it => h('div', { class: 'phrase' }, h('button', { class: 'phrase-main', onclick: () => showCard(it) },
        h('div', { class: 'phrase-mean' }, it.meaning), h('div', { class: 'phrase-py' }, pyEl(it.pinyin), ' · ' + it.thai)),
        h('button', { class: 'btn-play', onclick: () => play(it) }, '🔊')))) : null));
}

function renderMe() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const maxXp = Math.max(S.settings.dailyGoalXp, ...days.map(d => S.xp.byDate[d] || 0));
  const st = S.stats;
  const wd = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  screen().replaceChildren(h('div', { class: 'me' },
    h('div', { class: 'me-head' }, panda('happy', 80), h('div', {}, h('h2', { class: 'page-title' }, 'ความคืบหน้า'),
      h('p', { class: 'muted' }, `เรียนแล้ว ${C.order.filter(e => isDone(e.id)).length}/${C.order.length} บท`)),
      h('button', { class: 'icon-btn', 'aria-label': 'ตั้งค่า', onclick: () => { location.hash = '#/settings'; } }, '⚙️')),
    h('div', { class: 'stat-grid' },
      statCard('🔥', streakShown(), 'สตรีค (วัน)'), statCard('🏆', S.streak.longest, 'สตรีคยาวสุด'),
      statCard('⚡', S.xp.total, 'XP ทั้งหมด'), statCard('📚', learnedIds().length, 'คำที่รู้'),
      statCard('🎙️', st.speakAuto ? Math.round(st.speakAutoPass / st.speakAuto * 100) + '%' : '—', 'พูดผ่าน (ตรวจอัตโนมัติ)'),
      statCard('🗣️', st.speakSelf, 'พูดแบบตรวจเอง')),
    h('section', { class: 'card-box' }, h('h3', {}, 'XP 7 วันล่าสุด'),
      h('div', { class: 'week' }, ...days.map(d => {
        const v = S.xp.byDate[d] || 0;
        const [y, m, dd] = d.split('-').map(Number);
        return h('div', { class: 'day' + (d === today() ? ' today' : '') }, h('div', { class: 'col' }, h('i', { style: `height:${v / maxXp * 100}%` })), h('small', {}, wd[new Date(y, m - 1, dd).getDay()]));
      }))),
    h('section', { class: 'card-box' }, h('h3', {}, 'ความแม่นวรรณยุกต์ (จากข้อพูด)'), toneStatBars()),
    h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/settings'; } }, '⚙️ ตั้งค่า & สำรองข้อมูล'),
    h('button', { class: 'btn btn-ghost', onclick: reportSheet }, '🐞 รายงานปัญหา / ส่ง log'),
    updateBtn()));
}
const statCard = (ic, v, label) => h('div', { class: 'stat-card' }, h('div', { class: 'sc-ic' }, ic), h('b', {}, v), h('small', {}, label));

function renderSettings() {
  const s = S.settings;
  const set = (k, v) => { s[k] = v; save(); };
  const toggle = (k, label) => h('label', { class: 'row' }, h('span', {}, label),
    h('input', { type: 'checkbox', class: 'switch', checked: s[k], onchange: e => { set(k, e.target.checked); if (k === 'unlimitedHearts') renderSettings(); } }));
  const voiceSel = h('select', { 'aria-label': 'เลือกเสียง', onchange: e => { set('voiceURI', e.target.value || null); TTS.pick(); TTS.speak('你好'); } },
    h('option', { value: '' }, 'อัตโนมัติ'), ...TTS.voices.map(v => h('option', { value: v.voiceURI, selected: s.voiceURI === v.voiceURI }, `${v.name}${v.localService ? '' : ' (ออนไลน์)'}`)));
  const rate = h('input', { type: 'range', min: '0.5', max: '1.2', step: '0.1', value: s.ttsRate, 'aria-label': 'ความเร็วเสียง' });
  rate.addEventListener('change', () => { set('ttsRate', +rate.value); TTS.speak('谢谢'); });
  const micSel = h('select', { 'aria-label': 'โหมดไมค์', onchange: e => { set('micMode', e.target.value); renderSettings(); } },
    ...[['auto', 'อัตโนมัติ (แนะนำ)'], ['record', 'อัดเสียงแล้วฟังเทียบเอง'], ['manual', 'พูดแล้วกดยืนยันเอง'], ['off', 'ปิดข้อพูด']]
      .map(([v, l]) => h('option', { value: v, selected: s.micMode === v }, l)));
  const lvl = Speech.level();
  const lvlText = { A: 'A — ระบบตรวจคำให้อัตโนมัติ', B: 'B — อัดเสียงแล้วฟังเทียบเอง', C: 'C — พูดแล้วกดยืนยันเอง', off: 'ปิด / พักไมค์อยู่' }[lvl];
  const micTest = h('div', { class: 'muted' });
  const goalSel = h('div', { class: 'seg' }, ...[30, 60, 90].map(g => h('button', { class: s.dailyGoalXp === g ? 'on' : '', onclick: () => { set('dailyGoalXp', g); renderSettings(); } }, `${g} XP`)));
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => importProgress(e.target.files[0]) });
  screen().replaceChildren(h('div', { class: 'settings' },
    h('div', { class: 'back-row' }, h('button', { class: 'icon-btn', 'aria-label': 'กลับ', onclick: () => { location.hash = '#/me'; } }, '←'), h('h2', { class: 'page-title' }, 'ตั้งค่า')),
    h('section', { class: 'card-box' }, h('h3', {}, 'เวอร์ชันแอป'),
      h('p', { class: 'muted' }, `ตอนนี้: ${APP_VERSION} · เนื้อหา ${C.version}`),
      updateBtn('btn btn-jade')),
    h('section', { class: 'card-box' }, h('h3', {}, 'เป้าหมายรายวัน'), goalSel),
    h('section', { class: 'card-box' }, h('h3', {}, 'การแสดงผล'),
      toggle('showThai', 'แสดงคำอ่านไทย'), toggle('showHanzi', 'แสดงตัวจีน (ตัวเล็ก)'), toggle('sfx', 'เสียงเอฟเฟกต์')),
    h('section', { class: 'card-box' }, h('h3', {}, 'เสียงจีน (TTS)'),
      h('p', { class: 'muted' }, TTS.voices.length ? `พบเสียงจีน ${TTS.voices.length} เสียง · ใช้: ${TTS.voice ? TTS.voice.name : '-'}` : '⚠️ ไม่พบเสียงจีนในเครื่อง — ดูวิธีติดตั้งในหน้าช่วยเหลือ'),
      h('label', { class: 'row' }, h('span', {}, 'เสียง'), voiceSel),
      h('label', { class: 'row' }, h('span', {}, 'ความเร็ว'), rate),
      h('button', { class: 'btn btn-ghost', onclick: () => TTS.speak('你好，欢迎来中国') }, '🔊 ทดสอบเสียง')),
    h('section', { class: 'card-box' }, h('h3', {}, 'ไมค์ & ข้อพูด'),
      h('label', { class: 'row' }, h('span', {}, 'โหมด'), micSel),
      h('p', { class: 'muted' }, 'ระดับที่ใช้ได้ตอนนี้: ' + lvlText),
      h('p', { class: 'muted' }, 'ตรวจวรรณยุกต์: ' + (Speech.toneAvailable() ? 'ใช้ได้' : 'ใช้ไม่ได้ (ต้องมีสิทธิ์ไมค์)') + (S.pitchProfile ? ` · ปรับเสียงแล้ว (${S.pitchProfile.medianHz} Hz)` : ' · ยังไม่ได้ปรับเสียง')),
      s.micSnoozeUntil && Date.now() < s.micSnoozeUntil ? h('button', { class: 'btn btn-ghost', onclick: () => { set('micSnoozeUntil', null); renderSettings(); } }, '🎙️ เปิดไมค์กลับตอนนี้') : null,
      h('button', { class: 'btn btn-ghost', onclick: () => testMic(micTest) }, '🎙️ ทดสอบไมค์'), micTest,
      S.pitchProfile ? h('button', { class: 'btn btn-ghost', onclick: () => { S.pitchProfile = null; save(); toast('จะปรับเสียงใหม่ในข้อฝึกวรรณยุกต์ครั้งถัดไป'); renderSettings(); } }, '🎚️ ปรับเสียงวรรณยุกต์ใหม่') : null),
    h('section', { class: 'card-box' }, h('h3', {}, 'หัวใจ'),
      toggle('unlimitedHearts', 'หัวใจไม่จำกัด (สำหรับช่วงรีบก่อนเดินทาง)')),
    h('section', { class: 'card-box' }, h('h3', {}, 'สำรอง & ย้ายเครื่อง'),
      h('p', { class: 'muted' }, S.lastExportDate ? `สำรองล่าสุด: ${S.lastExportDate}` : 'ยังไม่เคยสำรอง'),
      h('button', { class: 'btn btn-jade', onclick: exportProgress }, '💾 บันทึกไฟล์สำรอง'),
      h('button', { class: 'btn btn-ghost', onclick: () => file.click() }, '📂 นำเข้าไฟล์สำรอง'), file,
      isIOS && !isStandalone() ? h('button', { class: 'btn btn-ghost', onclick: installGuideSheet }, '📲 วิธีเพิ่มลงหน้าจอโฮม') : null),
    h('section', { class: 'card-box' }, h('h3', {}, '🐞 เจอบั๊ก?'),
      h('p', { class: 'muted' }, `แอปเก็บ log การใช้งานล่าสุดไว้ในเครื่อง (${Log.items.length} บรรทัด · ข้อผิดพลาด ${Log.errors()} ครั้ง)`),
      h('button', { class: 'btn btn-line', onclick: reportSheet }, '💬 รายงานปัญหา / ส่ง log ทาง LINE')),
    h('section', { class: 'card-box' },
      h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/help'; } }, '❓ ช่วยเหลือ: เสียง & ไมค์'),
      h('button', { class: 'btn btn-danger-ghost', onclick: resetAll }, '🗑️ ล้างความคืบหน้าทั้งหมด')),
    h('p', { class: 'muted center' }, `แอป ${APP_VERSION} · เนื้อหา ${C.version} · ${Object.values(C.items).filter(i => !i.npc).length} วลี`)));
}

async function testMic(out) {
  if (SR && !Speech.srBroken && S.settings.micMode === 'auto') {
    out.textContent = 'พูดว่า "你好 nǐ hǎo" ได้เลย…';
    try { const alts = await Speech.recognize({ timeoutMs: 5000 }); out.textContent = `✅ ระบบตรวจคำใช้ได้ ได้ยินว่า: ${alts[0]}`; return; }
    catch (e) { out.textContent = `ระบบตรวจคำใช้ไม่ได้ (${e}) — ลองอัดเสียงแทน…`; if (e !== 'no-speech') Speech.srBroken = true; }
  }
  if (!Mic.supported()) { out.textContent = '❌ เบราว์เซอร์นี้อัดเสียงไม่ได้ — ใช้โหมดพูดแล้วกดยืนยันเอง'; return; }
  try {
    out.textContent = 'กำลังอัด 2 วินาที พูดอะไรก็ได้…';
    let peak = 0;
    const clip = await startRecording(2000, l => { peak = Math.max(peak, l); }).promise;
    out.textContent = peak > 0.02 ? '✅ ไมค์ใช้ได้ (กำลังเล่นเสียงที่อัด)' : '⚠️ เสียงเบามาก ลองพูดใกล้ไมค์';
    playClip(clip);
  } catch { out.textContent = '❌ ไม่ได้รับสิทธิ์ใช้ไมค์ — เปิดได้ที่ ตั้งค่า iPhone → Safari → ไมโครโฟน'; }
}

function renderHelp() {
  const sec = (title, ...ps) => h('section', { class: 'card-box' }, h('h3', {}, title), ...ps.map(p => h('p', {}, p)));
  screen().replaceChildren(h('div', { class: 'help' },
    h('div', { class: 'back-row' }, h('button', { class: 'icon-btn', 'aria-label': 'กลับ', onclick: () => history.back() }, '←'), h('h2', { class: 'page-title' }, 'ช่วยเหลือ')),
    sec('📲 ติดตั้งบน iPhone', 'เปิดเว็บนี้ใน Safari → แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) → "เพิ่มลงหน้าจอโฮม" → เปิดแอปจากไอคอนแพนด้าทุกครั้ง',
      'สำคัญ: ความคืบหน้าในแท็บ Safari กับในแอปที่ติดตั้งแยกกัน และข้อมูลในแท็บ Safari อาจถูกลบถ้าไม่ได้เปิด 7 วัน'),
    sec('🔊 เสียงจีนชัดขึ้น (ฟรี)', 'iPhone: ตั้งค่า → การช่วยการเข้าถึง → เนื้อหาที่พูด → เสียง → จีน (จีนแผ่นดินใหญ่) → ดาวน์โหลดเสียงแบบ "ปรับปรุง" หรือ "พรีเมียม" แล้วกลับมาเลือกในหน้าตั้งค่าของแอป',
      'เสียงที่ดาวน์โหลดไว้ใช้ได้แม้ไม่มีเน็ต รวมถึงตอนอยู่ในจีน'),
    sec('🎙️ ระบบตรวจคำพูด', 'ต้องเปิด: ตั้งค่า → ทั่วไป → แป้นพิมพ์ → "เปิดใช้การป้อนตามคำบอก" และเพิ่มแป้นพิมพ์จีน (ตัวย่อ)',
      'ถ้าใช้ไม่ได้ แอปจะเปลี่ยนเป็น "อัดเสียงแล้วฟังเทียบเอง" ให้อัตโนมัติ',
      'ระบบนี้อาจต้องใช้เน็ต และอาจใช้ไม่ได้ในจีน — แต่ทุกอย่างอื่นในแอปใช้ออฟไลน์ได้'),
    sec('🎵 ตรวจวรรณยุกต์ (ทดลอง)', 'ทำงานบนเครื่องล้วน ไม่ส่งเสียงไปไหน วัดเส้นเสียงสูง-ต่ำของคุณเทียบกับรูปแบบวรรณยุกต์ 4 เสียง',
      'แม่นสุดเมื่อพูดคำ 1–2 พยางค์ในที่เงียบ ถ้าผลดูแปลก ให้ฟังเสียงตัวเองเทียบกับต้นแบบ และลองปรับเสียงใหม่ในหน้าตั้งค่า'),
    sec('❤️ หัวใจ', 'ตอบผิดในบทเรียนใหม่เสีย 1 ดวง ฟื้นเอง 1 ดวงทุก 30 นาที ทบทวนจบ 1 บทได้ +1 ครบเป้า XP วันนี้ได้เต็ม 5 ดวง ข้อพูดไม่หักหัวใจ'),
    sec('ℹ️ คำอ่านไทย', 'คำอ่านไทยเป็นตัวช่วยโดยประมาณ ฟังเสียงจริงเป็นหลัก — เสียง 1 ≈ สามัญ (สูงกว่า), เสียง 2 ≈ จัตวา, เสียง 3 ≈ เอก, เสียง 4 ≈ โท'),
    sec('🐞 เจอบั๊ก', 'แอปจดบันทึกการใช้งานล่าสุดไว้ในเครื่อง (log) กดปุ่มด้านล่าง เขียนสั้น ๆ ว่าเกิดอะไร แล้วส่งทาง LINE ได้เลย'),
    h('button', { class: 'btn btn-line', onclick: reportSheet }, '💬 รายงานปัญหา / ส่ง log')));
}

function installGuideSheet() {
  openSheet(h('div', { class: 'info-sheet' }, h('h3', {}, '📲 เพิ่มลงหน้าจอโฮม'),
    h('ol', { class: 'steps' },
      h('li', {}, 'แตะปุ่ม ', h('b', {}, 'แชร์'), ' (สี่เหลี่ยมมีลูกศรขึ้น) ที่แถบล่างของ Safari'),
      h('li', {}, 'เลื่อนลงแล้วแตะ ', h('b', {}, '"เพิ่มลงหน้าจอโฮม"')),
      h('li', {}, 'เปิดแอปจากไอคอนแพนด้าบนหน้าจอโฮมทุกครั้ง')),
    h('p', { class: 'muted' }, 'แอปที่ติดตั้งแล้วเก็บความคืบหน้าได้ถาวรกว่า และใช้งานออฟไลน์ได้')));
}

async function exportProgress() {
  const name = `panda-progress-${today()}.json`;
  const text = JSON.stringify(S);
  S.lastExportDate = today();
  saveNow();
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); toast('สำรองแล้ว 💾'); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); a.remove();
  toast('บันทึกไฟล์สำรองแล้ว 💾');
}
async function importProgress(file) {
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (!obj || typeof obj !== 'object' || !obj.settings || !obj.lessons) throw new Error('bad');
    if (!(await confirmBox('นำเข้าความคืบหน้า?', 'ข้อมูลในเครื่องนี้จะถูกแทนที่ด้วยไฟล์สำรอง', 'นำเข้า'))) return;
    S = normalizeState(obj);
    saveNow();
    location.reload();
  } catch { toast('ไฟล์ไม่ถูกต้อง นำเข้าไม่ได้'); }
}
async function resetAll() {
  if (!(await confirmBox('ล้างความคืบหน้าทั้งหมด?', 'ลบบทเรียน XP สตรีค และสถิติทั้งหมดในเครื่องนี้ ย้อนกลับไม่ได้', 'ล้างทั้งหมด', 'ยกเลิก', true))) return;
  try { localStorage.removeItem(STORE_KEY); } catch {}
  S = defaultState();
  location.hash = '#/learn';
  location.reload();
}

// Manual update check: ask the service worker to re-fetch sw.js; a changed VERSION installs the new shell.
function applyUpdate(w) {
  saveNow(); Log.flush();
  toast('กำลังอัปเดต…');
  w.postMessage('skipWaiting');
  setTimeout(() => location.reload(), 3000); // fallback if controllerchange never fires
}
async function checkUpdate(btn) {
  const label = t => { if (btn) btn.textContent = t; };
  label('⏳ กำลังเช็ค…');
  logI('update', 'check from ' + APP_VERSION);
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (!reg) { location.reload(); return; }
    if (reg.waiting) return applyUpdate(reg.waiting);
    await reg.update();
    const w = reg.installing || reg.waiting;
    if (!w) { label(`✅ ล่าสุดแล้ว (${APP_VERSION})`); toast(`เป็นเวอร์ชันล่าสุดแล้ว (${APP_VERSION})`); return; }
    label('⬇️ กำลังโหลดเวอร์ชันใหม่…');
    await new Promise((res, rej) => {
      if (w.state === 'installed') return res();
      const tm = setTimeout(() => rej(new Error('timeout')), 20000);
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' || w.state === 'activated') { clearTimeout(tm); res(); }
        else if (w.state === 'redundant') { clearTimeout(tm); rej(new Error('install failed')); }
      });
    });
    logI('update', 'found new version');
    applyUpdate(reg.waiting || w);
  } catch (e) {
    logW('update', errText(e));
    label(`🔄 เช็คอัปเดต (${APP_VERSION})`);
    toast('เช็คอัปเดตไม่สำเร็จ ตรวจเน็ตแล้วลองใหม่');
  }
}
const updateBtn = (cls = 'btn btn-ghost') => {
  const b = h('button', { class: cls, onclick: () => checkUpdate(b) }, `🔄 เช็คอัปเดต (${APP_VERSION})`);
  return b;
};

// Bug report: device summary + recent log, sent via LINE share URL (text) or the share sheet (full .txt file)
let reportNote = '';
function deviceInfo() {
  return [
    `แอป ${APP_VERSION} · เนื้อหา ${C.version} · ${new Date().toLocaleString('th-TH')}`,
    navigator.userAgent,
    `จอ ${window.screen.width}x${window.screen.height}@${devicePixelRatio} · ${isStandalone() ? 'ติดตั้งแล้ว' : 'แท็บเบราว์เซอร์'} · ${navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์'} · SW ${navigator.serviceWorker && navigator.serviceWorker.controller ? 'ทำงาน' : 'ไม่ทำงาน'}`,
    `เสียงจีน ${TTS.voices.length} (${TTS.voice ? TTS.voice.name : '-'}) · ตรวจคำ ${SR ? (Speech.srBroken ? 'พัง' : 'มี') : 'ไม่มี'} · ไมค์ ${Mic.supported() ? (Speech.micDenied ? 'ถูกปฏิเสธ' : 'ได้') : 'ไม่รองรับ'} · ระดับ ${Speech.level()} · โหมด ${S.settings.micMode}`,
    `จบ ${Object.keys(S.lessons).length} บท · ถึง ${S.unlockedUpTo || '-'} · ${S.xp.total} XP · ❤️${S.hearts.count} · ปรับเสียง ${S.pitchProfile ? S.pitchProfile.medianHz + 'Hz' : '-'} · storage ${storageOK ? 'ok' : 'ปิด'}`,
  ];
}
function logText(maxChars) {
  const head = ['🐼 Panda log', ...deviceInfo()];
  if (reportNote.trim()) head.push('ปัญหา: ' + reportNote.trim());
  const ts = t => { const d = new Date(t); return `${z2(d.getMonth() + 1)}-${z2(d.getDate())} ${z2(d.getHours())}:${z2(d.getMinutes())}:${z2(d.getSeconds())}`; };
  let lines = Log.items.map(e => `${ts(e.t)} ${e.l} [${e.g}] ${e.m}`);
  if (maxChars) {
    // Keep the newest lines that fit; errors are usually the most recent thing before a report.
    let budget = maxChars - head.join('\n').length - 60;
    const keep = [];
    for (let i = lines.length - 1; i >= 0; i--) { budget -= lines[i].length + 1; if (budget < 0) break; keep.unshift(lines[i]); }
    if (keep.length < lines.length) keep.unshift(`(ตัด ${lines.length - keep.length} บรรทัดเก่าออก — แชร์ไฟล์เพื่อดูทั้งหมด)`);
    lines = keep;
  }
  return head.join('\n') + '\n----\n' + (lines.join('\n') || '(ยังไม่มี log)');
}
function sendToLine() {
  logI('report', 'ส่งไป LINE');
  // Thai text roughly triples once URL-encoded; keep the link a safe length for LINE.
  const url = 'https://line.me/R/share?text=' + encodeURIComponent(logText(1800));
  const a = h('a', { href: url, target: '_blank', rel: 'noopener' });
  document.body.append(a); a.click(); a.remove();
}
async function shareLogFile() {
  logI('report', 'แชร์ไฟล์ log');
  const text = logText();
  const d = new Date();
  const name = `panda-log-${today()}-${z2(d.getHours())}${z2(d.getMinutes())}.txt`;
  try {
    const file = new File([text], name, { type: 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: name });
  document.body.append(a); a.click(); a.remove();
  toast('บันทึกไฟล์ log แล้ว');
}
async function copyLog() {
  const text = logText();
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast('คัดลอก log แล้ว วางในแชทได้เลย');
}
function reportSheet() {
  const ta = h('textarea', { class: 'note', rows: '3', placeholder: 'เล่าสั้น ๆ ว่าเกิดอะไรขึ้น เช่น "วันที่ 3 บทที่ 2 กดไมค์แล้วค้าง"', 'aria-label': 'อธิบายปัญหา' });
  ta.value = reportNote;
  ta.addEventListener('input', () => { reportNote = ta.value; });
  const count = h('p', { class: 'muted small' }, `log ${Log.items.length} บรรทัด · ข้อผิดพลาด ${Log.errors()} ครั้ง · มีแค่รุ่นเครื่อง ผลการเรียน และคำที่ระบบได้ยิน ไม่มีข้อมูลส่วนตัว`);
  openSheet(h('div', { class: 'info-sheet' }, h('h3', {}, '🐞 รายงานปัญหา'), ta, count,
    h('button', { class: 'btn btn-line', onclick: shareLogFile }, '📎 ส่งไฟล์ log (เลือก LINE)'),
    h('p', { class: 'muted small center' }, 'เมนูแชร์จะเด้งขึ้น → เลือก LINE → เลือกแชท'),
    h('button', { class: 'btn btn-ghost', onclick: sendToLine }, '💬 ส่งเป็นข้อความ LINE (แบบย่อ)'),
    h('button', { class: 'btn btn-ghost', onclick: copyLog }, '📋 คัดลอก log'),
    h('button', { class: 'btn btn-danger-ghost', onclick: () => { Log.clear(); count.textContent = 'ล้าง log แล้ว'; } }, '🗑️ ล้าง log (หลังส่งแล้ว)')));
}

function certificateSheet() {
  const cv = document.createElement('canvas');
  cv.width = 1080; cv.height = 1350;
  const g = cv.getContext('2d');
  g.fillStyle = '#FFF8EE'; g.fillRect(0, 0, 1080, 1350);
  g.strokeStyle = '#D7263D'; g.lineWidth = 18; g.strokeRect(40, 40, 1000, 1270);
  g.fillStyle = '#2B2118'; g.textAlign = 'center';
  g.font = 'bold 72px system-ui, sans-serif'; g.fillText('ใบประกาศ', 540, 230);
  g.font = '44px system-ui, sans-serif'; g.fillText('เรียนจบหลักสูตร', 540, 330);
  g.font = 'bold 64px system-ui, sans-serif'; g.fillStyle = '#D7263D'; g.fillText('พูดจีนรอดใน 20 วัน', 540, 430);
  g.fillStyle = '#2B2118'; g.font = '40px system-ui, sans-serif';
  g.fillText(`${learnedIds().length} วลี · ${S.xp.total} XP · สตรีคยาวสุด ${S.streak.longest} วัน`, 540, 540);
  g.font = 'bold 160px "PingFang SC", "Noto Sans CJK SC", sans-serif'; g.fillText('你真棒!', 540, 820);
  g.font = '40px system-ui, sans-serif'; g.fillText('nǐ zhēn bàng — เก่งมาก!', 540, 900);
  g.fillStyle = '#7a6d60'; g.font = '34px system-ui, sans-serif'; g.fillText(today(), 540, 1180);
  openSheet(h('div', { class: 'info-sheet' }, h('h3', {}, '🏅 ใบประกาศของคุณ'),
    h('img', { class: 'cert', src: cv.toDataURL('image/png'), alt: 'ใบประกาศจบหลักสูตร' }),
    h('p', { class: 'muted' }, 'กดค้างที่รูปเพื่อบันทึกลงอัลบั้ม')));
}

// Onboarding S01/S02
function renderOnboarding(step = 0) {
  $('#nav').hidden = true;
  const next = () => renderOnboarding(step + 1);
  const steps = [
    () => h('div', { class: 'onb' }, panda('hi', 150),
      h('h1', {}, 'หนี ห่าว! ฉันชื่อเสี่ยวเป่า'),
      h('p', {}, 'เรียนพูดจีนเอาตัวรอดตอนเที่ยว ใน 20 วัน วันละ 15–20 นาที ไม่ต้องอ่านตัวจีนออก'),
      h('button', { class: 'btn btn-primary', onclick: () => { TTS.unlock(); audioCtx(); TTS.speak('你好'); next(); } }, 'เริ่มเลย')),
    () => (isIOS && !isStandalone()) ? h('div', { class: 'onb' }, panda('think', 120),
      h('h2', {}, 'ติดตั้งลงหน้าจอโฮมก่อนนะ'),
      h('p', {}, 'ความคืบหน้าในแท็บ Safari กับในแอปที่ติดตั้งแยกกัน ถ้าติดตั้งตอนนี้ ข้อมูลจะไม่หายภายหลัง'),
      h('ol', { class: 'steps' }, h('li', {}, 'แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น)'), h('li', {}, 'แตะ "เพิ่มลงหน้าจอโฮม"'), h('li', {}, 'ปิดหน้านี้ แล้วเปิดแอปจากไอคอนแพนด้า')),
      h('button', { class: 'btn btn-ghost', onclick: next }, 'ข้ามไปก่อน (เรียนใน Safari)')) : (next(), null),
    () => h('div', { class: 'onb' }, panda('happy', 120),
      h('h2', {}, 'เป้าหมายต่อวัน'),
      ...[[30, 'เบา ๆ', '~1 บท · 5 นาที'], [60, 'ปกติ (แนะนำ)', '~2 บท · 10–15 นาที'], [90, 'จริงจัง', '~3 บท · ครบ 1 วันของหลักสูตร']].map(([g, l, t]) =>
        h('button', { class: 'opt big' + (S.settings.dailyGoalXp === g ? ' sel' : ''), onclick: () => { S.settings.dailyGoalXp = g; save(); next(); } }, h('b', {}, `${g} XP · ${l}`), h('small', {}, t)))),
    () => {
      const status = h('p', { class: 'muted' });
      const voiceInfo = TTS.voices.length ? `✅ พบเสียงจีน: ${TTS.voice ? TTS.voice.name : ''}` : '⚠️ ยังไม่พบเสียงจีน — ดูวิธีติดตั้งในหน้าช่วยเหลือภายหลัง';
      return h('div', { class: 'onb' }, panda('think', 110),
        h('h2', {}, 'ทดสอบเสียง & ไมค์'),
        h('button', { class: 'btn btn-ghost', onclick: () => TTS.speak('你好，我是小宝') }, '🔊 ฟังเสียงตัวอย่าง'),
        h('p', { class: 'muted' }, voiceInfo),
        h('button', { class: 'btn btn-ghost', onclick: async () => {
          if (!Mic.supported()) { status.textContent = 'เครื่องนี้อัดเสียงไม่ได้ จะใช้โหมดพูดแล้วกดยืนยันเอง'; return; }
          try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); status.textContent = '✅ อนุญาตไมค์แล้ว'; }
          catch { Speech.micDenied = true; status.textContent = 'ไม่ได้อนุญาตไมค์ — ยังเรียนได้ ข้อพูดจะให้กดยืนยันเอง'; }
        } }, '🎙️ อนุญาตไมค์'),
        status,
        h('button', { class: 'btn btn-primary', onclick: () => { S.onboarded = true; saveNow(); location.hash = '#/learn'; render(); } }, 'ไปเรียนกันเลย!'));
    },
  ];
  const view = steps[step] && steps[step]();
  if (view) screen().replaceChildren(view);
}

// ============================================================ Lesson player
let L = null;
const lessonEl = () => $('#lesson');

function startSession(mode, entry) {
  if (HEART_MODES.has(mode) && hearts() <= 0) return heartsOutSheet();
  const sess = buildSession(mode, entry);
  if (!sess.queue.length) { toast('ยังไม่มีคำให้ฝึก เรียนบทแรกก่อนนะ'); return; }
  L = sess;
  logI('lesson', `start ${mode} ${entry ? entry.id : ''} ❤️${heartsLabel()} [${sess.queue.map(q => q.type).join(',')}]`);
  TTS.unlock(); audioCtx();
  history.pushState({ lesson: true }, '', '#/lesson');
  const el = lessonEl();
  el.hidden = false;
  el.replaceChildren(
    h('div', { class: 'l-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'ออกจากบทเรียน', onclick: askQuit }, '✕'),
      h('div', { class: 'l-progress' }, h('i', { id: 'l-prog' })),
      h('div', { class: 'l-hearts', id: 'l-hearts', 'aria-label': 'หัวใจ' }, HEART_MODES.has(mode) ? '❤️ ' + heartsLabel() : '🔁')),
    h('div', { class: 'l-body', id: 'l-body' }),
    h('div', { class: 'l-foot', id: 'l-foot' }));
  renderExercise();
}

async function askQuit() {
  if (!L) return;
  if (await confirmBox('ออกจากบทเรียน?', 'ความคืบหน้าในบทนี้จะไม่ถูกบันทึก', 'ออก', 'เรียนต่อ', true)) endSession();
}
function endSession() {
  if (L) logI('lesson', `end ${L.mode} at ${L.i}/${L.queue.length}`);
  L = null;
  if (TTS.supported) speechSynthesis.cancel();
  const el = lessonEl();
  el.hidden = true; el.replaceChildren();
  // Leaving #/lesson fires hashchange, which renders; only render directly if the hash won't change.
  if (location.hash === '#/learn') render(); else location.replace('#/learn');
}

function updateHead() {
  const done = L.i / L.queue.length;
  $('#l-prog').style.width = Math.round(done * 100) + '%';
  if (HEART_MODES.has(L.mode)) $('#l-hearts').textContent = '❤️ ' + heartsLabel();
}

function setFoot(...kids) { $('#l-foot').replaceChildren(...kids); $('#l-foot').className = 'l-foot'; }
function footBtn(label, onclick, cls = 'btn-primary', disabled = false) {
  return h('button', { class: 'btn ' + cls, disabled, onclick }, label);
}

function renderExercise() {
  updateHead();
  const ex = L.queue[L.i];
  const body = $('#l-body');
  body.scrollTop = 0;
  logI('ex', `${L.i + 1}/${L.queue.length} ${ex.type}${ex.retry ? '(ซ่อม)' : ''} ${(ex.item && ex.item.id) || (ex.set && ex.set.id) || (ex.dialog && ex.dialog.id) || (ex.target && ex.target.pinyin) || ''}`);
  const R = { intro: exIntro, listen: exListen, meaning: exMeaning, build: exBuild, tone: exTone, speak: exSpeak, match: exMatch, dialog: exDialog, tone_speak: exToneSpeak }[ex.type];
  body.replaceChildren(R(ex));
}

function advance() {
  L.i++;
  if (L.mode !== 'review' && L.mode !== 'tone' && HEART_MODES.has(L.mode) && hearts() <= 0) return heartsOutInLesson();
  if (L.i >= L.queue.length) return finishSession();
  renderExercise();
}

// Record a graded answer; returns nothing. Handles XP, SRS, hearts, retry queue.
function grade(ex, ok, srsIds) {
  const first = !ex.retry && L.results[ex.uid] === undefined;
  logI('ans', `${ex.type} ${ok ? 'ถูก' : 'ผิด'}`);
  if (first) {
    L.results[ex.uid] = ok;
    (srsIds || []).forEach(id => srsUpdate(id, ok));
  }
  if (ok) {
    sfx('ok');
    if (first) {
      let xp = 2;
      L.combo++;
      if (L.combo % 5 === 0) xp += 1;
      L.xp += xp; addXp(xp);
    }
  } else {
    sfx('bad');
    L.combo = 0;
    if (HEART_MODES.has(L.mode) && ex.type !== 'match') { loseHeart(); L.heartsLost++; setTimeout(() => sfx('heart'), 250); }
    if (!ex.retry && GRADED.has(ex.type) && ex.type !== 'match') L.queue.push({ ...ex, uid: L.nextUid++, retry: true });
  }
  updateHead();
}

function feedback(ok, info, { title } = {}) {
  const foot = $('#l-foot');
  const praise = ['เก่งมาก!', 'ถูกต้อง!', 'เยี่ยม!', 'ใช่เลย!', 'ดีมาก!'];
  foot.className = 'l-foot fb ' + (ok ? 'good' : 'bad');
  foot.replaceChildren(
    h('div', { class: 'fb-head' }, h('span', { class: 'fb-ic' }, ok ? '✓' : '✕'), h('b', {}, title || (ok ? praise[Math.floor(Math.random() * praise.length)] : 'คำตอบที่ถูกคือ'))),
    info ? h('div', { class: 'fb-ans' },
      h('div', {}, pyEl(info.pinyin), S.settings.showThai ? h('span', { class: 'muted' }, ' · ' + info.thai) : null),
      h('div', { class: 'fb-mean' }, info.meaning, info.hanzi ? h('span', { class: 'fb-hz', lang: 'zh-CN' }, ' ' + info.hanzi) : null),
      info.hanzi ? h('button', { class: 'btn-play small', 'aria-label': 'ฟังเสียง', onclick: () => play(info) }, '🔊') : null) : null,
    footBtn('ต่อไป', advance, ok ? 'btn-jade' : 'btn-danger'));
  if (info && info.hanzi) play(info);
}

const prompt = text => h('h2', { class: 'prompt' }, text);
function choiceList(options, render, onPick) {
  const wrap = h('div', { class: 'options' });
  let sel = null;
  options.forEach(o => {
    const b = h('button', { class: 'opt', onclick: () => { sel = o; wrap.querySelectorAll('.opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sfx('tap'); onPick(o, b); } }, render(o));
    wrap.append(b);
  });
  return { wrap, get: () => sel };
}
function checkFlow(getSel, isOk, info, srsIds) {
  const btn = footBtn('ตรวจคำตอบ', () => {
    const ex = L.queue[L.i];
    const ok = isOk(getSel());
    grade(ex, ok, srsIds);
    lockOptions();
    feedback(ok, info);
  }, 'btn-primary', true);
  setFoot(btn);
  return () => { btn.disabled = false; };
}
function lockOptions() { $('#l-body').querySelectorAll('.opt, .tile').forEach(b => { b.disabled = true; }); }

function exIntro(ex) {
  const it = ex.item;
  setFoot(footBtn('ต่อไป', () => { srsUpdate(it.id, true); advance(); }, 'btn-primary'));
  setTimeout(() => play(it), 250);
  return h('div', { class: 'ex' },
    h('div', { class: 'tag' }, '✨ คำใหม่'),
    wordCard(it), playBtns(it),
    it.note ? pandaSay('hi', it.note) : null);
}

function exListen(ex) {
  const it = ex.item;
  setTimeout(() => play(it), 250);
  let enable;
  const list = choiceList(ex.options, id => C.items[id].meaning, () => enable());
  enable = checkFlow(list.get, sel => sel === it.id, it, [it.id]);
  return h('div', { class: 'ex' }, prompt('ฟังแล้วเลือกความหมาย'),
    h('div', { class: 'big-play' }, h('button', { class: 'btn-speaker', 'aria-label': 'ฟังอีกครั้ง', onclick: () => play(it) }, '🔊'),
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(it, true) }, '🐢')),
    list.wrap);
}

function exMeaning(ex) {
  const it = ex.item;
  let enable;
  const list = choiceList(ex.options, id => {
    const o = C.items[id];
    return [h('div', { class: 'opt-py' }, pyEl(o.pinyin)), S.settings.showThai ? h('div', { class: 'opt-th' }, o.thai) : null];
  }, id => { play(C.items[id]); enable(); });
  enable = checkFlow(list.get, sel => sel === it.id, it, [it.id]);
  return h('div', { class: 'ex' }, prompt(`“${it.meaning}” พูดว่าอะไร?`), h('p', { class: 'muted small' }, 'แตะตัวเลือกเพื่อฟังเสียงก่อนตอบได้'), list.wrap);
}

function exBuild(ex) {
  const it = ex.item;
  const answerBox = h('div', { class: 'build-ans', 'aria-label': 'คำตอบ' });
  const bank = h('div', { class: 'build-bank' });
  const chosen = [];
  let btn;
  const tileEl = t => h('span', {}, h('b', {}, pyEl(t.py)), S.settings.showThai && t.th ? h('small', {}, t.th) : null);
  const redraw = () => {
    answerBox.replaceChildren(...chosen.map((t, i) => h('button', { class: 'tile', onclick: () => { chosen.splice(i, 1); redraw(); } }, tileEl(t))));
    bank.replaceChildren(...ex.bank.map(t => h('button', { class: 'tile' + (chosen.includes(t) ? ' used' : ''), disabled: chosen.includes(t), onclick: () => { chosen.push(t); sfx('tap'); redraw(); } }, tileEl(t))));
    if (btn) btn.disabled = !chosen.length;
  };
  btn = footBtn('ตรวจคำตอบ', () => {
    const ok = chosen.map(t => t.py).join(' ') === ex.answer.join(' ');
    grade(L.queue[L.i], ok, [it.id]);
    lockOptions();
    feedback(ok, it);
  }, 'btn-primary', true);
  setFoot(btn);
  redraw();
  return h('div', { class: 'ex' }, prompt('เรียงคำให้ได้ความหมายนี้'), h('div', { class: 'build-q' }, '“' + it.meaning + '”'), answerBox, bank);
}

function exTone(ex) {
  const s = ex.set, a = ex.answer;
  const target = { hanzi: s.hanzi[a], pinyin: s.pinyin[a], thai: s.thai[a], meaning: s.meaning[a] };
  setTimeout(() => play(target), 250);
  let enable;
  const list = choiceList(s.hanzi.map((_, i) => i), i => [h('div', { class: 'opt-py' }, pyEl(s.pinyin[i])), toneShapes(sylls(s.pinyin[i]).map(x => x.tone)), h('div', { class: 'opt-th' }, `${s.thai[i]} · ${s.meaning[i]}`)], () => enable());
  list.wrap.classList.add('grid2');
  enable = checkFlow(list.get, sel => sel === a, target, []);
  return h('div', { class: 'ex' }, prompt('ได้ยินวรรณยุกต์ไหน?'),
    h('div', { class: 'big-play' }, h('button', { class: 'btn-speaker', 'aria-label': 'ฟังอีกครั้ง', onclick: () => play(target) }, '🔊'),
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(target, true) }, '🐢')),
    list.wrap);
}

function exMatch(ex) {
  const its = ex.items;
  let selL = null, selR = null, mistakes = 0, matched = 0;
  const left = h('div', { class: 'match-col' }), right = h('div', { class: 'match-col' });
  const tryPair = () => {
    if (!selL || !selR) return;
    const [lb, lid] = selL, [rb, rid] = selR;
    if (lid === rid) {
      lb.classList.add('matched'); rb.classList.add('matched'); lb.disabled = rb.disabled = true;
      sfx('ok'); matched++;
      if (matched === its.length) {
        const ok = mistakes <= 1;
        grade(L.queue[L.i], ok, ok ? its.map(it => it.id) : []);
        feedback(ok, null, { title: ok ? 'จับคู่ครบแล้ว!' : `จับคู่ครบ (ผิด ${mistakes} ครั้ง)` });
      }
    } else {
      mistakes++; sfx('bad');
      [lb, rb].forEach(b => { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); });
    }
    lb.classList.remove('sel'); rb.classList.remove('sel');
    selL = selR = null;
  };
  for (const it of shuffle(its)) {
    const b = h('button', { class: 'opt mini', onclick: () => { left.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); selL = [b, it.id]; play(it); tryPair(); } },
      h('div', { class: 'opt-py' }, pyEl(it.pinyin)), S.settings.showThai ? h('small', {}, it.thai) : null);
    left.append(b);
  }
  for (const it of shuffle(its)) {
    const b = h('button', { class: 'opt mini', onclick: () => { right.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); selR = [b, it.id]; tryPair(); } }, it.meaning);
    right.append(b);
  }
  setFoot(h('p', { class: 'muted center' }, 'แตะคำซ้าย แล้วแตะความหมายขวาที่ตรงกัน'));
  return h('div', { class: 'ex' }, prompt('จับคู่ให้ถูก'), h('div', { class: 'match' }, left, right));
}

function bubble(who, it) {
  return h('div', { class: 'msg ' + who },
    who === 'npc' ? panda('hi', 40) : null,
    h('div', { class: 'msg-b' },
      h('div', {}, pyEl(it.pinyin)),
      S.settings.showThai ? h('div', { class: 'msg-th' }, it.thai) : null,
      h('div', { class: 'msg-mean' }, it.meaning),
      h('button', { class: 'btn-play small', 'aria-label': 'ฟังเสียง', onclick: () => play(it) }, '🔊')));
}
function exDialog(ex) {
  const d = ex.dialog, lines = d.lines, k = ex.upto;
  const chat = h('div', { class: 'chat' });
  if (d.scene) chat.append(h('div', { class: 'scene' }, '🎬 ' + d.scene));
  let lastMe = -1;
  for (let i = 0; i < k; i++) if (lines[i].who === 'me') lastMe = i;
  const toPlay = [];
  for (let i = 0; i < k; i++) {
    const ln = lines[i];
    const it = C.items[ln.who === 'npc' ? ln.item : ln.answer];
    if (!it) continue;
    chat.append(bubble(ln.who, it));
    if (ln.who === 'npc' && i > lastMe) toPlay.push(it);
  }
  const cur = lines[k];
  if (cur.cue) chat.append(h('div', { class: 'cue' }, '👉 ' + cur.cue));
  const answer = C.items[cur.answer];
  (async () => { await new Promise(r => setTimeout(r, 300)); for (const it of toPlay) { if (!L || L.queue[L.i] !== ex) return; await play(it); } })();
  let enable;
  const opts = shuffle([cur.answer, ...(cur.distractors || [])].filter(id => C.items[id]));
  const list = choiceList(opts, id => { const o = C.items[id]; return [h('div', { class: 'opt-py' }, pyEl(o.pinyin)), h('div', { class: 'opt-th' }, (S.settings.showThai ? o.thai + ' · ' : '') + o.meaning)]; }, () => enable());
  enable = checkFlow(list.get, sel => sel === cur.answer, answer, [cur.answer]);
  // Long conversations push the answers below the fold; bring them into thumb reach.
  setTimeout(() => list.wrap.scrollIntoView({ block: 'end', behavior: 'smooth' }), 350);
  return h('div', { class: 'ex' }, prompt('ตอบให้เหมาะกับสถานการณ์'), chat, list.wrap);
}

function micButton(label, onclick) {
  return h('button', { class: 'mic', onclick, 'aria-label': label }, h('span', { class: 'mic-ic' }, '🎙️'), h('span', { class: 'mic-l' }, label));
}

function snoozeMic() {
  S.settings.micSnoozeUntil = Date.now() + 15 * 60 * 1000;
  save();
  L.queue = L.queue.slice(0, L.i + 1).concat(L.queue.slice(L.i + 1).filter(x => x.type !== 'speak' && x.type !== 'tone_speak'));
  toast('พักข้อพูด 15 นาที 🤫');
  advance();
}

function exSpeak(ex) {
  const it = ex.item;
  const box = h('div', { class: 'speak-box' });
  const status = h('div', { class: 'speak-status', role: 'status' });
  let attempts = 0, finished = false;

  const done = (kind, r) => {
    if (finished) return;
    finished = true;
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    if (kind === 'skip') { setFoot(footBtn('ต่อไป', advance, 'btn-ghost')); advance(); return; }
    if (kind === 'auto') { S.stats.speakAuto++; S.stats.speakAutoPass++; srsUpdate(it.id, true); L.xp += 3; addXp(3); }
    else { S.stats.speakSelf++; L.xp += 2; addXp(2); }
    save();
    sfx('ok');
    feedback(true, it, { title: kind === 'auto' ? (r.best >= 0.8 ? 'ชัดมาก! 🎉' : 'ใกล้แล้ว! ระบบฟังออก') : 'เยี่ยม! ฝึกพูดต่อไปนะ' });
  };
  const offerSelf = () => box.append(h('div', { class: 'self-row' },
    h('button', { class: 'btn btn-jade', onclick: () => done('self') }, '✓ ฉันพูดได้แล้ว (ตรวจเอง)')));

  const renderA = () => {
    const mic = micButton('แตะแล้วพูด', async () => {
      if (mic.classList.contains('on')) { status.textContent = 'กำลังตรวจ…'; Speech.stop(); return; }
      if (TTS.supported) speechSynthesis.cancel();
      mic.classList.add('on');
      mic.querySelector('.mic-l').textContent = 'แตะเมื่อพูดจบ';
      status.textContent = 'กำลังเปิดไมค์…';
      const t0 = Date.now();
      try {
        const alts = await Speech.recognize({
          isGood: a => scoreSpeech(it, a).best >= 0.8,
          onStart: () => { status.textContent = 'พูดได้เลย 🎙️'; },
        });
        mic.classList.remove('on');
        mic.querySelector('.mic-l').textContent = 'แตะแล้วพูด';
        const r = scoreSpeech(it, alts);
        attempts++;
        logI('sr', `${it.id} ได้ยิน [${alts.join(' / ')}] score=${r.best.toFixed(2)}${r.toneTrap ? ' trap=' + r.toneTrap : ''} ${Date.now() - t0}ms`);
        if (r.best >= 0.5) return done('auto', r);
        if (r.toneTrap) {
          const info = lookupHanzi(r.toneTrap);
          status.replaceChildren(h('b', { class: 'bad-t' }, 'วรรณยุกต์ผิด: '), 'ระบบได้ยิน ', h('b', { lang: 'zh-CN' }, r.toneTrap),
            info ? [' ', pyEl(info.pinyin), ` (${info.meaning})`] : null, ' — ฟังต้นแบบแล้วลองใหม่');
        } else status.replaceChildren('ระบบได้ยิน: ', h('b', { lang: 'zh-CN' }, r.heard || '(ไม่ชัด)'), ' — ลองอีกครั้ง');
        if (attempts === 3) offerSelf();
      } catch (err) {
        mic.classList.remove('on');
        mic.querySelector('.mic-l').textContent = 'แตะแล้วพูด';
        logW('sr', `${it.id} error ${err} ${Date.now() - t0}ms`);
        if (err === 'no-speech' || err === 'aborted') {
          attempts++;
          status.textContent = 'ไม่ได้ยินเสียง ลองพูดดังขึ้นอีกนิด';
          if (attempts === 3) offerSelf();
          return;
        }
        Speech.srBroken = true;
        logW('sr', 'ปิดระบบตรวจคำ → ระดับ ' + Speech.level());
        if (!Speech.notified) { Speech.notified = true; toast('ระบบตรวจคำพูดใช้ไม่ได้ตอนนี้ — เปลี่ยนเป็นอัดเสียงแล้วฟังเทียบเอง'); }
        Speech.level() === 'B' ? renderB() : renderC();
      }
    });
    box.replaceChildren(mic);
  };

  const renderB = () => {
    let ctl = null, clip = null;
    const meter = h('div', { class: 'meter' }, h('i'));
    const after = h('div', { class: 'self-row' });
    const mic = micButton('แตะเพื่ออัด', async () => {
      if (ctl) { ctl.stop(); return; }
      if (TTS.supported) speechSynthesis.cancel();
      mic.classList.add('on');
      mic.querySelector('.mic-l').textContent = 'แตะเพื่อหยุด';
      status.textContent = 'กำลังอัด… พูดตามได้เลย';
      try {
        ctl = startRecording(5000, l => meter.firstChild.style.width = Math.min(100, l * 800) + '%', { autoStop: true });
        clip = await ctl.promise;
      } catch {
        status.textContent = 'ไม่ได้รับสิทธิ์ใช้ไมค์';
        return renderC();
      } finally { ctl = null; mic.classList.remove('on'); mic.querySelector('.mic-l').textContent = 'อัดใหม่'; }
      status.textContent = 'ฟังเสียงตัวเองเทียบกับต้นแบบ แล้วตัดสินเอง';
      after.replaceChildren(
        h('button', { class: 'btn btn-ghost', onclick: () => playClip(clip) }, '▶ ฟังของฉัน'),
        h('button', { class: 'btn btn-ghost', onclick: () => play(it) }, '🔊 ฟังต้นแบบ'),
        h('button', { class: 'btn btn-jade', onclick: () => done('self') }, '✓ ใกล้เคียงแล้ว'));
    });
    box.replaceChildren(mic, meter, after);
  };

  const renderC = () => {
    status.textContent = 'ฟังต้นแบบ แล้วพูดออกเสียงตาม 2–3 รอบ';
    box.replaceChildren(h('button', { class: 'btn btn-jade', onclick: () => done('self') }, '✓ พูดแล้ว'));
  };

  const lvl = Speech.level();
  lvl === 'A' ? renderA() : lvl === 'B' ? renderB() : renderC();
  setFoot(footBtn('ข้ามข้อนี้', () => done('skip'), 'btn-ghost'));
  setTimeout(() => play(it), 250);
  return h('div', { class: 'ex' }, prompt('พูดตาม'), wordCard(it), playBtns(it), box, status,
    h('button', { class: 'link', onclick: snoozeMic }, 'ตอนนี้พูดไม่ได้ (พัก 15 นาที)'));
}

function pitchPlot(r) {
  const W = 340, H = 150;
  const cv = h('canvas', { class: 'pitch', width: W * 2, height: H * 2, 'aria-label': 'กราฟเส้นเสียง' });
  const g = cv.getContext('2d');
  g.scale(2, 2);
  const css = getComputedStyle(document.documentElement);
  const col = t => css.getPropertyValue('--t' + t).trim() || '#888';
  const y = st => H / 2 - st * (H - 20) / 26;
  g.strokeStyle = css.getPropertyValue('--line').trim(); g.lineWidth = 1;
  for (let c = 1; c <= 5; c++) { g.beginPath(); g.moveTo(0, y((c - 3) * r.step)); g.lineTo(W, y((c - 3) * r.step)); g.stroke(); }
  const n = r.syl.length, gapX = 14, segW = (W - 16 - (n - 1) * gapX) / n;
  r.syl.forEach((s, i) => {
    const x0 = 8 + i * (segW + gapX);
    if (s.target !== 5) {
      const t = tplSt(s.target === 3 && s.half ? '3h' : s.target, r.step);
      g.setLineDash([7, 6]); g.lineWidth = 6; g.globalAlpha = 0.35; g.strokeStyle = col(s.target);
      g.beginPath(); t.forEach((v, j) => { const x = x0 + j / 4 * segW; j ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); }); g.stroke();
      g.globalAlpha = 1; g.setLineDash([]);
    }
    g.lineWidth = 3; g.strokeStyle = css.getPropertyValue('--text').trim();
    g.beginPath();
    s.raw.forEach((v, j) => { const x = x0 + j / Math.max(1, s.raw.length - 1) * segW; j ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
    g.stroke();
  });
  return cv;
}

function exToneSpeak(ex) {
  const t = ex.target;
  const box = h('div', { class: 'speak-box' });
  const status = h('div', { class: 'speak-status', role: 'status' });
  const res = h('div', { class: 'tone-res' });
  let lastClip = null, passed = false, ctl = null;
  const meter = h('div', { class: 'meter' }, h('i'));

  const showResult = r => {
    logI('tone', `${t.pinyin} → ${r.reason || r.syl.map(s => `${s.target}:${s.got}` + (s.curve ? ` [${s.curve.map(v => v.toFixed(1)).join(',')}]` : '')).join(' ')}`);
    if (r.reason) {
      res.replaceChildren();
      status.textContent = r.reason === 'quiet' ? 'ไม่ได้ยินเสียงชัด ลองพูดดังขึ้นใกล้ไมค์' : `ลองพูดให้ได้ ${t.tones.length} พยางค์ชัด ๆ เว้นจังหวะนิดหนึ่ง`;
      return;
    }
    r.syl.forEach(s => {
      if (s.target === 5) return;
      const ts = S.toneStats[s.target] || (S.toneStats[s.target] = { ok: 0, n: 0 });
      ts.n++; if (s.ok) ts.ok++;
    });
    save();
    const sp = sylls(t.pinyin);
    res.replaceChildren(pitchPlot(r),
      h('div', { class: 'syl-row' }, ...r.syl.map((s, i) => h('div', { class: 'syl ' + (s.ok ? 'ok' : 'no') },
        h('b', {}, sp[i] ? sp[i].text : ''), h('small', {}, s.target === 5 ? 'เสียงเบา' : s.ok ? '✓ ถูก' : `คล้าย${TONE_NAME[s.got]}`)))),
      ...r.syl.filter(s => !s.ok).map(s => h('p', { class: 'hint' }, '💡 ' + TONE_HINT[s.target])),
      h('p', { class: 'muted small' }, 'เส้นประ = เป้าหมาย · เส้นทึบ = เสียงคุณ'));
    status.textContent = r.ok ? 'วรรณยุกต์ถูกต้อง! 🎉' : 'ยังไม่ตรง ลองอีกครั้งได้';
    if (r.ok && !passed) { passed = true; sfx('ok'); L.xp += 3; addXp(3); setFoot(footBtn('ต่อไป', advance, 'btn-jade')); }
  };

  const renderMic = () => {
    const cal = !S.pitchProfile;
    status.textContent = cal ? 'ครั้งแรก: แตะไมค์แล้วพูด "อาาา" ยาว ๆ ด้วยเสียงพูดปกติ 2 วินาที (เพื่อปรับให้เข้ากับเสียงคุณ)' : 'แตะไมค์ แล้วพูดชัด ๆ — หยุดพูดแล้วระบบจะตรวจเอง';
    const mic = micButton(cal ? 'ปรับเสียง' : 'แตะแล้วพูด', async () => {
      if (ctl) { ctl.stop(); return; }
      if (TTS.supported) speechSynthesis.cancel();
      mic.classList.add('on');
      if (!cal) status.textContent = 'พูดได้เลย 🎙️';
      let clip;
      try {
        ctl = cal ? startRecording(2500, l => meter.firstChild.style.width = Math.min(100, l * 800) + '%')
          : startRecording(4000, l => meter.firstChild.style.width = Math.min(100, l * 800) + '%', { autoStop: true });
        clip = await ctl.promise;
      } catch {
        status.textContent = 'ไม่ได้รับสิทธิ์ใช้ไมค์ — ข้ามข้อนี้ได้';
        return;
      } finally { ctl = null; mic.classList.remove('on'); }
      if (cal) {
        if (calibrateFrom(clip)) { toast('ปรับเสียงแล้ว ✓'); renderMic(); }
        else status.textContent = 'ไม่ได้ยินเสียงชัด ลองพูด "อาาา" ดังขึ้นอีกนิด';
        return;
      }
      lastClip = clip;
      showResult(toneCheck(clip, t.tones));
      if (!box.querySelector('.mine')) box.append(h('button', { class: 'btn btn-ghost mine', onclick: () => playClip(lastClip) }, '▶ ฟังของฉัน'));
    });
    box.replaceChildren(mic, meter);
  };
  renderMic();
  setFoot(footBtn('ข้าม / ต่อไป', advance, 'btn-ghost'));
  setTimeout(() => play(t), 250);
  return h('div', { class: 'ex' }, prompt('พูดให้ถูกวรรณยุกต์'), h('div', { class: 'tag' }, '🧪 ทดลอง · ไม่เสียหัวใจ'),
    h('div', { class: 'word big' }, h('div', { class: 'word-py' }, pyEl(t.pinyin)), toneShapes(t.tones),
      S.settings.showThai ? h('div', { class: 'word-th' }, t.thai) : null, h('div', { class: 'word-mean' }, t.meaning)),
    playBtns(t), box, status, res);
}

function finishSession() {
  const sess = L;
  const vals = Object.values(sess.results);
  const acc = vals.length ? vals.filter(Boolean).length / vals.length : 1;
  const stars = acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : 1;
  let extra = [];
  let goalHit = false;
  if (sess.mode === 'lesson' || sess.mode === 'checkpoint') {
    const e = sess.entry;
    const prev = S.lessons[e.id];
    S.lessons[e.id] = { stars: Math.max(stars, prev && !prev.skipped ? prev.stars : 0), best: Math.max(acc, prev ? prev.best || 0 : 0), attempts: (prev ? prev.attempts || 0 : 0) + 1, doneAt: today() };
    unlockTo(e.index + 1);
    goalHit = addXp(5); sess.xp += 5;
  } else if (sess.mode === 'skip') {
    if (acc >= 0.8) {
      const target = sess.entry.index;
      for (const e of C.order) if (e.index < target && !S.lessons[e.id]) S.lessons[e.id] = { stars: 0, best: 0, attempts: 0, doneAt: today(), skipped: true };
      unlockTo(target);
      extra.push(`ปลดล็อคถึงวันที่ ${sess.entry.unit.day} แล้ว!`);
    } else extra.push('ยังไม่ถึง 80% — เรียนตามลำดับก่อนนะ');
  } else {
    addHearts(1);
    extra.push('+1 ❤️ จากการฝึก');
    goalHit = addXp(5); sess.xp += 5;
  }
  if (goalHit) extra.push('ครบเป้าวันนี้! เติมหัวใจเต็ม ❤️×5');
  const streakUp = touchStreak();
  if (streakUp) extra.push(`🔥 สตรีค ${S.streak.current} วัน!`);
  logI('lesson', `finish ${sess.mode} ${sess.entry ? sess.entry.id : ''} acc=${Math.round(acc * 100)}% xp=${sess.xp} ❤️lost=${sess.heartsLost}`);
  saveNow();
  sfx('done');
  const finalDone = sess.mode === 'checkpoint' && sess.entry.lesson.final;
  $('#l-prog').style.width = '100%';
  $('#l-body').replaceChildren(h('div', { class: 'complete' },
    panda('party', 150),
    h('h2', {}, finalDone ? 'จบหลักสูตรแล้ว! 你真棒!' : sess.mode === 'skip' && acc < 0.8 ? 'เกือบแล้ว!' : 'จบบทแล้ว!'),
    sess.mode === 'lesson' || sess.mode === 'checkpoint' ? h('div', { class: 'stars big' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)) : null,
    h('div', { class: 'stat-grid' }, statCard('⚡', '+' + sess.xp, 'XP'), statCard('🎯', Math.round(acc * 100) + '%', 'ความแม่น'),
      statCard('📈', `${Math.min(xpToday(), S.settings.dailyGoalXp)}/${S.settings.dailyGoalXp}`, 'เป้าวันนี้')),
    ...extra.map(t => h('p', { class: 'celebrate' }, t))));
  setFoot(footBtn(finalDone ? 'ดูใบประกาศ 🏅' : 'ต่อไป', () => { endSession(); if (finalDone) certificateSheet(); }, 'btn-primary'));
}

function heartsOutInLesson() {
  logI('lesson', `หัวใจหมด ${L.mode} at ${L.i}/${L.queue.length}`);
  $('#l-body').replaceChildren(h('div', { class: 'complete' }, panda('sleep', 140),
    h('h2', {}, 'หัวใจหมดแล้ว'),
    h('p', {}, 'บทนี้ยังไม่ถูกบันทึก แต่ XP ที่ได้ยังอยู่'),
    h('p', { class: 'muted' }, `หัวใจดวงถัดไปในอีก ${fmtMs(nextHeartMs())}`)));
  setFoot(footBtn('🔁 ทบทวนเพื่อเติมหัวใจ', () => { endSession(); setTimeout(() => startSession('review'), 50); }, 'btn-jade'),
    footBtn('รอก่อน', endSession, 'btn-ghost'));
}
function heartsOutSheet() {
  openSheet(h('div', { class: 'info-sheet center' }, panda('sleep', 110), h('h3', {}, 'หัวใจหมดแล้ว'),
    h('p', {}, `ดวงถัดไปในอีก ${fmtMs(nextHeartMs())}`),
    h('button', { class: 'btn btn-jade', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession('review'); } }, '🔁 ทบทวนเพื่อเติมหัวใจ'),
    h('button', { class: 'btn btn-ghost', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession('tone'); } }, '🎵 ฝึกวรรณยุกต์ (+1)')));
}

// ============================================================ Router
const TABS = [['learn', 'เรียน', '🗺️'], ['phrases', 'การ์ดพูด', '🗣️'], ['review', 'ทบทวน', '🔁'], ['me', 'ฉัน', '🐼']];
function route() { return (location.hash.replace(/^#\/?/, '') || 'learn').split('/')[0]; }
function renderNav(active) {
  const nav = $('#nav');
  nav.hidden = false;
  nav.replaceChildren(...TABS.map(([k, label, ic]) => h('a', { href: '#/' + k, class: 'tab' + (k === active ? ' on' : ''), 'aria-current': k === active ? 'page' : null },
    h('span', { class: 'tab-ic' }, ic), h('span', {}, label))));
}
function render() {
  if (!S.onboarded) return renderOnboarding(0);
  const r = route();
  const views = { learn: renderLearn, phrases: renderPhrases, review: renderReview, me: renderMe, settings: renderSettings, help: renderHelp };
  const view = views[r] || renderLearn;
  logI('nav', r);
  renderNav(['settings', 'help'].includes(r) ? 'me' : (views[r] ? r : 'learn'));
  view();
}
addEventListener('hashchange', () => {
  if (L && location.hash !== '#/lesson') { history.pushState({ lesson: true }, '', '#/lesson'); askQuit(); return; }
  if (!L && location.hash === '#/lesson') { location.replace('#/learn'); return; }
  render();
  window.scrollTo(0, 0);
});

// ============================================================ Boot
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const prompt = w => toast('มีเวอร์ชันใหม่', 0, { label: 'อัปเดต', fn: () => w.postMessage('skipWaiting') });
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); });
    });
  }).catch(e => logW('sw', 'register ' + errText(e)));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

async function boot() {
  TTS.init();
  document.addEventListener('pointerdown', () => { TTS.unlock(); audioCtx(); }, { once: true });
  try { await loadContent(); }
  catch (e) {
    logE('boot', 'loadContent ' + errText(e));
    screen().replaceChildren(h('div', { class: 'onb' }, panda('sad', 120), h('h2', {}, 'โหลดบทเรียนไม่สำเร็จ'),
      h('p', {}, 'ตรวจการเชื่อมต่อแล้วลองใหม่ (ครั้งแรกต้องมีเน็ต หลังจากนั้นใช้ออฟไลน์ได้)'),
      h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'ลองใหม่')));
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (location.hash === '#/lesson') history.replaceState(null, '', '#/learn');
  logI('boot', deviceInfo().join(' | '));
  render();
  if (params.has('lint')) {
    const issues = lintContent();
    openSheet(h('div', { class: 'info-sheet' }, h('h3', {}, `ตรวจเนื้อหา: ${issues.length ? issues.length + ' ปัญหา' : 'ไม่พบปัญหา ✓'}`),
      h('ul', { class: 'lint' }, ...issues.map(t => h('li', {}, t)))));
  }
  registerSW();
}
boot();
