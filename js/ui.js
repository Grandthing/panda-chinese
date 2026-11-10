'use strict';
/* พูดจีนรอดใน 20 วัน — js/ui.js: UI kit · Screens (learn, phrases, review, me, settings…)
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
 */

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
    h('button', { class: 'btn-play slow', 'aria-label': 'ฟังช้า', onclick: () => play(it, true) }, '🐢'), fastBtn(it));
}
// 十四 → [shí สิบ][sì สี่]; 这个多少钱 → [zhège อันนี้][duōshao เท่าไหร่][qián เงิน]. Longest known word first.
// null for a single word (one character, or a glossary word marked "=" like 咖啡 / 便宜), or when the
// pinyin doesn't line up with the characters.
function wordParts(it) {
  const G = C.gloss;
  if (!G || !it.hanzi || !it.pinyin) return null;
  const cs = [...it.hanzi].filter(c => /[一-鿿]/.test(c));
  const whole = cs.join('');
  if (cs.length < 2 || (G.words[whole] || '').startsWith('=')) return null;
  const ss = sylls(it.pinyin).map(s => s.text.replace(/[^\p{L}\p{M}']/gu, '')).filter(Boolean);
  // 儿 after a syllable ending in r (nǎr, zhèr) has no syllable of its own.
  const py = [];
  for (let i = 0, j = 0; i < cs.length; i++) {
    if (cs[i] === '儿' && cs.length - i > ss.length - j && j && /r$/.test(ss[j - 1])) { py.push(''); continue; }
    if (j >= ss.length) return null;
    py.push(ss[j++]);
  }
  if (py.filter(Boolean).length !== ss.length) return null;
  const parts = [];
  for (let i = 0; i < cs.length;) {
    let n = Math.min(4, cs.length - i);
    for (; n > 1; n--) { const w = cs.slice(i, i + n).join(''); if (G.words[w] && w !== whole) break; }
    const w = cs.slice(i, i + n).join('');
    const th = (n > 1 ? G.words[w] : G.chars[w]) || '';
    parts.push({ hz: w, py: py.slice(i, i + n).join(''), th: th.replace(/^=/, '') });
    i += n;
  }
  return parts.length > 1 ? parts : null;
}
function partsRow(it, compact) {
  const ps = wordParts(it);
  if (!ps) return null;
  return h('div', { class: 'word-parts' + (compact ? ' compact' : '') },
    ...ps.map(p => h('span', { class: 'wp' }, h('b', {}, pyEl(p.py)), h('small', {}, p.th || '—'))));
}
function wordCard(it, { big = true } = {}) {
  return h('div', { class: 'word' + (big ? ' big' : '') },
    h('div', { class: 'word-py' }, pyEl(it.pinyin)),
    S.settings.showThai ? h('div', { class: 'word-th' }, it.thai) : null,
    h('div', { class: 'word-mean' }, it.meaning),
    partsRow(it),
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
    h('button', { class: 'btn btn-primary card-play', onclick: () => play(it) }, '🔊 เล่นเสียงให้ฟัง')));
  el.hidden = false;
  try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}

// ---- My places: addresses to show a taxi driver (S.places = [{ th, hz }])
const CHENGDU_PLACES = [
  ['ศูนย์แพนด้า', '成都大熊猫繁育研究基地'], ['ตรอกกว้าง-ตรอกแคบ', '宽窄巷子'], ['ถนนโบราณจิ่นหลี่', '锦里古街'],
  ['ถนนชุนซี', '春熙路'], ['ไท่กู่หลี่', '成都远洋太古里'], ['ศาลเจ้าอู่โหว', '武侯祠'], ['สวนประชาชน', '人民公园'],
  ['สนามบินเทียนฝู่', '成都天府国际机场'], ['สนามบินซวงหลิว', '成都双流国际机场'], ['สถานีรถไฟเฉิงตูตะวันออก', '成都东站'],
];
async function showPlace(p) {
  const el = $('#card');
  const close = () => { el.hidden = true; el.replaceChildren(); try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; };
  const size = p.hz.length > 24 ? 28 : p.hz.length > 12 ? 40 : 56;
  el.replaceChildren(h('div', { class: 'card-inner' },
    h('button', { class: 'icon-btn card-close', 'aria-label': 'ปิด', onclick: close }, '✕'),
    h('div', { class: 'card-th' }, '师傅，请带我去这里 🙏'),
    h('div', { class: 'card-hanzi', lang: 'zh-CN', style: `font-size:${size}px` }, p.hz),
    h('div', { class: 'card-th' }, p.th + ' · ช่วยพาไปที่นี่'),
    h('button', { class: 'btn btn-primary card-play', onclick: () => TTS.speak('师傅，请带我去' + p.hz, 0.85) }, '🔊 อ่านให้คนขับฟัง')));
  el.hidden = false;
  try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function addPlace(th, hz) {
  hz = (hz || '').trim(); th = (th || '').trim() || hz;
  if (!hz) { toast('ใส่ชื่อหรือที่อยู่ภาษาจีนก่อน'); return false; }
  if (S.places.some(p => p.hz === hz)) { toast('มีสถานที่นี้แล้ว'); return false; }
  S.places.push({ th, hz }); save();
  logI('place', 'เพิ่ม ' + th);
  return true;
}
function addPlaceSheet() {
  const th = h('input', { type: 'text', class: 'search', placeholder: 'ชื่อเรียก เช่น โรงแรมของฉัน' });
  const hz = h('textarea', { class: 'search', rows: '3', lang: 'zh-CN', placeholder: 'วางชื่อ/ที่อยู่ภาษาจีน (ก๊อปจากแอปจองโรงแรม หรือแผนที่)' });
  let close;
  const done = () => { close(); renderPhrases(); };
  close = openSheet(h('div', { class: 'info-sheet' },
    h('h3', {}, '📍 เพิ่มสถานที่'),
    th, hz,
    h('button', { class: 'btn btn-primary', onclick: () => { if (addPlace(th.value, hz.value)) done(); } }, 'บันทึก'),
    h('p', { class: 'muted small' }, 'หรือแตะเพิ่มที่เที่ยวยอดฮิตในเฉิงตู:'),
    h('div', { class: 'chips' }, ...CHENGDU_PLACES.filter(([, z]) => !S.places.some(p => p.hz === z))
      .map(([t, z]) => h('button', { class: 'chip-btn', onclick: () => { if (addPlace(t, z)) done(); } }, '+ ' + t)))));
}
function placesBox() {
  return h('section', { class: 'card-box places' },
    h('h3', {}, '📍 สถานที่ของฉัน — โชว์คนขับแท็กซี่'),
    ...S.places.map((p, i) => h('div', { class: 'phrase' },
      h('button', { class: 'phrase-main', onclick: () => showPlace(p) },
        h('div', { class: 'phrase-mean' }, p.th), h('div', { class: 'phrase-hz', lang: 'zh-CN' }, p.hz)),
      h('button', { class: 'btn-play', 'aria-label': 'ลบ ' + p.th, onclick: async () => {
        if (await confirmBox('ลบสถานที่?', p.th, 'ลบ', 'ยกเลิก', true)) { S.places.splice(i, 1); save(); renderPhrases(); }
      } }, '✕'))),
    S.places.length ? null : h('p', { class: 'muted small' }, 'ใส่ที่อยู่โรงแรมเป็นภาษาจีนไว้ แล้วแตะโชว์คนขับได้ทันที ใช้ได้แม้ไม่มีเน็ต'),
    h('button', { class: 'btn btn-ghost', onclick: addPlaceSheet }, '+ เพิ่มสถานที่'));
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
  if (Object.keys(S.lessons).length < 9) // first days only; afterwards it lives on the Me tab
    wrap.append(h('button', { class: 'warn soft', onclick: () => { location.hash = '#/guide'; } }, '📖 วิธีเรียนให้ได้ผล — อ่านก่อนเริ่ม (1 นาที)'));
  const bonus = C.order.filter(isBonus);
  if (bonus.length && !bonus.every(e => isDone(e.id)))
    wrap.append(h('button', { class: 'warn soft', onclick: () => document.getElementById('bonus-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
      '🐼 บทพิเศษเที่ยวเฉิงตู เปิดให้เรียนได้เลย — แตะเพื่อไปที่บท'));
  let lastStage = null;
  let currentEl = null;
  for (const u of C.units) {
    if (u.stage !== lastStage) { wrap.append(h('div', { class: 'stage', id: u.bonus ? 'bonus-stage' : null }, u.stage)); lastStage = u.stage; }
    const entries = C.order.filter(e => e.unit === u);
    const unitDone = entries.every(e => isDone(e.id));
    const path = h('div', { class: 'path' });
    entries.forEach((e, k) => {
      const st = nodeState(e);
      const off = [0, 46, 0, -46][k % 4];
      const rec = S.lessons[e.id];
      const ic = e.kind === 'checkpoint' ? '👑' : e.kind === 'challenge' ? '🏆' : st === 'locked' ? '🔒' : st === 'done' ? '✓' : '▶';
      const node = h('div', { class: 'node-wrap', style: `transform:translateX(${off}px)` },
        st === 'current' ? h('div', { class: 'node-tip' }, 'เริ่มตรงนี้') :
        e.kind === 'challenge' && st === 'open' ? h('div', { class: 'node-tip new' }, '🏆 ท้าทายคำเก่า') : hasUnseen(e) ? h('div', { class: 'node-tip new' }, '🆕 มีคำเพิ่ม') : null,
        h('button', { class: `node ${st} ${e.kind}`, 'aria-label': `${e.title} (${{ done: 'จบแล้ว', current: 'บทถัดไป', open: 'เปิดแล้ว', locked: 'ล็อค' }[st]})`, onclick: () => openNode(e) }, ic),
        rec && !rec.skipped ? h('div', { class: 'stars' }, '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars)) : null);
      if (st === 'current' && !isBonus(e)) currentEl = node;
      path.append(node);
    });
    wrap.append(h('section', { class: 'unit' + (unitDone ? ' done' : '') },
      h('div', { class: 'unit-head' }, h('div', { class: 'unit-day' }, u.bonus ? `บทพิเศษ ${u.day - 20}` : `วันที่ ${u.day}`), h('div', { class: 'unit-title' }, u.title), h('div', { class: 'unit-goal' }, u.goal)),
      path));
  }
  if (courseDone()) wrap.append(h('section', { class: 'unit finish' }, pandaSay('party', 'จบหลักสูตร 20 วันแล้ว! ทบทวนและฝึกวรรณยุกต์ต่อได้ในแท็บทบทวน'),
    h('button', { class: 'btn btn-primary', onclick: certificateSheet }, '🏅 ดูใบประกาศ')));
  else if (!C.units.some(u => u.bonus)) wrap.append(h('p', { class: 'muted center' }, 'บทเรียนวันที่ 21+ จะเพิ่มในอนาคต'));
  screen().replaceChildren(wrap);
  if (currentEl && !renderLearn.scrolled) { renderLearn.scrolled = true; setTimeout(() => currentEl.scrollIntoView({ block: 'center' }), 50); }
}

function openNode(e) {
  const st = nodeState(e);
  if (st === 'locked') {
    const first = C.order.find(x => x.unit === e.unit);
    if (first === e && e.unit.day > 1 && !isBonus(e)) {
      openSheet(h('div', { class: 'info-sheet' },
        h('h3', {}, `ข้ามไปวันที่ ${e.unit.day}?`),
        h('p', {}, `ทำแบบทดสอบ 10 ข้อจากวันที่ 1–${e.unit.day - 1} ถูก 80% ขึ้นไปจะปลดล็อคถึงวันนี้`),
        h('button', { class: 'btn btn-primary', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession('skip', e); } }, '⚡ เริ่มทดสอบข้าม')));
    } else toast('ทำบทก่อนหน้าให้จบก่อนนะ 🐼');
    return;
  }
  const rec = S.lessons[e.id];
  const chal = e.kind === 'challenge';
  const its = items(e.kind === 'lesson' ? (e.lesson.newItems || []) : chal ? [] : e.unit.items);
  openSheet(h('div', { class: 'info-sheet' },
    h('div', { class: 'muted' }, `${isBonus(e) ? 'บทพิเศษ ' + (e.unit.day - 20) : 'วันที่ ' + e.unit.day} · ${e.unit.title}`),
    h('h3', {}, e.title),
    rec ? h('div', { class: 'stars big' }, '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars)) : null,
    chal ? h('p', {}, `สุ่มคำจากวันที่ 1–${e.upto} เน้นคำที่เคยผิดและคำที่ไม่ได้เจอนาน ทั้งฟัง แปล เรียงคำ พูด และบทสนทนา · เล่นซ้ำได้ทุกเมื่อ ได้คำชุดใหม่ทุกรอบ`) :
    its.length ? h('div', { class: 'chips' }, ...its.slice(0, 8).map(it => h('span', { class: 'chip' }, it.meaning))) : h('p', {}, 'สถานการณ์จำลอง ใช้ทุกอย่างที่เรียนมา'),
    h('button', { class: 'btn btn-primary', onclick: () => { document.querySelector('.sheet-backdrop')?.click(); startSession(e.kind === 'lesson' ? 'lesson' : e.kind, e); } }, rec ? 'เล่นอีกครั้ง' : chal ? '🏆 เริ่มท้าทาย' : 'เริ่มเรียน')));
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
    placesBox(),
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

const sentOpen = x => x.needs.every(id => S.srs[id]);
function talkCard() {
  const all = C.sentSets.flatMap(st => st.sentences), open = all.filter(sentOpen);
  // The day whose lessons unlock the next sentence, to say what's coming.
  const dayOf = id => (C.itemUnit[id] ? C.itemUnit[id].day : 99);
  const next = all.filter(x => !sentOpen(x)).map(x => Math.max(...x.needs.filter(id => !S.srs[id]).map(dayOf))).sort((a, b) => a - b)[0];
  return h('section', { class: 'card-box' },
    h('h3', {}, '🗣️ ฝึกพูดประโยคยาว'),
    h('p', { class: 'muted' }, 'ฟังประโยคตอนซื้อของ / สั่งอาหาร / ซื้อขนม → เลือกความหมาย → พูดทั้งประโยคให้ถูกถึงจะผ่าน · ใช้เฉพาะคำที่เรียนแล้ว · ไม่เสียหัวใจ'),
    h('div', { class: 'num-sets' }, ...C.sentSets.map(st => {
      const n = st.sentences.filter(sentOpen).length;
      return h('button', { class: 'chip-btn', disabled: !n, onclick: () => startSession('talk', { id: 'talk-' + st.id, setId: st.id }) }, `${st.icon} ${st.title} (${n}/${st.sentences.length})`);
    }), h('button', { class: 'chip-btn on', disabled: !open.length, onclick: () => startSession('talk', { id: 'talk-all', setId: 'all' }) }, '🎲 รวมทุกแบบ')),
    h('p', { class: 'muted small' }, `ปลดล็อคแล้ว ${open.length}/${all.length} ประโยค` +
      (next && next < 99 ? ` · เรียน${next > 20 ? 'บทพิเศษ ' + (next - 20) : 'ถึงวันที่ ' + next} จะได้ประโยคเพิ่ม` : '')));
}

function hardCard() {
  seedSpeakMiss();
  const hard = items(hardIds().slice(0, 8));
  const off = Speech.level() === 'off';
  return h('section', { class: 'card-box' },
    h('h3', {}, `🎯 คำที่พูดยาก: ${hard.length} คำ`),
    h('p', { class: 'muted' }, hard.length
      ? 'คำที่ระบบฟังไม่ออกบ่อยเวลาคุณพูด · พูดตามต้นแบบก่อน แล้วพูดจากความจำอีกรอบ · ผ่านบ่อยขึ้นคำจะหลุดออกจากรายการเอง · ไม่เสียหัวใจ'
      : 'ยังไม่มีคำที่พูดไม่ผ่านบ่อย 👍 คำที่พูดพลาดหลายครั้งจะมาอยู่ตรงนี้'),
    hard.length ? h('div', { class: 'hard-list' }, ...hard.map(it => h('span', { class: 'chip-btn' }, pyEl(it.pinyin), ' ', h('small', { class: 'muted' }, it.meaning)))) : null,
    h('button', { class: 'btn btn-primary', disabled: !hard.length || off, onclick: () => startSession('hard') }, off ? 'ต้องเปิดไมค์ก่อน' : '🎯 ฝึกคำที่พูดยาก'));
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
      h('h3', {}, '🏆 ท้าทายตัวเอง: คำเก่าทั้งหมด'),
      h('p', { class: 'muted' }, 'สุ่ม 14 คำจากทุกวันที่เรียนมา เน้นคำที่เคยผิด/ไม่ได้เจอนาน · ฟัง แปล เรียง พูด · ไม่เสียหัวใจ · ได้ชุดใหม่ทุกรอบ'),
      h('button', { class: 'btn btn-primary', disabled: learned.length < 6, onclick: () => startSession('mix') }, learned.length < 6 ? 'เรียนให้ครบ 2 บทก่อน' : '🏆 เริ่มท้าทาย')),
    sceneCard(),
    patternCard(),
    repliesCard(),
    soundsCard(),
    hardCard(),
    h('section', { class: 'card-box' },
      h('h3', {}, '🧠 พูดจากความจำ'),
      h('p', { class: 'muted' }, 'เห็นแค่ความหมายภาษาไทย → นึกแล้วพูดเป็นภาษาจีนเอง ไม่มี pinyin ให้ดู · ติดได้กด 💡 ใบ้ · 12 คำ เน้นคำที่ลืมบ่อย · ไม่เสียหัวใจ'),
      h('button', { class: 'btn btn-primary', disabled: learned.length < 4 || Speech.level() === 'off', onclick: () => startSession('recall') },
        learned.length < 4 ? 'เรียนบทแรกก่อน' : '🧠 เริ่มพูดจากความจำ')),
    C.sentSets.length ? talkCard() : null,
    C.numSets.length ? h('section', { class: 'card-box' },
      h('h3', {}, '🔢 ฟังตัวเลขในสถานการณ์จริง'),
      h('p', { class: 'muted' }, 'ฟังคนจีนพูดประโยคที่มีตัวเลข → เลือกตัวเลขที่ได้ยิน → พูดตัวเลขนั้นออกมาให้ผ่าน · 10 ข้อ · ไม่เสียหัวใจ'),
      h('div', { class: 'num-sets' }, ...C.numSets.map(st => h('button', { class: 'chip-btn', onclick: () => startSession('numbers', { id: 'num-' + st.id, setId: st.id }) }, `${st.icon} ${st.title}`)),
        h('button', { class: 'chip-btn on', onclick: () => startSession('numbers', { id: 'num-all', setId: 'all' }) }, '🎲 รวมทุกแบบ'))) : null,
    h('section', { class: 'card-box' },
      h('h3', {}, '👂 ฝึกฟังคนจีนพูด'),
      h('p', { class: 'muted' }, 'ฟัง 12 ข้อจากคำที่เรียนไปแล้ว สุ่มเสียงคนพูดทุกข้อ · ไม่เสียหัวใจ · จบได้ +1 ❤️'),
      h('button', { class: 'btn btn-jade', disabled: learned.length < 4, onclick: () => startSession('listen') }, learned.length < 4 ? 'เรียนบทแรกก่อน' : '🎧 เริ่มฝึกฟัง')),
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
    speakingCard(),
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

const randomRow = toggle => [
  toggle('randomVoice', 'สุ่มเสียงแต่ละข้อ'),
  h('button', { class: 'btn btn-ghost', onclick: async () => {
    const keep = TTS.persona;
    for (let k = 0; k < 3; k++) { TTS.shuffle(); await play('你好'); if (!S.settings.randomVoice) break; }
    TTS.persona = keep;
  } }, '🎲 ฟังตัวอย่างเสียงสุ่ม')];

function recCard(set, toggle) {
  if (!Rec.index) return null;
  const vs = Rec.voices();
  const cur = vs.includes(S.settings.recVoice) ? S.settings.recVoice : vs[0];
  const list = h('div', { class: 'voice-list' }, ...Rec.index.voices.map(v => {
    const b = h('button', { class: 'voice' + (v.id === cur ? ' on' : ''), onclick: () => {
      set('recVoice', v.id);
      list.querySelectorAll('.voice').forEach(x => x.classList.toggle('on', x === b));
      Rec.play(Rec.url('你好', v.id)).catch(e => toast('เล่นเสียงไม่ได้: ' + errText(e)));
    } }, h('span', { class: 'v-name' }, v.label), h('small', {}, 'เสียงคนจีนคุณภาพสูง'), h('span', { class: 'v-ic' }, '🔊'));
    return b;
  }));
  const info = h('p', { class: 'muted small' });
  const total = Rec.allUrls().length;
  audioCached().then(n => { info.textContent = n >= total ? `✅ เก็บในเครื่องครบ ${total} ไฟล์ ใช้ได้แม้ไม่มีเน็ต` : `เก็บในเครื่องแล้ว ${n}/${total} ไฟล์ (คำที่เคยฟังจะเก็บไว้เอง)`; });
  const dl = h('button', { class: 'btn btn-jade', onclick: () => downloadAudio(dl, info) }, '📥 โหลดเสียงทั้งหมดไว้ใช้ออฟไลน์ (~50 MB)');
  return h('section', { class: 'card-box' }, h('h3', {}, '🎧 เสียงอัด (แนะนำ)'),
    toggle('recordedAudio', 'ใช้เสียงอัดแทนเสียงเครื่อง'),
    h('p', { class: 'muted small' }, 'เสียงหลัก (ใช้เมื่อปิดการสุ่ม):'), list,
    randomRow(toggle),
    dl, info,
    h('p', { class: 'muted small' }, 'ควรโหลดผ่าน Wi-Fi ก่อนไปจีน'));
}

async function audioCached() {
  try {
    const c = await caches.open(AUDIO_CACHE);
    return (await c.keys()).filter(r => r.url.endsWith('.mp3')).length;
  } catch { return 0; }
}

async function downloadAudio(btn, info) {
  if (!('caches' in window)) { toast('เครื่องนี้เก็บไฟล์ไว้ไม่ได้'); return; }
  btn.disabled = true;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
  const c = await caches.open(AUDIO_CACHE);
  const have = new Set((await c.keys()).map(r => new URL(r.url).pathname));
  const all = Rec.allUrls(), total = all.length;
  const todo = all.filter(u => !have.has(new URL(u, location.href).pathname));
  let done = total - todo.length, fail = 0;
  const worker = async () => {
    while (todo.length) {
      const u = todo.shift();
      try { await c.add(u); } catch { fail++; }
      done++;
      info.textContent = `กำลังโหลด… ${done}/${total}`;
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  logI('audio', `โหลดออฟไลน์ ${done - fail}/${total} fail ${fail}`);
  info.textContent = fail ? `โหลดไม่สำเร็จ ${fail} ไฟล์ — กดอีกครั้งเพื่อลองใหม่` : `✅ เก็บในเครื่องครบ ${total} ไฟล์ ใช้ได้แม้ไม่มีเน็ต`;
  btn.disabled = false;
}

function renderSettings() {
  const s = S.settings;
  const set = (k, v) => { s[k] = v; save(); };
  const toggle = (k, label) => h('label', { class: 'row' }, h('span', {}, label),
    h('input', { type: 'checkbox', class: 'switch', checked: s[k], onchange: e => { set(k, e.target.checked); if (k === 'unlimitedHearts') renderSettings(); } }));
  const QLABEL = ['มาตรฐาน', '⭐ ปรับปรุง', '💎 พรีเมียม'];
  const voiceNow = h('p', { class: 'muted' });
  const showNow = () => voiceNow.textContent = s.voiceURI === 'system' ? 'ใช้: เสียงจีนที่เลือกไว้ใน iPhone'
    : TTS.voices.length ? `แอปเห็นเสียงจีน ${TTS.voices.length} เสียง · ใช้: ${TTS.voice ? TTS.voice.name : '-'}` : '⚠️ แอปไม่เห็นเสียงจีน — ลองเลือก "เสียงที่เลือกไว้ใน iPhone"';
  showNow();
  const rows = [{ uri: null, name: 'อัตโนมัติ', sub: 'เลือกจากเสียงที่แอปเห็น' },
    { uri: 'system', name: '📱 เสียงที่เลือกไว้ใน iPhone', sub: 'ใช้เสียงที่โหลดเพิ่ม แม้ไม่ขึ้นในรายการนี้' },
    ...TTS.voices.map(v => ({ uri: v.voiceURI, name: v.name.replace(/\s*[(（].*[)）]\s*$/, ''), sub: QLABEL[TTS.quality(v)] + (v.localService ? '' : ' · ออนไลน์') }))];
  const voiceList = h('div', { class: 'voice-list' }, ...rows.map(r => {
    const b = h('button', { class: 'voice' + ((s.voiceURI || null) === r.uri ? ' on' : ''), onclick: () => {
      set('voiceURI', r.uri); TTS.pick(); showNow();
      logI('tts', 'เลือกเสียง ' + (r.uri || 'auto'));
      voiceList.querySelectorAll('.voice').forEach(x => x.classList.toggle('on', x === b));
      TTS.speak('你好，欢迎来中国');
    } }, h('span', { class: 'v-name' }, r.name), h('small', {}, r.sub), h('span', { class: 'v-ic' }, '🔊'));
    return b;
  }));
  const noBetter = TTS.voices.length && !TTS.voices.some(v => TTS.quality(v) > 0);
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
    recCard(set, toggle),
    h('section', { class: 'card-box' }, h('h3', {}, Rec.index ? 'เสียงสำรองของเครื่อง' : 'เสียงจีน (TTS)'),
      Rec.usable() ? h('p', { class: 'muted small' }, 'ใช้เมื่อคำนั้นไม่มีเสียงอัด หรือปิดเสียงอัดไว้') : null,
      voiceNow, voiceList,
      h('label', { class: 'row' }, h('span', {}, 'ความเร็ว'), rate),
      Rec.index ? null : randomRow(toggle),
      h('details', { class: 'howto', open: !TTS.voices.length || noBetter },
        h('summary', {}, '📥 โหลดเสียงจีนเพิ่ม (ฟรี)'),
        h('ol', {},
          h('li', {}, 'เปิดแอป "ตั้งค่า" ของ iPhone → ', h('b', {}, 'การช่วยการเข้าถึง → เนื้อหาที่พูด → เสียง')),
          h('li', {}, 'เลือก ', h('b', {}, 'จีน (จีนแผ่นดินใหญ่)'), ' — ไม่ใช่ไต้หวันหรือฮ่องกง'),
          h('li', {}, 'แตะ ☁️ โหลดเสียงแบบ ', h('b', {}, '(Enhanced)'), ' หรือ ', h('b', {}, '(Premium)'), ' เช่น Han, Binbin, Lili — ไฟล์ใหญ่ ควรใช้ Wi-Fi'),
          h('li', {}, h('b', {}, 'แตะที่ชื่อเสียงนั้นอีกครั้งให้มีเครื่องหมาย ✓'), ' (ตั้งเป็นเสียงจีนหลักของเครื่อง) — โหลดอย่างเดียวยังไม่พอ'),
          h('li', {}, 'ปัดปิดแอปแพนด้าแล้วเปิดใหม่ → กลับมาหน้านี้ แตะ ', h('b', {}, '"📱 เสียงที่เลือกไว้ใน iPhone"'), ' แล้วฟังว่าเสียงเปลี่ยนไหม')),
        h('p', { class: 'muted small' }, 'Safari มักไม่ส่งรายชื่อเสียงที่โหลดเพิ่มมาให้เว็บ (เพื่อความเป็นส่วนตัว) รายการด้านบนจึงอาจเห็นแค่เสียงเดียว · เสียงที่โหลดแล้วใช้ได้แม้ไม่มีเน็ต · เสียง Siri ใช้ในเว็บแอปไม่ได้'),
        h('button', { class: 'btn btn-ghost', onclick: () => { TTS.load(); renderSettings(); toast(`พบเสียงจีน ${TTS.voices.length} เสียง`); } }, '🔄 ค้นหาเสียงใหม่'))),
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
      h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/guide'; } }, '📖 วิธีเรียนให้ได้ผล'),
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

function renderGuide() {
  const sec = (title, ...kids) => h('section', { class: 'card-box guide' }, h('h3', {}, title), ...kids);
  const ol = (...li) => h('ol', {}, ...li.map(x => h('li', {}, x)));
  const ul = (...li) => h('ul', {}, ...li.map(x => h('li', {}, x)));
  screen().replaceChildren(h('div', { class: 'help' },
    h('div', { class: 'back-row' }, h('button', { class: 'icon-btn', 'aria-label': 'กลับ', onclick: () => history.back() }, '←'), h('h2', { class: 'page-title' }, 'วิธีเรียน')),
    pandaSay('hi', 'วันละ 15–20 นาที = 1 วันบนแผนที่ (3 บท + ด่าน 👑) ครบ 20 วันพูดเอาตัวรอดได้'),
    sec('1️⃣ ในแต่ละบท ทำแบบนี้',
      ol(
        [h('b', {}, 'คำใหม่ ✨: '), 'ฟัง 2–3 รอบ กด 🐢 ฟังช้า ดูคำอ่านไทย แล้ว', h('b', {}, 'พูดตามดัง ๆ'), ' ทุกครั้ง (ถึงจะไม่ใช่ข้อพูดก็ตาม)'],
        [h('b', {}, 'ป้าย 👂: '), 'ประโยคที่คนจีนจะพูดกับคุณ เช่น "เอาถุงไหม" "เลี้ยวซ้าย" — แค่ฟังให้ออก ไม่ต้องพูด'],
        [h('b', {}, 'ข้อฟัง 🔊: '), 'ฟังให้จบแล้วนึกความหมายในใจก่อน ค่อยดูตัวเลือก ฟังซ้ำได้ไม่จำกัด เสียงคนพูดเปลี่ยนทุกข้อเพื่อให้หูชินหลายเสียง'],
        [h('b', {}, 'ข้อพูด 🎙️: '), 'พูดชัด ๆ ถ้าผิด แอปจะบอกว่าพยางค์ไหนผิดอะไร แตะพยางค์นั้นฟัง แล้วพูดใหม่'],
        [h('b', {}, 'บทสนทนา 💬: '), 'คิดว่าอยู่ในร้านจริง พูดคำตอบออกเสียงก่อนกดเลือก'])),
    sec('2️⃣ ทุกวัน 5 นาที (แท็บทบทวน)',
      ul(
        [h('b', {}, '🔁 ทบทวน'), ' — แอปเลือกคำที่ใกล้ลืมให้เอง'],
        [h('b', {}, '🎧 ฝึกฟัง'), ' — 12 ข้อจากคำที่เรียนแล้ว เปิดฟังตอนเดินทาง/ก่อนนอนได้'],
        [h('b', {}, '🎵 วรรณยุกต์'), ' — รอบสั้น ๆ วันละครั้ง เสียงผิดคนจีนจะฟังเป็นคำอื่น']),
      h('p', { class: 'muted small' }, 'ทบทวนและฝึกฟังไม่เสียหัวใจ จบรอบได้หัวใจคืน +1')),
    sec('3️⃣ แผนถึงวันเดินทาง',
      ul(
        'วันที่ 1–20 ตามแผนที่ วันละ 1 วัน (เรียนเร็วกว่านี้ได้ถ้ามีเวลา)',
        'บทพิเศษเฉิงตู 🐼 เรียนได้ตลอด แนะนำช่วงสัปดาห์สุดท้ายก่อนบิน',
        'บทไหนขึ้น 🆕 มีคำเพิ่ม = มีคำใหม่ถูกเพิ่มหลังคุณเรียนไปแล้ว แตะเล่นซ้ำอีกรอบ',
        'ถ้าเวลาไม่พอ เน้นแท็บการ์ดพูด → ⭐ เอาตัวรอด')),
    sec('4️⃣ ก่อนบิน (ทำตอนมี Wi-Fi)',
      ol(
        'ตั้งค่า → 📥 โหลดเสียงทั้งหมดไว้ใช้ออฟไลน์',
        'การ์ดพูด → 📍 ใส่ที่อยู่โรงแรมเป็นภาษาจีน',
        'ฉัน → 💾 สำรองความคืบหน้า')),
    sec('5️⃣ ตอนอยู่จีน',
      ul(
        [h('b', {}, 'พูดไม่ออก: '), 'การ์ดพูด → ค้นคำ → แตะเพื่อโชว์ตัวจีนใหญ่ หรือกด 🔊 ให้เขาฟัง'],
        [h('b', {}, 'ฟังไม่ทัน: '), 'พูด qǐng zài shuō yí biàn (พูดอีกครั้ง) หรือ màn yìdiǎn (ช้าหน่อย)'],
        [h('b', {}, 'ขึ้นแท็กซี่: '), 'การ์ดพูด → 📍 แตะชื่อที่จะไป ยื่นให้คนขับดู'])),
    h('button', { class: 'btn btn-primary', onclick: () => { location.hash = '#/learn'; } }, 'ไปเรียนกันเลย 🐼')));
}

function renderHelp() {
  const sec = (title, ...ps) => h('section', { class: 'card-box' }, h('h3', {}, title), ...ps.map(p => h('p', {}, p)));
  screen().replaceChildren(h('div', { class: 'help' },
    h('div', { class: 'back-row' }, h('button', { class: 'icon-btn', 'aria-label': 'กลับ', onclick: () => history.back() }, '←'), h('h2', { class: 'page-title' }, 'ช่วยเหลือ')),
    sec('📲 ติดตั้งบน iPhone', 'เปิดเว็บนี้ใน Safari → แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) → "เพิ่มลงหน้าจอโฮม" → เปิดแอปจากไอคอนแพนด้าทุกครั้ง',
      'สำคัญ: ความคืบหน้าในแท็บ Safari กับในแอปที่ติดตั้งแยกกัน และข้อมูลในแท็บ Safari อาจถูกลบถ้าไม่ได้เปิด 7 วัน'),
    sec('🔊 เสียงจีนชัดขึ้น (ฟรี)', 'iPhone: ตั้งค่า → การช่วยการเข้าถึง → เนื้อหาที่พูด → เสียง → จีน (จีนแผ่นดินใหญ่) → ดาวน์โหลดเสียงแบบ "ปรับปรุง" หรือ "พรีเมียม" → ปิดแอปแล้วเปิดใหม่ → ตั้งค่าของแอป → แตะเลือกเสียงที่มี ⭐/💎',
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
