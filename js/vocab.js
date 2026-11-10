'use strict';
/* พูดจีนรอดใน 20 วัน — js/vocab.js: "คลังคำ 500", a separate mode for after the 20-day course
 * 500 everyday words (content/vocab.json, built by tools/make_vocab.py) in stages of 5. Every word is practised
 * inside a short phrase, because a lone syllable can't be judged — and a phrase said a little off but still
 * understandable by a Chinese listener counts as right (lenient scoring, see contextOK in speech.js).
 * Progress lives in S.vocab, apart from the course's own review data, so the two can be merged later.
 */

// ============================================================ Content → stages
function vocabInit(data) {
  const V = C.vocab = { themes: data && data.themes ? data.themes : [], stages: [], words: [] };
  for (const th of V.themes) {
    const set = { icon: th.icon, title: th.title };
    for (const w of th.words) { w.id = 'v_' + w.hanzi; w.set = set; w.ex.id = w.id + '_ex'; V.words.push(w); }
    // Stages of 5 words; a leftover of 1–2 joins the stage before it.
    const groups = [];
    for (let i = 0; i < th.words.length; i += 5) groups.push(th.words.slice(i, i + 5));
    if (groups.length > 1 && groups[groups.length - 1].length < 3) groups[groups.length - 2].push(...groups.pop());
    th.stages = groups.map((ws, k) => ({ id: `v-${th.id}-${k + 1}`, theme: th, no: k + 1, words: ws }));
    V.stages.push(...th.stages);
  }
}
const vocabDone = st => !!S.vocab.done[st.id];
const vocabLearnedWords = () => C.vocab.stages.filter(vocabDone).flatMap(st => st.words);

// ============================================================ Sessions
// Hear the word and pick its meaning among the stage's other words (plus one from elsewhere).
function vocabListen(w, mates) {
  const far = pick(C.vocab.words.filter(x => x !== w && x.meaning !== w.meaning && !mates.includes(x)), 3);
  const near = pick(mates.filter(x => x !== w && x.meaning !== w.meaning), 2);
  return { type: 'talk', item: w, options: shuffle([w, ...near, ...far].slice(0, 4)) };
}
// A stage: meet each word and hear it, build + copy its phrase, then say every phrase from the Thai alone.
function vocabStageQueue(st, speakOK) {
  const q = [];
  for (const w of st.words) { q.push({ type: 'vintro', item: w }); q.push(vocabListen(w, st.words)); }
  const mid = [];
  for (const w of st.words) {
    mid.push(words(w.ex.pinyin).length >= 2 ? mkBuildSent(w.ex) : vocabListen(w, st.words));
    if (speakOK) mid.push({ type: 'speak', item: w.ex, lenient: true });
  }
  q.push(...shuffle(mid));
  for (const w of shuffle(st.words)) q.push(speakOK ? { type: 'speak', item: w.ex, recall: true, lenient: true } : vocabListen(w, st.words));
  return q;
}
// Review: 12 words from finished stages, the ones reviewed least first; half by ear, half said from memory.
function vocabReviewQueue(speakOK) {
  const seen = id => (S.vocab.rev[id] || 0) + rand() * 0.9;
  const ws = vocabLearnedWords().map(w => [w, seen(w.id)]).sort((a, b) => a[1] - b[1]).slice(0, 12).map(([w]) => w);
  for (const w of ws) S.vocab.rev[w.id] = (S.vocab.rev[w.id] || 0) + 1;
  const q = ws.map((w, k) => (k % 2 || !speakOK ? vocabListen(w, ws) : { type: 'speak', item: w.ex, recall: true, lenient: true }));
  return shuffle(q);
}
function vocabFinish(sess) {
  const st = C.vocab.stages.find(s => s.id === sess.entry.id);
  const prev = S.vocab.done[st.id];
  S.vocab.done[st.id] = { d: today(), n: (prev ? prev.n : 0) + 1 };
  return `📚 ${prev ? 'ทบทวนด่านนี้แล้ว' : 'ได้คำใหม่ ' + st.words.length + ' คำ'} · รวม ${vocabLearnedWords().length}/${C.vocab.words.length} คำ`;
}

// ============================================================ Exercise: a new word with its phrase
function exVocabIntro(ex) {
  const w = ex.item;
  setFoot(footBtn('ต่อไป', advance, 'btn-primary'));
  setTimeout(async () => { await play(w); if (L && L.queue[L.i] === ex) play(w.ex); }, 250);
  return h('div', { class: 'ex' },
    h('div', { class: 'tag' }, `${w.set.icon} คำใหม่ · ${w.set.title}`),
    wordCard(w), playBtns(w),
    h('p', { class: 'muted' }, 'ใช้ในประโยค — แตะเพื่อฟัง'),
    h('div', { class: 'phrase' },
      h('button', { class: 'phrase-main', onclick: () => play(w.ex) },
        h('div', { class: 'phrase-mean' }, w.ex.meaning),
        h('div', { class: 'phrase-py' }, pyEl(w.ex.pinyin), S.settings.showThai ? h('span', { class: 'phrase-th' }, ' · ' + w.ex.thai) : null),
        S.settings.showHanzi ? h('div', { class: 'phrase-hz', lang: 'zh-CN' }, w.ex.hanzi) : null),
      h('button', { class: 'btn-play', 'aria-label': 'ฟังเสียง', onclick: () => play(w.ex) }, '🔊')));
}

// ============================================================ Screens
function vocabCard() {
  const total = C.vocab.words.length;
  if (!total) return null;
  const got = vocabLearnedWords().length;
  return h('section', { class: 'card-box' },
    h('h3', {}, '📚 คลังคำ 500 (โหมดแยก หลังจบ 20 วัน)'),
    h('p', { class: 'muted' }, 'คำที่ใช้บ่อยในชีวิตจริงอีก 500 คำ ด่านละ 5 คำ · ฝึกพูดทุกคำในประโยคสั้น · พูดเพี้ยนนิดหน่อยแต่คนจีนฟังออก ถือว่าผ่าน'),
    h('div', { class: 'vbar' }, h('i', { style: `width:${got / total * 100}%` })),
    h('button', { class: 'btn btn-primary', onclick: () => { location.hash = '#/vocab'; } }, `📚 เปิดคลังคำ (${got}/${total} คำ)`));
}

function renderVocab() {
  const V = C.vocab, total = V.words.length, got = vocabLearnedWords().length;
  const next = V.stages.find(st => !vocabDone(st));
  const off = Speech.level() === 'off';
  screen().replaceChildren(h('div', { class: 'review' },
    h('h2', { class: 'page-title' }, '📚 คลังคำ 500'),
    h('p', { class: 'muted' }, 'เรียนตามลำดับ หรือเลือกหมวดที่อยากใช้ก่อนก็ได้ · ด่านละ 5 คำ ราว 5 นาที · ไม่เสียหัวใจ' + (off ? ' · ตอนนี้ปิดไมค์อยู่ จะได้ฝึกฟังและเรียงประโยคแทนการพูด' : '')),
    h('section', { class: 'card-box' },
      h('h3', {}, `เรียนแล้ว ${got}/${total} คำ`),
      h('div', { class: 'vbar' }, h('i', { style: `width:${total ? got / total * 100 : 0}%` })),
      h('button', { class: 'btn btn-primary', disabled: !next, onclick: () => startSession('vocab', { id: next.id }) },
        next ? `▶ เรียนต่อ: ${next.theme.icon} ${next.theme.title} ด่าน ${next.no}` : 'เรียนครบทุกด่านแล้ว 🎉'),
      h('button', { class: 'btn btn-ghost', disabled: got < 5, onclick: () => startSession('vocabreview', { id: 'vocab-review' }) },
        got < 5 ? 'จบด่านแรกก่อน แล้วจะทบทวนได้' : '🔁 ทบทวนคำที่เรียนแล้ว (12 คำ)')),
    ...V.themes.map(th => h('section', { class: 'card-box' },
      h('h3', {}, `${th.icon} ${th.title} `, h('small', { class: 'muted' }, `${th.stages.filter(vocabDone).reduce((n, st) => n + st.words.length, 0)}/${th.words.length} คำ`)),
      h('div', { class: 'num-sets' }, ...th.stages.map(st => h('button', { class: 'chip-btn' + (vocabDone(st) ? ' on' : ''), onclick: () => startSession('vocab', { id: st.id }) },
        (vocabDone(st) ? '✓ ' : st.no + '. '), h('span', { lang: 'zh-CN' }, st.words.map(w => w.hanzi).join(' '))))))),
    h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/review'; } }, '← กลับหน้าทบทวน')));
}
