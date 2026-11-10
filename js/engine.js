'use strict';
/* พูดจีนรอดใน 20 วัน — js/engine.js: Game state (hearts, XP, SRS) · Building the exercises of a session
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
 */

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

// Words the recognizer keeps failing when *you* say them (counted per attempt, passes pay it back).
function speakMark(id, ok) {
  const r = S.speakMiss[id] || (S.speakMiss[id] = { miss: 0, ok: 0 });
  if (ok) r.ok++; else r.miss++;
  r.t = Date.now();
}
// First run: rebuild the counts from the speaking attempts still in the log, so the list isn't empty on day one.
function seedSpeakMiss() {
  if (S.speakMissSeeded) return;
  S.speakMissSeeded = true;
  for (const e of Log.items) {
    if (e.g !== 'sr') continue;
    const m = /^(\S+) ได้ยิน .* score=([\d.]+)( trap=\S+)?( ctx)?/.exec(e.m);
    if (!m || !C.items[m[1]]) continue;
    speakMark(m[1], !!m[4] || (+m[2] >= 0.75 && !m[3] && !/diff=[^ ]*tone/.test(e.m)));
  }
  save();
}
const hardScore = r => r.miss - r.ok * 0.6;
const hardIds = () => Object.entries(S.speakMiss)
  .filter(([id, r]) => C.items[id] && !C.items[id].npc && canSpeak(C.items[id]) && r.miss >= 2 && hardScore(r) > 0)
  .sort((a, b) => hardScore(b[1]) - hardScore(a[1]) || b[1].miss - a[1].miss).map(([id]) => id);

const isDone = id => !!S.lessons[id];
function unlockedIdx() { const e = S.unlockedUpTo && C.byId[S.unlockedUpTo]; return e ? e.index : 0; }
function unlockTo(idx) {
  if (idx > unlockedIdx() && C.order[idx]) { S.unlockedUpTo = C.order[idx].id; save(); }
}
// Bonus units (bonus: true) are their own track, open from day one: each node opens when the previous bonus node is done.
const isBonus = e => !!(e && e.unit && e.unit.bonus);
function nodeState(e) {
  if (isDone(e.id)) return 'done';
  if (isBonus(e)) {
    const prev = C.order[e.index - 1];
    return !isBonus(prev) || isDone(prev.id) ? 'current' : 'locked';
  }
  const u = unlockedIdx();
  if (e.index === u) return 'current';
  return e.index < u ? 'open' : 'locked';
}
// A finished lesson whose newItems were extended after it was played.
const hasUnseen = e => e.kind === 'lesson' && isDone(e.id) && (e.lesson.newItems || []).some(id => !S.srs[id]);
const courseDone = () => C.order.length > 0 && C.order.every(e => isBonus(e) || isDone(e.id));

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
const canBuild = it => !it.listenOnly && words(it.pinyin).length >= 2 && !it.pinyin.includes('…');
// listenOnly items are what locals say back: you only need to recognise them, so they're drilled by ear only.
const canSpeak = it => !it.listenOnly;
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
// A whole sentence as tiles: the punctuation is not part of the answer.
const mkBuildSent = s => mkBuild({ ...s, pinyin: s.pinyin.replace(/[,.?!]/g, ''), thai: s.thai.replace(/[,.?!]/g, '') });
function mkMatch(items) { return { type: 'match', items: pick(items, Math.min(5, items.length)) }; }
function toneSetFor(items) {
  const hz = new Set(items.flatMap(it => [it.hanzi, ...(it.reject || [])]));
  return C.toneSets.find(ts => ts.hanzi.some(x => hz.has(x)));
}
function mkTone(set) {
  set = set || pick(C.toneSets, 1)[0];
  return set ? { type: 'tone', set, answer: Math.floor(rand() * set.hanzi.length) } : null;
}
const toneSpeakable = it => !it.npc && !it.listenOnly && !it.pinyin.includes('…') && !/[A-Z]{2}|[a-z][A-Z]/.test(it.pinyin) &&
  sylls(it.pinyin).length >= 1 && sylls(it.pinyin).length <= 2 && sylls(it.pinyin).some(s => s.tone !== 5);
function mkToneSpeakItem(it) {
  return { type: 'tone_speak', target: { hanzi: it.hanzi, pinyin: it.pinyin, thai: it.thai, meaning: it.meaning, tones: sylls(it.pinyin).map(s => s.tone) } };
}
function mkToneSpeakSet(ts) {
  const i = Math.floor(rand() * ts.hanzi.length);
  return { type: 'tone_speak', target: { hanzi: ts.hanzi[i], pinyin: ts.pinyin[i], thai: ts.thai[i], meaning: ts.meaning[i], tones: sylls(ts.pinyin[i]).map(s => s.tone) } };
}
// Each reply is two steps: first hear what the local said and pick its meaning (nothing written),
// then pick the reply by pinyin alone and say it out loud.
function expandDialog(d) {
  return d.lines.flatMap((ln, i) => {
    if (ln.who !== 'me' || !C.items[ln.answer]) return [];
    const prev = d.lines[i - 1];
    const heard = prev && prev.who === 'npc' && C.items[prev.item] ? [{ type: 'dialog', dialog: d, upto: i, listen: true }] : [];
    return [...heard, { type: 'dialog', dialog: d, upto: i }];
  });
}
const items = ids => ids.map(id => C.items[id]).filter(it => it && !it.npc);

// After a correct answer, say it out loud too (thenSpeak): hearing alone doesn't make you able to say it.
const thenSpeak = (ex, it) => (Speech.level() !== 'off' && canSpeak(it) ? { ...ex, thenSpeak: true } : ex);
function mixedFor(its, n, pool, { speak = Math.max(2, Math.round(n / 5)), tone = true, recall = 0 } = {}) {
  const out = [];
  const list = shuffle(its);
  for (let k = 0; k < n && list.length; k++) {
    const it = list[k % list.length];
    const r = rand();
    out.push(it.listenOnly || (r >= 0.2 && r < 0.65) ? (r < 0.4 ? thenSpeak(mkListen(it, pool), it) : mkListen(it, pool)) : canBuild(it) && r < 0.2 ? mkBuild(it) : mkMeaning(it, pool));
  }
  if (Speech.level() !== 'off') for (const it of pick(its.filter(canSpeak), speak)) out.push({ type: 'speak', item: it, recall: rand() < recall });
  if (tone) { const t = mkTone(toneSetFor(its)); if (t) out.push(t); }
  return out;
}

// Extra exercises on top of each stage's base set (learner asked for longer stages; trial value).
const EXTRA = 5;
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
      if (it.listenOnly) { p2.push(mkListen(it, pool), mkListen(it, pool)); continue; }
      p2.push(mkMeaning(it, pool));
      if (speakOK) p2.push({ type: 'speak', item: it });
      if (canBuild(it)) p2.push(mkBuild(it));
    }
    for (const it of reviews) {
      p2.push(it.listenOnly || rand() < 0.6 ? thenSpeak(mkListen(it, pool), it) : mkMeaning(it, pool));
      if (!news.length && canBuild(it) && rand() < 0.5) p2.push(mkBuild(it));
    }
    if (!news.length && speakOK) for (const it of pick(reviews.filter(canSpeak), 2)) p2.push({ type: 'speak', item: it });
    const ts = toneSetFor(news.concat(reviews));
    if (ts || rand() < 0.5) { const t = mkTone(ts); if (t) p2.push(t); }
    q.push(...shuffle(p2));
    const all = news.concat(reviews);
    // EXTRA: say from memory the words just learned and 3 from earlier days (learner asked for many of these),
    // then mix them with the rest.
    const olderIds = pick(learnedIds().filter(id => !pool.includes(id) && canSpeak(C.items[id])), 3);
    const extraPool = all.concat(items(olderIds)), ex = [];
    for (const it of pick(news.filter(canSpeak), 3)) ex.push(speakOK ? { type: 'speak', item: it, recall: true } : mkMeaning(it, pool));
    if (speakOK) for (const it of items(olderIds).concat(pick(reviews.filter(canSpeak), news.length ? 0 : 3))) ex.push({ type: 'speak', item: it, recall: true });
    for (const it of shuffle(extraPool).slice(0, Math.max(2, EXTRA - ex.length))) {
      const r = rand();
      ex.push(it.listenOnly || r < 0.45 ? thenSpeak(mkListen(it, pool.concat(olderIds)), it) : canBuild(it) && r < 0.75 ? mkBuild(it) : mkMeaning(it, pool.concat(olderIds)));
    }
    q.push(...shuffle(ex));
    if (all.length >= 4) q.push(mkMatch(all));
    const ttsItem = news.find(toneSpeakable);
    if (ttsItem && Speech.toneAvailable()) q.push(mkToneSpeakItem(ttsItem));
    for (const d of L.dialogs || []) q.push(...expandDialog(d));
  } else if (mode === 'checkpoint') {
    const final = !!entry.lesson.final;
    const ids = final ? uniq(C.units.filter(u => !u.bonus).flatMap(u => u.items)) : entry.unit.items;
    const its = items(ids);
    q.push(...shuffle(mixedFor(its, (entry.lesson.size || 12) + EXTRA, ids, { speak: final ? 7 : 6, recall: 0.75 })));
    if (its.length >= 4) q.push(mkMatch(its));
    if (final) {
      const dialogs = C.units.filter(u => !u.bonus).flatMap(u => u.lessons.flatMap(l => l.dialogs || []));
      for (const d of pick(dialogs, 2)) q.push(...expandDialog(d));
    }
  } else if (mode === 'challenge' || mode === 'mix') {
    // Old words, weakest and least-practised first, with a little randomness so each run differs.
    const units = C.units.filter(u => !u.bonus && (mode === 'mix' ? u.lessons.some(l => isDone(l.id)) : u.day <= entry.upto));
    const pool = mode === 'mix' ? learnedIds() : uniq(units.flatMap(u => u.items));
    const score = id => { const r = S.srs[id]; return (r ? r.box - Math.min(r.wrong, 3) : 0) + rand() * 2.5; };
    const ids = pool.map(id => [id, score(id)]).sort((a, b) => a[1] - b[1]).slice(0, 14 + EXTRA).map(([id]) => id);
    const its = items(ids);
    q.push(...shuffle(mixedFor(its, 14 + EXTRA, pool, { speak: 8, recall: 0.8 })));
    if (its.length >= 4) q.push(mkMatch(its));
    const dialogs = units.flatMap(u => u.lessons.flatMap(l => l.dialogs || []));
    for (const d of pick(dialogs, 1)) q.push(...expandDialog(d));
  } else if (mode === 'talk') {
    // Hear a whole sentence made of learned words, pick its meaning, then say it (must) to pass.
    const sets = entry.setId === 'all' ? C.sentSets : C.sentSets.filter(st => st.id === entry.setId);
    const open = sets.flatMap(st => st.sentences.filter(sentOpen));
    const shared = (a, b) => a.needs.filter(id => b.needs.includes(id)).length;
    for (const it of shuffle(open).slice(0, 8)) {
      // Distractors: other sentences of the scene sharing the most words, so you have to hear the whole thing.
      const others = shuffle(C.sentSets.flatMap(st => st.sentences).filter(x => x !== it && x.meaning !== it.meaning))
        .sort((a, b) => (b.set === it.set) - (a.set === it.set) || shared(b, it) - shared(a, it));
      q.push({ type: 'talk', item: it, options: shuffle([it, ...others.slice(0, 3)]), thenSpeak: speakOK, must: true });
    }
  } else if (mode === 'recall') {
    // Thai meaning only → say it in Chinese. Weakest / least-practised learned words first.
    const score = id => { const r = S.srs[id]; return (r ? r.box - Math.min(r.wrong, 3) : 0) + rand() * 2.5; };
    const seen = new Set();
    const its = learnedIds().map(id => C.items[id]).filter(it => canSpeak(it) && !it.npc)
      .map(it => [it, score(it.id)]).sort((a, b) => a[1] - b[1]).map(([it]) => it)
      .filter(it => { const k = meaningKey(it.meaning); if (seen.has(k)) return false; seen.add(k); return true; });
    for (const it of its.slice(0, 12)) q.push({ type: 'speak', item: it, recall: true });
  } else if (mode === 'hard') {
    // Your hardest-to-say words: first with the model to copy, then once more from memory.
    const its = items(hardIds().slice(0, 8));
    for (const it of its) q.push({ type: 'speak', item: it });
    for (const it of shuffle(its)) q.push({ type: 'speak', item: it, recall: true });
  } else if (mode === 'pattern') {
    // One sentence frame: see it, build two examples and copy them, then say combinations never shown before.
    if (entry.patId === 'all') {
      for (const s of pick(C.pat.patterns.flatMap(p => p.sentences.filter(sentOpen)), 10)) q.push({ type: 'speak', item: s, recall: true });
    } else {
      const p = C.pat.patterns.find(x => x.id === entry.patId);
      const open = shuffle(p.sentences.filter(sentOpen)), eg = open.slice(0, 2);
      if (open.length) q.push({ type: 'frame', pattern: p, examples: eg });
      for (const s of eg) { q.push(mkBuildSent(s)); if (speakOK) q.push({ type: 'speak', item: s }); }
      for (const s of open.slice(2, 8)) q.push(speakOK ? { type: 'speak', item: s, recall: true } : mkBuildSent(s));
      if (speakOK) for (const s of eg) q.push({ type: 'speak', item: s, recall: true });
    }
  } else if (mode === 'scene' || mode === 'exam') {
    // A situation, no choices, several right answers. The exam: 10 of them spread over the topics, no hints, two tries.
    const exam = mode === 'exam';
    const byTopic = {};
    for (const sc of shuffle(C.pat.scenes.filter(sentOpen))) (byTopic[sc.icon] = byTopic[sc.icon] || []).push(sc);
    const spread = [];
    for (let k = 0; spread.length < (exam ? 10 : 8); k++) {
      const row = shuffle(Object.values(byTopic)).map(g => g[k]).filter(Boolean);
      if (!row.length) break;
      spread.push(...row);
    }
    for (const sc of spread.slice(0, exam ? 10 : 8)) q.push({ type: 'speak', item: sc.answers[0], alts: sc.answers, scene: sc, recall: true, exam, must: exam });
  } else if (mode === 'replies') {
    // The different things a local answers to one question, by ear; half of them at real-life speed.
    const sets = C.pat.replies.filter(st => replyOpen(st) && (entry.setId === 'all' || st.id === entry.setId));
    for (const [st, ln] of pick(sets.flatMap(st => st.lines.map(ln => [st, ln])), 10))
      q.push({ type: 'talk', item: ln, options: shuffle([ln, ...pick(st.lines.filter(x => x !== ln && x.meaning !== ln.meaning), 3)]), fast: rand() < 0.5 });
  } else if (mode === 'sounds') {
    const sets = C.pat.sounds.filter(st => entry.setId === 'all' || st.id === entry.setId);
    for (let k = 0; k < 12 && sets.length; k++) {
      const st = pick(sets, 1)[0], group = pick(st.groups, 1)[0];
      q.push({ type: 'sound', set: st, group, answer: Math.floor(rand() * group.length) });
    }
  } else if (mode === 'vocab') {
    q.push(...vocabStageQueue(C.vocab.stages.find(st => st.id === entry.id), speakOK));
  } else if (mode === 'vocabreview') {
    q.push(...vocabReviewQueue(speakOK));
  } else if (mode === 'numbers') {
    // Hear a number inside a real sentence, pick it, then say it (must) to pass.
    const sets = entry.setId === 'all' ? C.numSets : C.numSets.filter(st => st.id === entry.setId);
    for (const it of shuffle(sets.flatMap(st => st.groups.flat())).slice(0, 10))
      q.push({ type: 'num', item: it, line: pick(it.lines, 1)[0], options: shuffle(it.group), thenSpeak: speakOK, must: true });
  } else if (mode === 'review') {
    let ids = uniq(dueIds().concat(weakIds())).slice(0, 8);
    if (ids.length < 4) ids = uniq(ids.concat(pick(learnedIds(), 8))).slice(0, 8);
    const its = items(ids);
    q.push(...shuffle(mixedFor(its, 10, ids)));
    if (its.length >= 4) q.push(mkMatch(its));
  } else if (mode === 'skip') {
    const ids = uniq(C.units.filter(u => u.day < entry.unit.day).flatMap(u => u.items));
    const its = items(ids);
    for (const it of pick(its, 10)) q.push(it.listenOnly || rand() < 0.5 ? mkListen(it, ids) : mkMeaning(it, ids));
  } else if (mode === 'listen') {
    // Ear training on words already met in lessons (hearing unknown phrases teaches nothing), random voice each.
    const ids = learnedIds(), list = shuffle(items(ids));
    for (let k = 0; k < 12 && list.length; k++) q.push(mkListen(list[k % list.length], ids));
  } else if (mode === 'tone') {
    const speakable = items(learnedIds()).filter(toneSpeakable);
    for (let k = 0; k < 10; k++) {
      if (k % 2 === 0 || !Speech.toneAvailable()) { const t = mkTone(); if (t) q.push(t); }
      else q.push(speakable.length && rand() < 0.5 ? mkToneSpeakItem(pick(speakable, 1)[0]) : mkToneSpeakSet(pick(C.toneSets, 1)[0]));
    }
  }
  return { mode, entry, queue: q.map((ex, i) => ({ ...ex, uid: i })), i: 0, results: {}, xp: 0, combo: 0, heartsLost: 0, nextUid: q.length };
}

const GRADED = new Set(['listen', 'meaning', 'build', 'tone', 'dialog', 'match', 'num', 'talk', 'sound']);
const HEART_MODES = new Set(['lesson', 'checkpoint', 'challenge', 'skip']);
const PATH_MODES = new Set(['lesson', 'checkpoint', 'challenge']);
