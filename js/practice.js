'use strict';
/* พูดจีนรอดใน 20 วัน — js/practice.js: from memorised phrases to speaking
 * Sentence patterns (swap a word), free-reply situations + the 10-situation exam, what locals answer back,
 * look-alike sounds, and the "passed on the first try" measure. Content: content/patterns.json.
 */

// ============================================================ Speaking: free reply, measures
const replyOpen = st => !!S.srs[st.ask];

// The other ways to say it, shown once the answer is out.
function altList(cands, said) {
  const others = cands.filter(c => c !== said);
  if (!others.length) return null;
  return h('div', { class: 'alt-list' }, h('div', { class: 'muted small' }, 'พูดแบบนี้ก็ได้'),
    ...others.map(c => h('button', { class: 'chip-btn', onclick: () => play(c) }, pyEl(c.pinyin), ' 🔊')));
}

// "Passed on the first try" is the honest measure of speaking: retries and hints don't count.
function markFirstTry(pass) {
  const d = today(), r = S.firstTry[d] || (S.firstTry[d] = [0, 0]);
  r[0]++; if (pass) r[1]++;
  const cutoff = addDays(d, -60);
  for (const k of Object.keys(S.firstTry)) if (k < cutoff) delete S.firstTry[k];
}
// Days [from, to] counted back from today (0 = today).
function firstTryRate(from, to) {
  let n = 0, ok = 0;
  for (let i = from; i <= to; i++) { const r = S.firstTry[addDays(today(), -i)]; if (r) { n += r[0]; ok += r[1]; } }
  return { n, ok, pct: n ? Math.round(ok / n * 100) : null };
}

function examResult(sess) {
  const n = sess.examN || sess.queue.length, pass = sess.examPass || 0;
  S.exams.push({ d: today(), pass, n });
  if (S.exams.length > 30) S.exams.splice(0, S.exams.length - 30);
  const p = pass / n;
  return `🎓 ผ่าน ${pass}/${n} สถานการณ์ — ` + (p >= 0.8 ? 'พร้อมใช้จริงแล้ว!' : p >= 0.5 ? 'เอาตัวรอดได้ ฝึกข้อที่พลาดอีกนิด' : 'ยังต้องฝึกอีก ลอง "พูดเองตามสถานการณ์" ก่อน');
}
const examBest = () => S.exams.reduce((b, e) => (!b || e.pass / e.n > b.pass / b.n ? e : b), null);

// ============================================================ Exercises
// The frame of a sentence pattern with two examples, before the learner makes their own.
function exFrame(ex) {
  const p = ex.pattern;
  setFoot(footBtn('เข้าใจแล้ว ลองเลย', advance, 'btn-primary'));
  if (ex.examples[0]) setTimeout(() => play(ex.examples[0]), 300);
  return h('div', { class: 'ex' },
    h('div', { class: 'tag' }, '🧩 โครงประโยค'),
    h('div', { class: 'word big' },
      h('div', { class: 'frame-hz', lang: 'zh-CN' }, p.frame),
      h('div', { class: 'word-py' }, p.framePy),
      h('div', { class: 'word-mean' }, `${p.icon} ${p.title}`)),
    pandaSay('hi', p.tip),
    h('p', { class: 'muted' }, 'ตัวอย่าง — แตะเพื่อฟัง แล้วสังเกตว่าเปลี่ยนแค่คำเดียว'),
    ...ex.examples.map(x => h('div', { class: 'phrase' },
      h('button', { class: 'phrase-main', onclick: () => play(x) },
        h('div', { class: 'phrase-mean' }, x.meaning),
        h('div', { class: 'phrase-py' }, pyEl(x.pinyin), S.settings.showThai ? h('span', { class: 'phrase-th' }, ' · ' + x.thai) : null)),
      h('button', { class: 'btn-play', 'aria-label': 'ฟังเสียง', onclick: () => play(x) }, '🔊'))));
}

// Two or three words that differ in one sound: which one was it? Afterwards, hear them side by side.
function exSound(ex) {
  const g = ex.group, target = g[ex.answer];
  setTimeout(() => play(target), 250);
  let enable;
  const list = choiceList(g.map((_, i) => i), i => [h('div', { class: 'opt-py' }, pyEl(g[i].pinyin)), h('div', { class: 'opt-th' }, `${g[i].thai} · ${g[i].meaning}`)], () => enable());
  list.wrap.classList.add('grid2');
  const compare = h('div', { class: 'alt-list' });
  enable = checkFlow(list.get, sel => sel === ex.answer, target, [], ok => {
    const r = S.soundStats[ex.set.id] || (S.soundStats[ex.set.id] = [0, 0]);
    r[0]++; if (ok) r[1]++;
    save();
    compare.replaceChildren(h('div', { class: 'muted small' }, 'ฟังเทียบกัน'),
      ...g.map(w => h('button', { class: 'chip-btn', onclick: () => play(w) }, pyEl(w.pinyin), ' 🔊')));
  });
  return h('div', { class: 'ex' }, h('div', { class: 'tag' }, '👄 ' + ex.set.title), prompt('ได้ยินคำไหน?'),
    h('div', { class: 'big-play' }, h('button', { class: 'btn-speaker', 'aria-label': 'ฟังอีกครั้ง', onclick: () => play(target) }, '🔊'),
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(target, true) }, '🐢')),
    list.wrap, h('p', { class: 'muted small' }, '💡 ' + ex.set.tip), compare);
}

// ============================================================ Cards on the review screen
function sceneCard() {
  const all = C.pat.scenes, open = all.filter(sentOpen);
  if (!all.length) return null;
  const off = Speech.level() !== 'A';
  const last = S.exams[S.exams.length - 1], best = examBest();
  return h('section', { class: 'card-box' },
    h('h3', {}, '🗣️ พูดเองตามสถานการณ์'),
    h('p', { class: 'muted' }, 'บอกแค่ว่าเกิดอะไรขึ้น ไม่มีตัวเลือก ไม่มีคำให้ดู · คุณคิดเองว่าจะพูดอะไร · ตอบได้หลายแบบ · ติดได้กด 💡 ใบ้ · ไม่เสียหัวใจ'),
    h('button', { class: 'btn btn-primary', disabled: open.length < 4 || Speech.level() === 'off', onclick: () => startSession('scene', { id: 'scene' }) },
      open.length < 4 ? 'เรียนเพิ่มอีกหน่อยก่อน' : `🗣️ ฝึก 8 สถานการณ์ (เปิดแล้ว ${open.length}/${all.length})`),
    h('h3', { style: 'margin-top:16px' }, '🎓 สอบ 10 สถานการณ์'),
    h('p', { class: 'muted' }, 'ไม่มีตัวช่วย พูดได้ข้อละ 2 ครั้ง · ผ่าน 8 ข้อขึ้นไป = พร้อมใช้จริง' +
      (last ? ` · ล่าสุด ${last.pass}/${last.n}` + (best && best !== last ? ` · ดีสุด ${best.pass}/${best.n}` : '') : '')),
    h('button', { class: 'btn btn-jade', disabled: open.length < 10 || off, onclick: () => startSession('exam', { id: 'exam' }) },
      open.length < 10 ? `ต้องเปิดให้ได้ 10 สถานการณ์ก่อน (ตอนนี้ ${open.length})` : off ? 'ต้องใช้ระบบตรวจคำพูด' : '🎓 เริ่มสอบ'));
}

function patternCard() {
  const pats = C.pat.patterns;
  if (!pats.length) return null;
  const nOpen = p => p.sentences.filter(sentOpen).length;
  const anyOpen = pats.reduce((s, p) => s + nOpen(p), 0);
  return h('section', { class: 'card-box' },
    h('h3', {}, '🧩 ประกอบประโยคเอง'),
    h('p', { class: 'muted' }, 'เรียนโครงประโยคหนึ่งแบบ แล้วเปลี่ยนคำเอง เช่น 我要 + ของ · เห็นแค่ภาษาไทย ต้องพูดประโยคที่ไม่เคยท่อง · ใช้เฉพาะคำที่เรียนแล้ว · ไม่เสียหัวใจ'),
    h('div', { class: 'num-sets' }, ...pats.map(p => {
      const n = nOpen(p);
      return h('button', { class: 'chip-btn', disabled: n < 3, onclick: () => startSession('pattern', { id: 'pat-' + p.id, patId: p.id }) },
        `${p.icon} ${p.title}` + (S.patDone[p.id] ? ' ✓' : ''), h('small', { class: 'muted', lang: 'zh-CN' }, ' ' + p.frame));
    }), h('button', { class: 'chip-btn on', disabled: anyOpen < 6 || Speech.level() === 'off', onclick: () => startSession('pattern', { id: 'pat-all', patId: 'all' }) }, '🎲 สุ่มรวมทุกโครง')));
}

function repliesCard() {
  const sets = C.pat.replies;
  if (!sets.length) return null;
  return h('section', { class: 'card-box' },
    h('h3', {}, '👂 คนจีนตอบว่าอะไร'),
    h('p', { class: 'muted' }, 'คุณถามได้แล้ว แต่เขาตอบไม่เหมือนในบทเรียนเสมอไป · ฟังคำตอบหลายแบบของคำถามเดียว ครึ่งหนึ่งเป็นความเร็วจริง ⚡ · มีคำใหม่ที่ต้องฟังให้ออก · ไม่เสียหัวใจ'),
    h('div', { class: 'num-sets' }, ...sets.map(st => h('button', { class: 'chip-btn', disabled: !replyOpen(st), onclick: () => startSession('replies', { id: 'rep-' + st.id, setId: st.id }) }, `${st.icon} ${st.title}`)),
      h('button', { class: 'chip-btn on', disabled: !sets.some(replyOpen), onclick: () => startSession('replies', { id: 'rep-all', setId: 'all' }) }, '🎲 รวมทุกแบบ')));
}

function soundsCard() {
  const sets = C.pat.sounds;
  if (!sets.length) return null;
  const pct = st => { const r = S.soundStats[st.id]; return r && r[0] >= 4 ? ` ${Math.round(r[1] / r[0] * 100)}%` : ''; };
  return h('section', { class: 'card-box' },
    h('h3', {}, '👄 แยกเสียงที่คล้ายกัน'),
    h('p', { class: 'muted' }, 'เสียงที่หูคนไทยฟังเป็นเสียงเดียวกัน เช่น q / x / j หรือ -n / -ng · ฟังแล้วเลือกว่าเป็นคำไหน แล้วฟังเทียบกัน · ถ้าหูแยกไม่ออก ปากก็พูดไม่ถูก'),
    h('div', { class: 'num-sets' }, ...sets.map(st => h('button', { class: 'chip-btn', onclick: () => startSession('sounds', { id: 'snd-' + st.id, setId: st.id }) }, st.title + pct(st))),
      h('button', { class: 'chip-btn on', onclick: () => startSession('sounds', { id: 'snd-all', setId: 'all' }) }, '🎲 รวมทุกเสียง')));
}

// "Can I speak?" in numbers, on the progress screen.
function speakingCard() {
  const now = firstTryRate(0, 6), before = firstTryRate(7, 13);
  const last = S.exams[S.exams.length - 1], best = examBest();
  const trend = now.pct != null && before.pct != null && before.n >= 10 ? (now.pct > before.pct ? ` ▲ จาก ${before.pct}%` : now.pct < before.pct ? ` ▼ จาก ${before.pct}%` : ' เท่าสัปดาห์ก่อน') : '';
  return h('section', { class: 'card-box' }, h('h3', {}, '🗣️ พูดได้แค่ไหนแล้ว'),
    h('div', { class: 'stat-grid' },
      statCard('🎯', now.pct == null ? '—' : now.pct + '%', 'พูดผ่านตั้งแต่ครั้งแรก (7 วัน)'),
      statCard('🎓', last ? `${last.pass}/${last.n}` : '—', 'สอบสถานการณ์ล่าสุด'),
      statCard('🏅', best ? `${best.pass}/${best.n}` : '—', 'สอบสถานการณ์ดีสุด')),
    h('p', { class: 'muted small' }, now.n ? `จาก ${now.n} ข้อพูด${trend} · ไม่นับการพูดซ้ำและการใช้ตัวช่วย` : 'ยังไม่มีข้อมูล 7 วันล่าสุด — ทำข้อพูดในบทเรียนหรือหน้าทบทวน'));
}
