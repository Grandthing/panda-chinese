'use strict';
/* พูดจีนรอดใน 20 วัน — js/lesson.js: Lesson player: one function per exercise type
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
 */

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
  const back = L && (L.mode === 'vocab' || L.mode === 'vocabreview') ? '#/vocab' : '#/learn';
  L = null;
  TTS.persona = null;
  stopAudio();
  const el = lessonEl();
  el.hidden = true; el.replaceChildren();
  // Leaving #/lesson fires hashchange, which renders; only render directly if the hash won't change.
  if (location.hash === back) render(); else location.replace(back);
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
  TTS.shuffle();
  const body = $('#l-body');
  body.scrollTop = 0;
  logI('ex', `${L.i + 1}/${L.queue.length} ${ex.type}${ex.retry ? '(ซ่อม)' : ''}${ex.recall ? '(จำ)' : ''} ${(ex.scene && ex.scene.id) || (ex.pattern && ex.pattern.id) || (ex.item && ex.item.id) || (ex.set && ex.set.id) || (ex.dialog && ex.dialog.id) || (ex.target && ex.target.pinyin) || ''}`);
  const R = { vintro: exVocabIntro, frame: exFrame, sound: exSound, talk: exTalk, num: exNum, intro: exIntro, listen: exListen, meaning: exMeaning, build: exBuild, tone: exTone, speak: exSpeak, match: exMatch, dialog: exDialog, tone_speak: exToneSpeak }[ex.type];
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
      partsRow(info, true),
      info.hanzi ? h('button', { class: 'btn-play small', 'aria-label': 'ฟังเสียง', onclick: () => play(info) }, '🔊') : null) : null,
    footBtn('ต่อไป', advance, ok ? 'btn-jade' : 'btn-danger'));
  if (info && info.hanzi) play(info);
}

const prompt = text => h('h2', { class: 'prompt' }, text);
function choiceList(options, render, onPick) {
  const wrap = h('div', { class: 'options' });
  let sel = null;
  if (L) L.opts = options; // with L.isOk: lets tests/run.mjs find the right answer the same way the exercise does
  options.forEach(o => {
    const b = h('button', { class: 'opt', onclick: () => { sel = o; wrap.querySelectorAll('.opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sfx('tap'); onPick(o, b); } }, render(o));
    wrap.append(b);
  });
  return { wrap, get: () => sel };
}
function checkFlow(getSel, isOk, info, srsIds, after) {
  L.isOk = isOk;
  const btn = footBtn('ตรวจคำตอบ', () => {
    const ex = L.queue[L.i];
    const ok = isOk(getSel());
    grade(ex, ok, srsIds);
    lockOptions();
    if (ok && ex.thenSpeak && ex.item) {
      L.queue.splice(L.i + 1, 0, { type: 'speak', item: ex.item, must: ex.must, follow: true, uid: L.nextUid++ });
      feedback(ok, info, { title: 'ถูก! ต่อไปพูดออกเสียง 🎙️' });
    } else feedback(ok, info);
    if (after) after(ok);
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
    h('div', { class: 'tag' }, it.listenOnly ? '👂 ประโยคที่คนจีนจะพูดกับคุณ' : '✨ คำใหม่'),
    wordCard(it), playBtns(it),
    it.note ? pandaSay('hi', it.note) : null,
    soundTips(it));
}

// The Thai reading can only write z/zh as "จ", c/ch as "ช" and s/sh as "ซ/ส", and reading it that way is
// exactly what the recogniser hears as j/q/x (zǒu → jiǔ, cèsuǒ → qì sǐ). Say so the first time the word is met.
function soundTips(it) {
  if (it.listenOnly) return null;
  const inis = [...new Set(sylls(it.pinyin).map(s => splitSyl(s.text).ini).filter(i => /^(z|c|zh|ch|sh)$/.test(i)))];
  if (!inis.length) return null;
  return h('div', { class: 'recall-hint' }, ...inis.map((i, k) => [k ? h('br') : null, '🗣 ' + INI_HINT[i]]));
}

function exListen(ex) {
  const it = ex.item;
  setTimeout(() => play(it), 250);
  let enable;
  const list = choiceList(ex.options, id => C.items[id].meaning, () => enable());
  enable = checkFlow(list.get, sel => sel === it.id, it, [it.id]);
  return h('div', { class: 'ex' }, prompt('ฟังแล้วเลือกความหมาย'),
    h('div', { class: 'big-play' }, h('button', { class: 'btn-speaker', 'aria-label': 'ฟังอีกครั้ง', onclick: () => play(it) }, '🔊'),
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(it, true) }, '🐢'), fastBtn(it)),
    list.wrap);
}

function exNum(ex) {
  const it = ex.item, ln = ex.line;
  setTimeout(() => play(ln), 250);
  let enable;
  const list = choiceList(ex.options, o => h('div', { class: 'opt-num' }, o.label), () => enable());
  enable = checkFlow(list.get, sel => sel === it, ln, []);
  return h('div', { class: 'ex' }, h('div', { class: 'tag' }, `${it.set.icon} ${it.set.title}`), prompt('ฟังแล้วเลือก: ' + it.set.ask),
    h('div', { class: 'big-play' }, h('button', { class: 'btn-speaker', 'aria-label': 'ฟังอีกครั้ง', onclick: () => play(ln) }, '🔊'),
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(ln, true) }, '🐢'), fastBtn(ln)),
    list.wrap);
}

function exTalk(ex) {
  const it = ex.item;
  setTimeout(() => play(it, ex.fast ? 'fast' : false), 250);
  let enable;
  const list = choiceList(ex.options, o => o.meaning, () => enable());
  enable = checkFlow(list.get, sel => sel === it, it, []);
  return h('div', { class: 'ex' }, h('div', { class: 'tag' }, `${it.set.icon} ${it.set.title}`), prompt(ex.fast ? 'ฟังแล้วเลือกความหมาย ⚡ ความเร็วจริง' : 'ฟังแล้วเลือกความหมาย'),
    h('div', { class: 'big-play' }, h('button', { class: 'btn-speaker', 'aria-label': 'ฟังอีกครั้ง', onclick: () => play(it, ex.fast ? 'fast' : false) }, '🔊'),
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(it, true) }, '🐢'), ex.fast ? null : fastBtn(it)),
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
      h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(target, true) }, '🐢'), fastBtn(target)),
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
// The local's line while you're still listening: sound only, no pinyin or meaning.
function hiddenBubble(it) {
  return h('div', { class: 'msg npc' }, panda('hi', 40),
    h('div', { class: 'msg-b hidden-line' }, h('div', { class: 'muted' }, '👂 ฟังให้ดี…'),
      h('div', { class: 'play-row' },
        h('button', { class: 'btn-play small', 'aria-label': 'ฟังเสียง', onclick: () => play(it) }, '🔊'),
        h('button', { class: 'btn-play small slow', 'aria-label': 'ฟังช้า', onclick: () => play(it, true) }, '🐢'),
        h('button', { class: 'btn-play small fast', 'aria-label': 'ฟังเร็วแบบคนจริง', onclick: () => play(it, 'fast') }, '⚡'))));
}
function exDialog(ex) {
  const d = ex.dialog, lines = d.lines, k = ex.upto;
  const listen = !!ex.listen, heardAt = listen ? k - 1 : -1;
  const chat = h('div', { class: 'chat' });
  if (d.scene) chat.append(h('div', { class: 'scene' }, '🎬 ' + d.scene));
  let lastMe = -1;
  for (let i = 0; i < k; i++) if (lines[i].who === 'me') lastMe = i;
  const toPlay = [];
  for (let i = 0; i < k; i++) {
    const ln = lines[i];
    const it = C.items[ln.who === 'npc' ? ln.item : ln.answer];
    if (!it) continue;
    chat.append(i === heardAt ? hiddenBubble(it) : bubble(ln.who, it));
    // The reply step comes right after hearing the line: don't play it a second time.
    if (ln.who === 'npc' && i > lastMe && !(L.queue[L.i - 1] && L.queue[L.i - 1].listen && L.queue[L.i - 1].dialog === d)) toPlay.push(it);
  }
  (async () => { await new Promise(r => setTimeout(r, 300)); for (const it of toPlay) { if (!L || L.queue[L.i] !== ex) return; await play(it); } })();
  let enable;
  if (listen) {
    // 1) What did they say? Choices are meanings of other things locals say in the course.
    const said = C.items[lines[heardAt].item];
    const others = shuffle(Object.values(C.items).filter(o => o.npc && o.id !== said.id && o.meaning !== said.meaning)).slice(0, 3);
    const opts = shuffle([said, ...others]);
    const list = choiceList(opts, o => h('div', { class: 'opt-th' }, o.meaning), () => enable());
    enable = checkFlow(list.get, sel => sel === said, said, []);
    setTimeout(() => list.wrap.scrollIntoView({ block: 'end', behavior: 'smooth' }), 350);
    return h('div', { class: 'ex' }, prompt('คนจีนพูดว่าอะไร?'), chat, list.wrap);
  }
  // 2) Reply: the situation in Thai, choices in pinyin only (💡 shows the Thai), then say it.
  const cur = lines[k];
  if (cur.cue) chat.append(h('div', { class: 'cue' }, '👉 ' + cur.cue));
  const answer = C.items[cur.answer];
  // Hints: Thai reading first (if shown in settings), then the meaning.
  const steps = S.settings.showThai ? 2 : 1;
  let hints = 0;
  const opts = shuffle([cur.answer, ...(cur.distractors || [])].filter(id => C.items[id]));
  const optEl = id => {
    const o = C.items[id];
    return [h('div', { class: 'opt-py' }, pyEl(o.pinyin)),
      steps === 2 && hints >= 1 ? h('div', { class: 'opt-th' }, o.thai) : null,
      hints >= steps ? h('div', { class: 'opt-th' }, o.meaning) : null].filter(Boolean);
  };
  const list = choiceList(opts, optEl, id => { play(C.items[id]); enable(); });
  const hintBtn = h('button', { class: 'btn btn-ghost small', onclick: () => {
    hints++;
    list.wrap.querySelectorAll('.opt').forEach((b, i) => b.replaceChildren(...optEl(opts[i])));
    hintBtn.textContent = `💡 ใบ้ (${hints}/${steps})`;
    hintBtn.disabled = hints >= steps;
  } }, `💡 ใบ้ (0/${steps})`);
  const dex = L.queue[L.i];
  if (Speech.level() !== 'off' && canSpeak(answer)) { dex.thenSpeak = true; dex.must = true; dex.item = answer; }
  enable = checkFlow(list.get, sel => sel === cur.answer, answer, [cur.answer]);
  // Long conversations push the answers below the fold; bring them into thumb reach.
  setTimeout(() => list.wrap.scrollIntoView({ block: 'end', behavior: 'smooth' }), 350);
  return h('div', { class: 'ex' }, prompt('ตอบให้เหมาะกับสถานการณ์ แล้วพูดออกมา'), chat,
    h('p', { class: 'muted small' }, 'แตะตัวเลือกเพื่อฟังเสียง · ติดได้กด 💡'), list.wrap, h('div', { class: 'play-row' }, hintBtn));
}

// The whole verdict for one spoken attempt (kept apart from the screen so tests/run.mjs can replay real attempts).
function judgeSpeech(it, alts, recall, lenient) {
  const r = scoreSpeech(it, alts, lenient);
  const dv = r.best < 1 ? diffView(it, r.heard) : null;
  const dd = speechDiff(it, r.heard);
  // A wrong tone changes the word for a native listener, so it never passes as "close enough".
  const toneErr = !!dv && dd.syl.some(s => s.kind === 'tone');
  // A long sentence must be mostly right; a short word passes once it's recognisable.
  const pass = (r.best >= (recall ? 0.8 : normZh(it.hanzi).length >= 6 ? 0.75 : 0.5) && !toneErr) || r.ctx;
  return { r, dv, dd, toneErr, pass };
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
  // Free reply (ex.scene): a situation with several right answers; `it` is the model one. exam: no help, two tries.
  const cands = ex.alts || [it], sc = ex.scene || null, exam = !!ex.exam;
  let judged = 0;
  const box = h('div', { class: 'speak-box' });
  const status = h('div', { class: 'speak-status', role: 'status' });
  const diffBox = h('div');
  let attempts = 0, finished = false;
  // recall: only the Thai meaning is shown — say it from memory. Hints cost the "remembered" credit;
  // giving up (or 3 misses) shows the answer and the word comes back sooner in reviews.
  const recall = !!ex.recall;
  let hints = 0, revealed = !recall;
  const card = h('div');
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    srsUpdate(it.id, false);
    card.replaceChildren(wordCard(it), playBtns(it), altList(cands, it));
    showNpc();
    play(it);
  };
  // The local's line stays sound-only until the answer is out.
  const npcBox = h('div');
  const showNpc = () => { if (sc && sc.npc) npcBox.replaceChildren(bubble('npc', sc.npc)); };
  if (sc && sc.npc) npcBox.replaceChildren(hiddenBubble(sc.npc));
  const scene = sc ? h('div', { class: 'chat' }, h('div', { class: 'scene' }, `${sc.icon} ${sc.place}`), npcBox, h('div', { class: 'cue' }, '👉 ' + sc.cue)) : null;
  const hintCard = () => {
    const steps = [sc ? ['พูดว่า: ', h('b', {}, it.meaning)] : null, S.settings.showThai ? ['คำอ่านไทย: ', h('b', {}, it.thai)] : null, ['pinyin: ', h('b', {}, pyEl(it.pinyin))]].filter(Boolean);
    if (exam) return card.replaceChildren(h('p', { class: 'muted center' }, 'ไม่มีตัวช่วย · พูดได้ 2 ครั้ง'));
    card.replaceChildren(h('div', { class: 'word big recall' },
      sc ? null : h('div', { class: 'word-mean' }, it.meaning),
      ...steps.slice(0, hints).map(x => h('div', { class: 'recall-hint' }, ...x))),
      h('div', { class: 'play-row' },
        hints < steps.length ? h('button', { class: 'btn btn-ghost small', onclick: () => { hints++; hintCard(); } }, `💡 ใบ้ (${hints + 1}/${steps.length})`) : null,
        h('button', { class: 'btn btn-ghost small', onclick: () => { reveal(); status.textContent = 'ฟังเฉลย แล้วพูดตาม'; } }, '👀 ดูเฉลย')));
  };
  if (recall) hintCard(); else card.replaceChildren(wordCard(it), playBtns(it));
  const fromMemory = () => recall && !hints && !revealed;

  const done = (kind, r, said = it) => {
    if (finished) return;
    finished = true;
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    if (kind === 'skip') { setFoot(footBtn('ต่อไป', advance, 'btn-ghost')); advance(); return; }
    if (exam) { L.examN = (L.examN || 0) + 1; if (kind === 'auto') L.examPass = (L.examPass || 0) + 1; }
    if (sc) { showNpc(); card.replaceChildren(altList(cands, said)); }
    if (kind === 'fail') { save(); sfx('bad'); return feedback(false, it, { title: 'ข้อนี้ยังไม่ผ่าน — คำตอบคือ' }); }
    if (kind === 'auto') { S.stats.speakAuto++; S.stats.speakAutoPass++; if (!recall || fromMemory()) srsUpdate(it.id, true); L.xp += 3; addXp(3); }
    else { S.stats.speakSelf++; L.xp += 2; addXp(2); }
    if (fromMemory()) { L.xp += 2; addXp(2); L.recalled = (L.recalled || 0) + 1; }
    save();
    sfx('ok');
    feedback(true, said, { title: exam ? 'ผ่านข้อนี้ ✓' : fromMemory() ? (sc ? 'พูดเองได้! 🗣️🎉' : 'จำได้! พูดจากความจำ 🧠🎉') : kind === 'auto' ? (r.best >= 0.8 ? 'ชัดมาก! 🎉' : 'ใกล้แล้ว! ระบบฟังออก') : 'เยี่ยม! ฝึกพูดต่อไปนะ' });
  };
  const offerSelf = () => box.append(h('div', { class: 'self-row' },
    h('button', { class: 'btn btn-jade', onclick: () => done('self') }, '✓ ฉันพูดได้แล้ว (ตรวจเอง)')));
  const onMiss = () => {
    if (exam) { if (judged >= 2) done('fail'); return; }
    if (recall && !revealed && attempts >= 3) { reveal(); status.append(h('br'), 'เฉลยให้แล้ว — ฟังแล้วพูดตาม'); }
    else if (attempts === (recall ? 6 : 3)) offerSelf();
  };

  const renderA = () => {
    const mic = micButton('แตะแล้วพูด', async () => {
      if (mic.classList.contains('on')) { status.textContent = 'กำลังตรวจ…'; Speech.stop(); return; }
      stopAudio();
      mic.classList.add('on');
      mic.querySelector('.mic-l').textContent = 'แตะเมื่อพูดจบ';
      status.textContent = 'กำลังเปิดไมค์…';
      const t0 = Date.now();
      try {
        const alts = await Speech.recognize({
          timeoutMs: Math.max(6000, ...cands.map(c => normZh(c.hanzi).length * 700)),
          isGood: a => cands.some(c => heardWhole(c, a)),
          onStart: () => { status.textContent = 'พูดได้เลย 🎙️'; },
        });
        mic.classList.remove('on');
        mic.querySelector('.mic-l').textContent = 'แตะแล้วพูด';
        // Free reply: the first answer that passes, else the closest one (its diff is the most useful).
        const tries = cands.map(c => ({ c, ...judgeSpeech(c, alts, recall, ex.lenient) }));
        const hit = tries.find(t => t.pass) || tries.reduce((a, b) => (b.r.best > a.r.best ? b : a));
        const { r, dv, dd, toneErr, pass } = hit;
        attempts++;
        if (++judged === 1) markFirstTry(pass);
        logI('sr', `${hit.c.id} ได้ยิน [${alts.join(' / ')}] score=${r.best.toFixed(2)}${r.toneTrap ? ' trap=' + r.toneTrap : ''}${r.ctx ? ' ctx' : ''}` +
          (dd ? ' diff=' + dd.syl.map(s => s.kind === 'ok' ? '✓' : s.kind + (s.heardPy ? ':' + s.heardPy : '')).join(',') : '') + ` ${Date.now() - t0}ms`);
        diffBox.replaceChildren(dv || '');
        if (dv) setTimeout(() => diffBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
        if (pass) {
          if (r.ctx) status.replaceChildren('ผ่าน ✓ คนจีนน่าจะฟังออกจากบริบท — แต่ถ้าแก้จุดด้านล่างจะชัดขึ้น 👇');
          else if (dv) status.replaceChildren('ผ่าน แต่ยังมีจุดที่ควรแก้ 👇');
          if (C.items[it.id]) speakMark(it.id, true);
          return done('auto', r, hit.c);
        }
        if (C.items[it.id]) speakMark(it.id, false);
        save();
        sfx('bad');
        const ch = carrierHint(it);
        if (ch) diffBox.prepend(ch);
        if (toneErr && !r.toneTrap) {
          status.replaceChildren(h('b', { class: 'bad-t' }, '✕ วรรณยุกต์ผิด: '), 'ระบบได้ยิน ', h('b', { lang: 'zh-CN' }, r.heard), ' — ดูจุดที่ผิดด้านล่าง');
        } else if (r.toneTrap) {
          const info = lookupHanzi(r.toneTrap);
          status.replaceChildren(h('b', { class: 'bad-t' }, '✕ วรรณยุกต์ผิด: '), 'ระบบได้ยิน ', h('b', { lang: 'zh-CN' }, r.toneTrap),
            info ? [' ', pyEl(info.pinyin), ` (${info.meaning})`] : null, ' — คนจีนจะเข้าใจเป็นอีกคำ');
        } else status.replaceChildren(h('b', { class: 'bad-t' }, '✕ ยังไม่ตรง: '), 'ระบบได้ยิน ', h('b', { lang: 'zh-CN' }, r.heard || '(ไม่ชัด)'),
          dv ? ' — ดูจุดที่ผิดด้านล่าง' : ' — ฟังต้นแบบแล้วลองอีกครั้ง');
        onMiss();
      } catch (err) {
        mic.classList.remove('on');
        mic.querySelector('.mic-l').textContent = 'แตะแล้วพูด';
        logW('sr', `${it.id} error ${err} ${Date.now() - t0}ms`);
        if (err === 'no-speech' || err === 'aborted') {
          attempts++;
          status.textContent = 'ไม่ได้ยินเสียง ลองพูดดังขึ้นอีกนิด';
          onMiss();
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
      stopAudio();
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
  if (recall && lvl === 'C') status.textContent = 'นึกแล้วพูดออกมา จากนั้นกด "ดูเฉลย" เพื่อเทียบ';
  if (sc && sc.npc) setTimeout(() => play(sc.npc), 250);
  // must: the number drill only passes once you've said it (self-check still appears after 3 misses).
  setFoot(ex.must ? '' : footBtn('ข้ามข้อนี้', () => done('skip'), 'btn-ghost'));
  if (!recall) setTimeout(() => play(it), 250);
  return h('div', { class: 'ex' }, prompt(sc ? (exam ? '🎓 สอบ: คุณจะพูดว่าอะไร?' : '🗣️ คุณจะพูดว่าอะไร?') : recall ? '🧠 พูดเป็นภาษาจีนจากความจำ' : ex.follow ? 'ถูกแล้ว! ทีนี้พูดออกมา' : 'พูดตาม'), scene, card, box, status, diffBox,
    ex.must ? null : h('button', { class: 'link', onclick: snoozeMic }, 'ตอนนี้พูดไม่ได้ (พัก 15 นาที)'));
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

// Describes the user's own pitch curve (5 points, semitones around their voice centre) in plain words.
function contourText(c) {
  if (!c || c.length < 5) return 'เสียงคุณ';
  const rise = c[4] - c[0], dip = Math.min(...c) - Math.max(c[0], c[4]), lvl = mean(c);
  const shape = dip < -2 ? 'กดลงแล้วขึ้น' : rise > 2.5 ? 'ไล่ขึ้น' : rise < -2.5 ? 'ตกลง' : 'ค่อนข้างราบ';
  const height = lvl > 1.5 ? 'ช่วงสูง' : lvl < -1.5 ? 'ช่วงต่ำ' : 'ช่วงกลาง';
  return `เสียงคุณ${shape} ${height}`;
}

function exToneSpeak(ex) {
  const t = ex.target;
  const box = h('div', { class: 'speak-box' });
  const status = h('div', { class: 'speak-status', role: 'status' });
  const res = h('div', { class: 'tone-res' });
  let lastClip = null, passed = false, ctl = null;
  const meter = h('div', { class: 'meter' }, h('i'));

  const showResult = r => {
    // full pitch track (every 2nd frame) so a log shows whether e.g. the end of a tone-4 fall was captured
    logI('tone', `${t.pinyin} → ${r.reason ? r.reason + (r.diag ? ' ' + r.diag : '') : r.syl.map(s => `${s.target}:${s.got}${s.weak ? 'w' : ''}` + (s.curve ? ` [${s.curve.map(v => v.toFixed(1)).join(',')}]` +
      ` raw(${s.raw.filter((_, j) => j % 2 === 0).map(v => v.toFixed(0)).join(',')})` : '')).join(' ')}`);
    if (r.reason) {
      res.replaceChildren();
      status.textContent = r.reason === 'quiet' ? 'จับเส้นเสียงไม่ได้ ลองลากสระให้ยาวขึ้น (เช่น shìii) และพูดใกล้ไมค์' :`ลองพูดให้ได้ ${t.tones.length} พยางค์ชัด ๆ เว้นจังหวะนิดหนึ่ง`;
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
        h('b', {}, sp[i] ? sp[i].text : ''), h('small', {}, s.target === 5 ? 'เสียงเบา' : s.ok ? (s.weak ? '✓ ผ่าน แต่ยังเบา' : '✓ ถูก') : `คล้าย${TONE_NAME[s.got]}`)))),
      ...r.syl.map((s, i) => s.ok || s.target === 5 ? null : h('p', { class: 'hint' }, h('b', {}, pyEl(sp[i] ? sp[i].text : '')),
        ` — ต้องเป็น ${TONE_NAME[s.target]} แต่${contourText(s.curve)} จึงฟังเป็น${TONE_NAME[s.got]}`, h('br'), '💡 ' + TONE_HINT[s.target])),
      h('p', { class: 'muted small' }, 'เส้นประ = เป้าหมาย · เส้นทึบ = เสียงคุณ'));
    const weak = r.syl.filter(s => s.ok && s.weak);
    status.textContent = !r.ok ? 'ยังไม่ตรง ลองอีกครั้งได้' : weak.length
      ? `ผ่าน! แต่${weak.some(s => s.target === 4) ? 'เสียง 4 ให้ตกแรงกว่านี้ เหมือนพูด "ไม่!" แบบสั่ง' : 'เสียง 2 ให้ขึ้นสูงกว่านี้ เหมือนถาม "ห๊ะ?"'}` : 'วรรณยุกต์ถูกต้อง! 🎉';
    if (r.ok && !passed) { passed = true; sfx('ok'); L.xp += 3; addXp(3); setFoot(footBtn('ต่อไป', advance, 'btn-jade')); }
  };

  const renderMic = () => {
    const cal = !S.pitchProfile;
    status.textContent = cal ? 'ครั้งแรก: แตะไมค์แล้วพูด "อาาา" ยาว ๆ ด้วยเสียงพูดปกติ 2 วินาที (เพื่อปรับให้เข้ากับเสียงคุณ)' : 'แตะไมค์ แล้วพูดชัด ๆ — หยุดพูดแล้วระบบจะตรวจเอง';
    const mic = micButton(cal ? 'ปรับเสียง' : 'แตะแล้วพูด', async () => {
      if (ctl) { ctl.stop(); return; }
      stopAudio();
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
      showResult(toneCheck(clip, t.tones, t.pinyin));
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
  if (PATH_MODES.has(sess.mode)) {
    const e = sess.entry;
    const prev = S.lessons[e.id];
    S.lessons[e.id] = { stars: Math.max(stars, prev && !prev.skipped ? prev.stars : 0), best: Math.max(acc, prev ? prev.best || 0 : 0), attempts: (prev ? prev.attempts || 0 : 0) + 1, doneAt: today() };
    if (!isBonus(e)) unlockTo(e.index + 1);
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
  if (sess.mode === 'vocab') extra.unshift(vocabFinish(sess));
  if (sess.mode === 'exam') extra.unshift(examResult(sess));
  if (sess.mode === 'pattern' && sess.entry.patId !== 'all') S.patDone[sess.entry.patId] = (S.patDone[sess.entry.patId] || 0) + 1;
  if (sess.mode === 'pattern' || sess.mode === 'scene') extra.unshift(`🗣️ พูดเองได้โดยไม่ใช้ตัวช่วย ${sess.recalled || 0}/${sess.queue.filter(q => q.recall).length} ประโยค`);
  if (sess.mode === 'recall') extra.unshift(`🧠 จำได้เองโดยไม่ใช้ตัวช่วย ${sess.recalled || 0}/${sess.queue.filter(q => q.recall).length} คำ`);
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
    h('h2', {}, finalDone ? 'จบหลักสูตรแล้ว! 你真棒!' : sess.mode === 'skip' && acc < 0.8 ? 'เกือบแล้ว!' :
      sess.mode === 'challenge' || sess.mode === 'mix' ? (acc >= 0.8 ? 'คำเก่ายังจำได้ดี! 🏆' : 'ผ่านแล้ว! คำที่ผิดจะวนกลับมาให้ทบทวนอีก') : 'จบบทแล้ว!'),
    PATH_MODES.has(sess.mode) ? h('div', { class: 'stars big' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)) : null,
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
