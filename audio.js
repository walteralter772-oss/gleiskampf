'use strict';

// Alle Geräusche werden live erzeugt, es sind keine Audiodateien nötig.
const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    const c = init();
    if (c && c.state === 'suspended') c.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.6;
  }

  function tone(freq, start, dur, type, vol, slideTo) {
    const c = init();
    if (!c || muted) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(start, dur, vol, freq, q) {
    const c = init();
    if (!c || muted) return;
    const t = c.currentTime + start;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 1200;
    f.Q.value = q || 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    resume, setMuted,
    isMuted: () => muted,

    click() { tone(520, 0, 0.06, 'square', 0.06); },
    // Zweiklang-Signalhorn
    horn() { tone(311, 0, 0.7, 'sawtooth', 0.09); tone(392, 0, 0.7, 'sawtooth', 0.09); },
    hornShort() { tone(311, 0, 0.28, 'sawtooth', 0.08); tone(392, 0, 0.28, 'sawtooth', 0.08); },
    // Dampflok-Rattern
    chug(n) {
      for (let i = 0; i < (n || 4); i++) noise(i * 0.16, 0.12, 0.22, 700, 0.6);
    },
    hit() { noise(0, 0.14, 0.4, 500, 0.5); tone(150, 0, 0.16, 'square', 0.16, 60); },
    heavyHit() { noise(0, 0.28, 0.6, 350, 0.4); tone(110, 0, 0.3, 'sawtooth', 0.2, 40); },
    zap() { tone(900, 0, 0.18, 'sawtooth', 0.1, 120); noise(0, 0.1, 0.25, 3500, 1); },
    whoosh() { noise(0, 0.5, 0.25, 1500, 0.5); tone(300, 0, 0.5, 'sine', 0.05, 900); },
    faint() { tone(300, 0, 0.5, 'sawtooth', 0.12, 60); },
    swap() { tone(440, 0, 0.08, 'triangle', 0.12); tone(660, 0.08, 0.1, 'triangle', 0.12); },
    flip() { noise(0, 0.07, 0.2, 2500, 1); },
    tear() { noise(0, 0.5, 0.35, 3000, 0.4); },
    coin() { tone(988, 0, 0.08, 'square', 0.08); tone(1319, 0.08, 0.2, 'square', 0.08); },
    rare(level) {
      const notes = [523, 659, 784, 1047, 1319];
      const n = 3 + (level || 1);
      for (let i = 0; i < n && i < notes.length; i++) tone(notes[i], i * 0.09, 0.4, 'triangle', 0.12);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.4, 'triangle', 0.14));
      tone(1047, 0.6, 0.8, 'triangle', 0.12);
      tone(784, 0.6, 0.8, 'triangle', 0.1);
    },
    lose() {
      [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.22, 0.4, 'sawtooth', 0.1));
    },
    riser() { noise(0, 0.9, 0.22, 2200, 0.5); tone(180, 0, 0.9, 'sawtooth', 0.06, 1100); tone(90, 0, 0.9, 'square', 0.05, 440); },
    boom() { tone(120, 0, 0.5, 'sine', 0.35, 35); noise(0, 0.35, 0.4, 600, 0.4); tone(60, 0, 0.6, 'triangle', 0.2, 30); },
    shimmer(level) {
      const base = [1568, 1760, 2093, 2637][level || 0];
      const n = 3 + (level || 0) * 2;
      for (let i = 0; i < n; i++) tone(base * (1 + (i % 3) * 0.25), i * 0.05, 0.35, 'sine', 0.045);
    },
    stationBell() { tone(880, 0, 0.5, 'sine', 0.1); tone(660, 0.35, 0.7, 'sine', 0.1); }
  };
})();
