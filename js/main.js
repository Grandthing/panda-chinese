'use strict';
/* พูดจีนรอดใน 20 วัน — js/main.js: Router · Boot
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
 */

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
  const views = { learn: renderLearn, phrases: renderPhrases, review: renderReview, me: renderMe, settings: renderSettings, help: renderHelp, guide: renderGuide };
  const view = views[r] || renderLearn;
  logI('nav', r);
  renderNav(['settings', 'help', 'guide'].includes(r) ? 'me' : (views[r] ? r : 'learn'));
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
  // a click (not pointerdown) counts as a user gesture for media on iOS; retried until it works
  document.addEventListener('click', () => Rec.unlock(), true);
  Rec.load();
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
