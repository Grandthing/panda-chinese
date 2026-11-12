'use strict';
/* พูดจีนรอดใน 20 วัน — js/core.js: Utils · Storage · Debug log · Content · Pinyin
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
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
      dailyGoalXp: 60, ttsRate: 0.9, voiceURI: null, randomVoice: true, recordedAudio: true, recVoice: null, showThai: true, showHanzi: true, sfx: true,
      micMode: 'auto', micSnoozeUntil: null, unlimitedHearts: false,
    },
    lessons: {},
    unlockedUpTo: null,
    places: [],
    xp: { total: 0, byDate: {} },
    streak: { current: 0, longest: 0, lastDate: null, freezes: 0 },
    hearts: { count: 5, updatedAt: Date.now(), lastFullRefillDate: null },
    srs: {},
    pitchProfile: null,
    toneStats: {},
    speakMiss: {},
    speakMissSeeded: false,
    firstTry: {},   // date → [spoken exercises, passed on the first try]
    exams: [],      // situation exams: { d, pass, n }
    patDone: {},    // sentence pattern id → times finished
    soundStats: {}, // look-alike sound set id → [heard, right]
    vocab: { done: {}, rev: {} }, // คลังคำ 500: stage id → { d, n }; word id → times reviewed
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
  for (const k of ['settings', 'xp', 'streak', 'hearts', 'stats', 'vocab']) s[k] = { ...base[k], ...s[k] };
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
const APP_VERSION = '2.1.1';
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
const C = { items: {}, cats: {}, units: [], order: [], byId: {}, toneSets: [], itemUnit: {}, version: '', pat: { patterns: [], scenes: [], replies: [], sounds: [] }, vocab: { themes: [], stages: [], words: [] } };

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
  // Number drills (tools/make_numbers.py). Optional: the course works without them.
  C.numSets = await fetch('content/numbers.json').then(r => r.ok ? r.json() : { sets: [] }).then(d => d.sets || []).catch(() => []);
  C.numSets.forEach(st => st.groups.forEach((g, gi) => g.forEach((it, k) => { it.id = `n_${st.id}_${gi}_${k}`; it.group = g; it.set = st; })));
  // Long shop / food / snack sentences (tools/make_sentences.py), unlocked once all their words were learned.
  C.sentSets = await fetch('content/sentences.json').then(r => r.ok ? r.json() : { sets: [] }).then(d => d.sets || []).catch(() => []);
  C.sentSets.forEach(st => st.sentences.forEach((x, k) => { x.id = `s_${st.id}_${k}`; x.set = st; }));
  // Meaning of each word inside a phrase (tools/make_glossary.py). Optional.
  C.gloss = await fetch('content/glossary.json').then(r => r.ok ? r.json() : null).catch(() => null);
  // Sentence patterns, free-reply scenes, local replies, look-alike sounds (tools/make_patterns.py). Optional.
  C.pat = await fetch('content/patterns.json').then(r => r.ok ? r.json() : null).catch(() => null) || { patterns: [], scenes: [], replies: [], sounds: [] };
  C.pat.patterns.forEach(p => p.sentences.forEach((x, k) => { x.id = `p_${p.id}_${k}`; x.set = p; }));
  C.pat.scenes.forEach(sc => sc.answers.forEach((a, k) => { a.id = `sc_${sc.id}_${k}`; }));
  C.pat.replies.forEach(st => { const set = { icon: st.icon, title: `คุณ${st.title} · เขาตอบว่าอะไร?` }; st.lines.forEach((x, k) => { x.id = `r_${st.id}_${k}`; x.set = set; }); });
  // คลังคำ 500 (tools/make_vocab.py). Optional.
  vocabInit(await fetch('content/vocab.json').then(r => r.ok ? r.json() : null).catch(() => null));
  C.order = []; C.byId = {}; C.itemUnit = {};
  for (const u of C.units) {
    u.items = uniq(u.lessons.flatMap(l => l.newItems || []));
    const add = e => { e.index = C.order.length; C.order.push(e); C.byId[e.id] = e; };
    // Every 3 days the path opens with a challenge built from all the earlier days' words, so old words keep coming back.
    if (!u.bonus && u.day >= 4 && (u.day - 1) % 3 === 0)
      add({ id: 'ch-' + u.day, kind: 'challenge', unit: u, upto: u.day - 1, lesson: { size: 14 }, title: `ด่านท้าทาย: คำวันที่ 1–${u.day - 1}` });
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
      if (ln.answer && C.items[ln.answer]?.listenOnly) issues.push(`${d.id}: คำตอบ "${ln.answer}" เป็นคำฟังอย่างเดียว`);
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
const SYL_RE = new RegExp(`(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[${V}]+(?:ng(?![${V}])|n(?![${V}])|r(?![${V}]))?`, 'gi');

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
