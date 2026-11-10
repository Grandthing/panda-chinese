'use strict';
/* พูดจีนรอดใน 20 วัน — js/audio.js: Sound effects · TTS · Recorded audio
 * Plain scripts sharing one global scope, loaded in the order listed in index.html (no build step).
 */

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
    this.load();
    const load = () => this.load();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', load) : (speechSynthesis.onvoiceschanged = load);
  },
  load() {
    if (!this.supported) return;
    const n = this.voices.length;
    // Best first: premium > enhanced > standard, on-device before network.
    this.voices = speechSynthesis.getVoices().filter(v => /^(zh[-_](cn|hans)|cmn)/i.test(v.lang))
      .sort((a, b) => this.quality(b) - this.quality(a) || b.localService - a.localService);
    this.pick();
    if (this.voices.length !== n) logI('tts', `เสียงทั้งหมด ${speechSynthesis.getVoices().length} · เสียงจีน ${this.voices.length}:${this.voices.map(v => v.name + (v.localService ? '' : '(net)')).join(', ')} → ใช้ ${this.voice ? this.voice.name : '-'}`);
  },
  // 2 = premium, 1 = enhanced, 0 = standard (iOS puts the tier in the name and in voiceURI)
  quality(v) {
    const s = v.name + ' ' + v.voiceURI;
    return /premium|พรีเมียม|高级|優質/i.test(s) ? 2 : /enhanced|ปรับปรุง|增强|強化/i.test(s) ? 1 : 0;
  },
  pick() {
    // 'system': set no voice, only lang — iOS then speaks with the Mandarin voice chosen in
    // Settings → Spoken Content, which can be a downloaded Enhanced/Premium voice Safari doesn't list.
    if (S.settings.voiceURI === 'system') { this.voice = null; return; }
    const pref = S.settings.voiceURI && this.voices.find(v => v.voiceURI === S.settings.voiceURI);
    this.voice = pref || this.voices.find(v => v.localService) || this.voices[0] || null;
  },
  // A different "speaker" per exercise: another installed voice when Safari lists more than one,
  // and always a different pitch, so even a single voice (iOS often exposes only Tingting) varies.
  persona: null,
  shuffle() {
    if (!S.settings.randomVoice) { this.persona = null; return; }
    const pool = S.settings.voiceURI === 'system' ? [] : this.voices.filter(v => v.localService);
    const voice = pool.length > 1 ? pool[Math.floor(Math.random() * pool.length)] : this.voice;
    const pitches = [1, 1.15, 0.85, 1.3, 0.75].filter(p => !this.persona || p !== this.persona.pitch);
    const recs = Rec.voices().filter(v => !this.persona || v !== this.persona.rec);
    this.persona = { voice, pitch: pitches[Math.floor(Math.random() * pitches.length)], rec: recs[Math.floor(Math.random() * recs.length)] };
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
      Rec.stop();
      // Safari may drop an utterance queued right after an unnecessary cancel()
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      const p = this.persona;
      const voice = p ? p.voice : this.voice;
      if (voice) u.voice = voice;
      if (p) u.pitch = p.pitch;
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
// ============================================================ Recorded audio (audio/index.json, made by tools/make_audio.py)
// Files are fetched (through the SW's persistent 'panda-audio' cache) and played from blob URLs, because
// Safari won't play media a service worker serves without Range support.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const AUDIO_CACHE = 'panda-audio';
const Rec = {
  index: null, few: new Set(), el: null, unlocked: false, blobs: new Map(), cur: null,
  async load() {
    try { const r = await fetch('audio/index.json'); if (r.ok) this.index = await r.json(); } catch {}
    // index.few: texts recorded in only some of the voices (the 500-word mode), to keep the download small.
    this.few = new Set(this.index && this.index.few ? this.index.few.ids : []);
    logI('audio', this.index ? `เสียงอัด ${Object.keys(this.index.texts).length} คำ × ${this.index.voices.length} เสียง` : 'ไม่มีเสียงอัด');
  },
  voices() { return this.index ? this.index.voices.map(v => v.id) : []; },
  usable() { return !!(this.index && S.settings.recordedAudio); },
  url(text, voice) {
    const id = this.index && this.index.texts[text];
    if (!id) return null;
    if (this.few.has(id) && !this.index.few.voices.includes(voice)) { const fv = this.index.few.voices; voice = fv[parseInt(id.slice(0, 4), 16) % fv.length]; }
    return `audio/${voice}/${id}.mp3`;
  },
  // Everything to keep offline. The 500-word mode's sound joins once that mode has been started.
  allUrls() {
    const vocab = Object.keys(S.vocab.done).length > 0, fv = this.index.few ? this.index.few.voices : [];
    return this.voices().flatMap(v => Object.values(this.index.texts).filter(id => !this.few.has(id) || (vocab && fv.includes(v))).map(id => `audio/${v}/${id}.mp3`));
  },
  voice() {
    const vs = this.voices();
    if (TTS.persona && TTS.persona.rec) return TTS.persona.rec;
    return vs.includes(S.settings.recVoice) ? S.settings.recVoice : vs[0];
  },
  // iOS lets a media element play without a tap only after it has played once from a tap.
  unlock() {
    if (this.unlocked) return;
    const el = this.el || (this.el = new Audio());
    el.src = SILENT_WAV;
    el.play().then(() => { this.unlocked = true; }).catch(() => {});
  },
  async blobUrl(url) {
    if (!this.blobs.has(url)) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      this.blobs.set(url, URL.createObjectURL(await r.blob()));
    }
    return this.blobs.get(url);
  },
  stop() { if (this.cur) this.cur(); if (this.el) this.el.pause(); },
  async play(url, slow) {
    this.stop();
    let finish;
    const ended = new Promise(res => { finish = res; });
    this.cur = finish;
    const src = await this.blobUrl(url);
    if (this.cur !== finish) return; // a newer play() started meanwhile
    const el = this.el || (this.el = new Audio());
    el.src = src;
    el.preservesPitch = el.webkitPreservesPitch = true;
    el.defaultPlaybackRate = el.playbackRate = slow === 'fast' ? FAST_RATE : slow ? 0.7 : 1;
    el.onended = () => finish();
    el.onerror = () => finish();
    setTimeout(finish, 10000);
    await el.play();
    return ended;
  },
};
function stopAudio() {
  Rec.stop();
  if (TTS.supported && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
}
// slow: true = 🐢, 'fast' = ⚡ (real people in a shop talk about this fast, and run the words together).
const FAST_RATE = 1.4;
function play(it, slow = false) {
  const text = speakText(it);
  const url = Rec.usable() && Rec.url(text, Rec.voice());
  const ttsRate = slow === 'fast' ? Math.min(2, (S.settings.ttsRate || 0.9) * FAST_RATE) : slow ? 0.6 : undefined;
  if (!url) return TTS.speak(text, ttsRate);
  if (TTS.supported && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  return Rec.play(url, slow).catch(e => {
    if (e && e.name === 'AbortError') return; // a newer sound took over; don't speak this one with the device voice too
    logW('audio', `เล่น ${url} ไม่ได้: ${errText(e)} → ใช้เสียงเครื่อง`);
    return TTS.speak(text, ttsRate);
  });
}
const fastBtn = it => h('button', { class: 'btn-play fast', 'aria-label': 'ฟังเร็วแบบคนจริง', onclick: () => play(it, 'fast') }, '⚡');
