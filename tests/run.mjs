// Automated tests for Panda. No build step: the real index.html scripts run inside jsdom.
//   npm test             run everything
//   npm run test:update  re-record tests/fixtures/sr-golden.json after an intended scoring change
//
// 1. content: every lesson file loads and lintContent() finds nothing
// 2. speech:  every recogniser result from real phone logs gets the same verdict as before (golden file)
// 3. play:    every lesson, checkpoint, challenge and practice mode is played from the first exercise to the
//             finish screen by clicking the real buttons, with zero errors
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPDATE = process.argv.includes('--update');
const GOLDEN = path.join(ROOT, 'tests/fixtures/sr-golden.json');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

let failed = 0;
const ok = msg => console.log('  ✓ ' + msg);
const fail = msg => { failed++; console.log('  ✗ ' + msg); };
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

// ---------------------------------------------------------------- a browser with the app in it
async function openApp(state) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdom: ' + (e.detail && e.detail.stack || e.stack || e.message)));
  const html = read('index.html');
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.addEventListener('error', e => errors.push('error: ' + (e.error && e.error.stack || e.message)));
  w.addEventListener('unhandledrejection', e => errors.push('promise: ' + (e.reason && e.reason.stack || e.reason)));
  // What a phone has and jsdom doesn't.
  w.fetch = async url => {
    const f = path.join(ROOT, String(url).split('?')[0]);
    if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    const text = fs.readFileSync(f, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = () => {};
  w.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, speaking: false, pending: false, addEventListener() {} };
  w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  w.webkitSpeechRecognition = class {};
  w.Audio = class { play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} load() {} };
  if (state) w.localStorage.setItem('pandaTalk.v1', JSON.stringify(state));
  const ctx = dom.getInternalVMContext();
  const run = (code, filename = 'test') => new vm.Script(code, { filename }).runInContext(ctx);
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) run(read(m[1]), m[1]);
  for (let i = 0; i < 200 && !run('typeof C !== "undefined" && C.order.length > 0 && !!C.gloss'); i++) await tick(10);
  await tick(20);
  // Sound is not under test.
  run('play = async () => {}; stopAudio = () => {}; sfx = () => {}; TTS.unlock = () => {}; TTS.speak = async () => {}; audioCtx = () => null;');
  return { w, run, errors, close: () => w.close() };
}

// ---------------------------------------------------------------- 1. content
async function testContent() {
  console.log('content');
  const app = await openApp();
  const info = app.run('({ items: Object.keys(C.items).length, order: C.order.length, issues: lintContent() })');
  check(info.order > 0 && info.items > 0, `${info.items} คำ, ${info.order} ด่าน โหลดได้`);
  check(info.issues.length === 0, 'lintContent ไม่พบปัญหา' + (info.issues.length ? ': ' + info.issues.slice(0, 5).join(' | ') : ''));
  check(app.errors.length === 0, 'เปิดแอปไม่มี error' + (app.errors.length ? ': ' + app.errors[0] : ''));
  app.close();
}

// ---------------------------------------------------------------- 2. speech verdicts from real logs
async function testSpeech() {
  console.log('speech (ผลจาก log จริง)');
  const app = await openApp();
  const attempts = JSON.parse(read('tests/fixtures/sr-attempts.json'));
  app.w.__attempts = attempts;
  const got = app.run(`__attempts.map(a => {
    const it = C.items[a.id];
    if (!it) return null;
    const n = judgeSpeech(it, a.alts, false), m = judgeSpeech(it, a.alts, true);
    return { id: a.id, alts: a.alts.join(' / '), score: +n.r.best.toFixed(2), pass: n.pass, recall: m.pass, ctx: !!n.r.ctx, trap: n.r.toneTrap || '' };
  }).filter(Boolean)`);
  const key = r => r.id + ' ← ' + r.alts;
  const line = r => `${r.pass ? 'ผ่าน' : 'ไม่ผ่าน'}/${r.recall ? 'ผ่าน' : 'ไม่ผ่าน'} ${r.score}${r.ctx ? ' ctx' : ''}${r.trap ? ' trap=' + r.trap : ''}`;
  const now = Object.fromEntries(got.map(r => [key(r), line(r)]));
  if (UPDATE || !fs.existsSync(GOLDEN)) {
    fs.writeFileSync(GOLDEN, '{\n' + Object.entries(now).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
    ok(`บันทึกผลอ้างอิงใหม่ ${got.length} ครั้ง → tests/fixtures/sr-golden.json`);
  } else {
    const gold = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    const diffs = Object.keys(now).filter(k => gold[k] !== undefined && gold[k] !== now[k]);
    const fresh = Object.keys(now).filter(k => gold[k] === undefined);
    check(diffs.length === 0, `${Object.keys(now).length - fresh.length} ครั้งได้ผลเหมือนเดิม` +
      (diffs.length ? `\n      เปลี่ยน ${diffs.length} ครั้ง (ถ้าตั้งใจ: npm run test:update):\n` + diffs.slice(0, 15).map(k => `      ${k}\n        เดิม ${gold[k]} → ใหม่ ${now[k]}`).join('\n') : ''));
    if (fresh.length) fail(`${fresh.length} ครั้งยังไม่มีผลอ้างอิง — รัน npm run test:update`);
  }
  // The rules the scoring promises, checked on hand-picked cases so the golden file can't hide a wrong baseline.
  const j = (id, alts, recall = false) => app.run(`judgeSpeech(C.items[${JSON.stringify(id)}], ${JSON.stringify(alts)}, ${recall}).pass`);
  check(j('zhaoqian', ['找钱']) === true, 'พูดตรงเป๊ะ → ผ่าน');
  check(j('zhaoqian', ['赵强']) === true, 'วลีที่คนจีนฟังออกจากบริบท (找钱 ← 赵强) → ผ่าน');
  check(j('mai3', ['卖']) === false, 'คำเดียววรรณยุกต์ผิดเป็นอีกคำ (买 ← 卖) → ไม่ผ่าน');
  check(j('dache', ['大叔']) === false, 'ฟังเป็นคำอื่นทั้งคำ (打车 ← 大叔) → ไม่ผ่าน');
  check(app.errors.length === 0, 'ไม่มี error' + (app.errors.length ? ': ' + app.errors[0] : ''));
  app.close();
}

// ---------------------------------------------------------------- 3. play every session through the real buttons
// A learner who has finished the course, so every practice mode has words to draw from.
function learnedState(app) {
  return app.run(`(() => {
    const s = defaultState();
    s.onboarded = true;
    s.settings.unlimitedHearts = true;
    for (const [id, it] of Object.entries(C.items)) if (!it.npc) s.srs[id] = { box: 2, due: today(), right: 2, wrong: 1 };
    for (const e of C.order) s.lessons[e.id] = { stars: 3, best: 1, attempts: 1, doneAt: today() };
    s.unlockedUpTo = C.order[C.order.length - 1].id;
    for (const id of Object.keys(C.items).slice(0, 12)) s.speakMiss[id] = { miss: 5, ok: 0 };
    s.speakMissSeeded = true;
    return JSON.parse(JSON.stringify(s));
  })()`);
}

// Plays the session that is open until the finish screen. `wrongEvery`: answer wrong on purpose now and then,
// so the retry queue and the wrong-answer screens are exercised too.
async function playSession(app, label, wrongEvery = 6) {
  const { w, run } = app;
  const $ = s => w.document.querySelector(s);
  const $$ = s => [...w.document.querySelectorAll(s)];
  const foot = () => $('#l-foot button.btn:not([disabled])');
  let graded = 0;
  for (let step = 0; step < 600; step++) {
    if (!run('!!L')) return `${label}: ออกจากบทเองกลางคัน`;
    if ($('#l-body .complete')) { foot().click(); await tick(); return null; }
    const ex = run('L.queue[L.i]');
    const before = run('L.i');
    const wrong = wrongEvery && ++graded % wrongEvery === 0;
    const opts = $$('#l-body .options .opt');
    if (ex.type === 'intro' || ex.type === 'frame') foot().click();
    else if (ex.type === 'match') {
      const cols = $$('#l-body .match-col');
      for (const b of [...cols[0].children]) {
        const mean = ex.items.find(it => b.querySelector('.opt-py').textContent === it.pinyin).meaning;
        b.click();
        [...cols[1].children].find(x => x.textContent === mean && !x.disabled).click();
      }
      foot().click();
    } else if (ex.type === 'build') {
      for (const word of wrong ? ex.answer.slice(0, 1) : ex.answer) {
        const k = ex.bank.findIndex((t, i) => t.py === word && !$$('#l-body .build-bank .tile')[i].disabled);
        $$('#l-body .build-bank .tile')[k].click();
      }
      foot().click(); await tick(); foot().click();
    } else if (ex.type === 'speak' || ex.type === 'say') {
      const mic = $('#l-body .mic');
      if (!mic) return `${label}: ข้อพูดไม่มีปุ่มไมค์ (${ex.item && ex.item.id})`;
      // First try: something else was heard. Second try: the phrase itself.
      for (const heard of wrong ? ['你好吗', null] : [null]) {
        w.__heard = heard ? [heard] : [run('speakText(L.queue[L.i].item)')];
        mic.click();
        await tick(5);
      }
      if (!foot()) return `${label}: พูดถูกแล้วแต่ไม่ผ่าน (${ex.item && ex.item.id} ← ${w.__heard})`;
      foot().click();
    } else if (ex.type === 'tone_speak') foot().click();
    else if (opts.length) {
      // listen / meaning / talk / num / tone / dialog / any new choice exercise: the right option is the one the
      // exercise itself calls correct, found by trying each option's own test.
      const right = run('L.opts && L.isOk ? L.opts.findIndex(o => L.isOk(o)) : -1');
      if (right < 0 || right >= opts.length) return `${label}: หาคำตอบที่ถูกของข้อ ${ex.type} ไม่ได้`;
      opts[wrong ? (right + 1) % opts.length : right].click();
      foot().click(); await tick();
      const wasRight = run('Log.items.filter(e => e.g === "ans").pop().m').includes('ถูก');
      if (wasRight === wrong) return `${label}: ข้อ ${ex.type} ตอบ${wrong ? 'ผิด' : 'ถูก'}แต่ระบบว่า${wasRight ? 'ถูก' : 'ผิด'}`;
      foot().click();
    } else return `${label}: ไม่รู้จักข้อ ${ex.type}`;
    await tick();
    if (app.errors.length) return `${label}: ${ex.type} ${ex.item && ex.item.id || ''} → ${app.errors[0]}`;
    if (run('!!L') && !$('#l-body .complete') && run('L.i') === before) return `${label}: ค้างที่ข้อ ${ex.type} ${ex.item && ex.item.id || ''}`;
  }
  return `${label}: ไม่จบใน 600 ขั้น`;
}

const PRACTICE_MODES = [['review'], ['mix'], ['recall'], ['hard'], ['listen'], ['tone'],
  ['talk', { id: 'talk-all', setId: 'all' }], ['numbers', { id: 'num-all', setId: 'all' }],
  ['scene', { id: 'scene' }], ['exam', { id: 'exam' }], ['replies', { id: 'rep-all', setId: 'all' }], ['sounds', { id: 'snd-all', setId: 'all' }],
  ['pattern', { id: 'pat-all', patId: 'all' }],
  ...['yao', 'buyao', 'count', 'price', 'tai', 'keyi', 'where', 'nearby', 'have', 'go', 'time', 'trouble'].map(p => ['pattern', { id: 'pat-' + p, patId: p }])];

async function testPlay() {
  console.log('play (เล่นทุกด่านจนจบ)');
  const boot = await openApp();
  const state = learnedState(boot);
  const path0 = boot.run('C.order.map(e => ({ id: e.id, kind: e.kind }))');
  const modes = PRACTICE_MODES;
  boot.close();
  const app = await openApp(state);
  app.run('Speech.recognize = async () => window.__heard; Speech.toneAvailable = () => false;');
  const problems = [];
  let played = 0;
  const go = async (label, start) => {
    app.errors.length = 0;
    app.run(start);
    await tick();
    if (!app.run('!!L')) { problems.push(`${label}: เริ่มไม่ได้ (ไม่มีข้อให้เล่น)`); return; }
    const p = await playSession(app, label);
    if (p) { problems.push(p); app.run('if (L) endSession()'); await tick(); } else played++;
  };
  for (const e of path0) await go(e.id, `startSession(${JSON.stringify(e.kind)}, C.byId[${JSON.stringify(e.id)}])`);
  for (const [mode, entry] of modes) await go(mode + (entry ? ':' + entry.id : ''), `startSession(${JSON.stringify(mode)}, ${JSON.stringify(entry || null)})`);
  check(problems.length === 0, `${played} ด่าน/โหมด เล่นจนจบได้` + (problems.length ? `\n      พัง ${problems.length}:\n` + problems.slice(0, 12).map(p => '      ' + p.split('\n').slice(0, 3).join('\n        ')).join('\n') : ''));
  // Every top-level screen renders.
  for (const tab of ['learn', 'phrases', 'review', 'me', 'settings', 'help', 'guide']) {
    app.errors.length = 0;
    app.run(`location.hash = '#/${tab}'`);
    await tick(20);
    check(app.errors.length === 0 && app.w.document.querySelector('#screen').children.length > 0, `หน้า ${tab} เปิดได้` + (app.errors.length ? ': ' + app.errors[0].split('\n')[0] : ''));
  }
  app.close();
}

await testContent();
await testSpeech();
await testPlay();
console.log(failed ? `\n✗ ไม่ผ่าน ${failed} ข้อ` : '\n✓ ผ่านทั้งหมด');
process.exit(failed ? 1 : 0);
