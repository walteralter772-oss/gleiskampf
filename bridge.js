'use strict';

// Blick von einer Brücke auf eine zweigleisige Strecke, die in die Ferne läuft.
// Die Szene wird als Perspektive gerechnet: Kamera mittig über den Gleisen,
// x = quer zur Strecke, y = Höhe über den Schienen, z = Entfernung.
const Bridge = (() => {
  const CAM_H = 8;
  const LANE = 2.2;      // Abstand der Gleismitte von der Mitte
  const GAUGE = 0.72;    // halbe Spurweite
  const Z_CUT = 6.5;     // ab hier verschwinden Züge unter der Brücke
  const Z_FAR = 1400;

  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hexToRgb = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [120, 120, 120];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  function mulberry(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PALETTES = {
    day: {
      name: 'day', night: false, amb: 1,
      top: [58, 142, 226], hor: [208, 234, 248], haze: [205, 228, 242],
      grassFar: [146, 192, 120], grassNear: [64, 126, 50],
      hills: [[150, 186, 204], [120, 166, 150], [92, 140, 96]],
      ballast: [142, 136, 124], sleeper: [92, 72, 52], rail: [214, 220, 228],
      cloud: [255, 255, 255, 0.85]
    },
    evening: {
      name: 'evening', night: false, amb: 0.82,
      top: [52, 74, 128], hor: [255, 178, 108], haze: [248, 190, 146],
      grassFar: [152, 150, 92], grassNear: [66, 98, 48],
      hills: [[196, 134, 124], [142, 102, 104], [88, 80, 84]],
      ballast: [128, 118, 108], sleeper: [80, 62, 48], rail: [236, 200, 170],
      cloud: [255, 188, 150, 0.7]
    },
    night: {
      name: 'night', night: true, amb: 0.4,
      top: [6, 10, 26], hor: [28, 44, 78], haze: [26, 38, 66],
      grassFar: [28, 48, 44], grassNear: [10, 26, 22],
      hills: [[36, 52, 82], [26, 40, 62], [16, 28, 42]],
      ballast: [66, 66, 74], sleeper: [38, 32, 30], rail: [140, 150, 170],
      cloud: [70, 84, 120, 0.5]
    }
  };

  function paletteFor(hour) {
    if (hour >= 7 && hour < 17) return PALETTES.day;
    if ((hour >= 17 && hour < 21) || (hour >= 5 && hour < 7)) return PALETTES.evening;
    return PALETTES.night;
  }

  function start(canvas, opts) {
    opts = opts || {};
    const pal = opts.palette || paletteFor(new Date().getHours());
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const bg = document.createElement('canvas');
    const fg = document.createElement('canvas');
    const g = bg.getContext('2d');
    const q = fg.getContext('2d');
    let W = 0, H = 0, dpr = 1, hy = 0, f = 0;
    let raf = 0, stopped = false, last = 0;
    let trains = [];
    let wait = { '-1': 1.5, '1': 3.5 };

    const P = (x, y, z) => [W / 2 + f * x / z, hy + f * (CAM_H - y) / z];
    const amb = c => c.map(v => v * pal.amb);

    function poly(c, pts, fill) {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    }

    /* ----- Welt (feste Zufallswerte, damit die Szene immer gleich aussieht) ----- */
    const rnd = mulberry(20260);
    const stars = Array.from({ length: 90 }, () => [rnd(), rnd() * 0.8, rnd() * 1.4 + 0.4]);
    const clouds = Array.from({ length: 7 }, () => ({ x: rnd(), y: 0.1 + rnd() * 0.5, s: 0.6 + rnd() * 0.9 }));
    const FIELD_COLORS = [[208, 188, 72], [122, 172, 82], [152, 128, 82], [96, 152, 72], [172, 172, 92], [214, 200, 100]];
    const fields = Array.from({ length: 46 }, () => {
      const side = rnd() < 0.5 ? -1 : 1;
      const x0 = 11 + rnd() * 34;
      return { x0: side * x0, x1: side * (x0 + 14 + rnd() * 40), z0: 30 + rnd() * 900, dz: 24 + rnd() * 170, col: FIELD_COLORS[(rnd() * FIELD_COLORS.length) | 0] };
    }).sort((a, b) => b.z0 - a.z0);
    const trees = Array.from({ length: 190 }, () => {
      const side = rnd() < 0.5 ? -1 : 1;
      return { x: side * (8 + rnd() * 40), z: 45 + Math.pow(rnd(), 1.7) * 880, r: 2.2 + rnd() * 2.4, tone: rnd() };
    }).sort((a, b) => b.z - a.z);

    /* ----- Hintergrund: Himmel, Hügel, Felder, Gleisbett ----- */
    function drawBackground() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      const sky = g.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, rgb(pal.top));
      sky.addColorStop(1, rgb(pal.hor));
      g.fillStyle = sky;
      g.fillRect(0, 0, W, hy + 2);

      if (pal.night) {
        g.fillStyle = '#fff';
        stars.forEach(s => { g.globalAlpha = 0.35 + s[2] * 0.3; g.fillRect(s[0] * W, s[1] * hy, s[2], s[2]); });
        g.globalAlpha = 1;
        const mx = W * 0.78, my = hy * 0.3;
        const mg = g.createRadialGradient(mx, my, 4, mx, my, 70);
        mg.addColorStop(0, 'rgba(220,230,255,.55)'); mg.addColorStop(1, 'rgba(220,230,255,0)');
        g.fillStyle = mg; g.fillRect(mx - 70, my - 70, 140, 140);
        g.beginPath(); g.arc(mx, my, 15, 0, 7); g.fillStyle = '#e9efff'; g.fill();
      } else {
        const ev = pal.name === 'evening';
        const sx = W * (ev ? 0.68 : 0.74), sy = ev ? hy - 14 : hy * 0.42, rr = ev ? 190 : 120;
        const sg = g.createRadialGradient(sx, sy, 4, sx, sy, rr);
        sg.addColorStop(0, ev ? 'rgba(255,236,190,.95)' : 'rgba(255,250,220,.95)');
        sg.addColorStop(0.2, ev ? 'rgba(255,170,90,.5)' : 'rgba(255,245,200,.4)');
        sg.addColorStop(1, 'rgba(255,200,120,0)');
        g.fillStyle = sg; g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
      }

      clouds.forEach(c => {
        const cx = c.x * W, cy = c.y * hy, s = c.s * Math.max(0.6, W / 900);
        g.fillStyle = rgb(pal.cloud.slice(0, 3), pal.cloud[3]);
        [[0, 0, 60], [48, 8, 44], [-46, 10, 40], [18, -14, 38], [90, 14, 30]].forEach(e => {
          g.beginPath(); g.ellipse(cx + e[0] * s, cy + e[1] * s, e[2] * s, e[2] * s * 0.45, 0, 0, 7); g.fill();
        });
      });

      pal.hills.forEach((col, L) => {
        const amp = hy * [0.09, 0.13, 0.08][L];
        g.beginPath();
        g.moveTo(0, hy + 1);
        for (let x = 0; x <= W; x += 6) {
          const y = hy - amp * (0.55 + 0.3 * Math.sin(x * 0.006 * (L + 1) + L * 2.1) + 0.15 * Math.sin(x * 0.021 + L));
          g.lineTo(x, y);
        }
        g.lineTo(W, hy + 1);
        g.closePath();
        g.fillStyle = rgb(mix(col, pal.haze, 0.12 * (2 - L)));
        g.fill();
      });

      const gr = g.createLinearGradient(0, hy, 0, H);
      gr.addColorStop(0, rgb(mix(pal.grassFar, pal.haze, 0.45)));
      gr.addColorStop(0.35, rgb(pal.grassFar));
      gr.addColorStop(1, rgb(pal.grassNear));
      g.fillStyle = gr;
      g.fillRect(0, hy, W, H - hy);

      g.save();
      g.beginPath(); g.rect(0, hy, W, H - hy); g.clip();
      fields.forEach(fl => {
        const col = mix(amb(fl.col), pal.haze, clamp(fl.z0 / 1100, 0, 0.85));
        poly(g, [P(fl.x0, 0, fl.z0), P(fl.x1, 0, fl.z0), P(fl.x1, 0, fl.z0 + fl.dz), P(fl.x0, 0, fl.z0 + fl.dz)], rgb(col));
      });

      // Gleisbett
      const bz0 = 7;
      const bgrad = g.createLinearGradient(0, hy, 0, H);
      bgrad.addColorStop(0, rgb(mix(amb(pal.ballast), pal.haze, 0.75)));
      bgrad.addColorStop(1, rgb(amb(pal.ballast)));
      poly(g, [P(-5.1, 0, bz0), P(-4.5, 0, bz0), P(-4.5, 0, Z_FAR), P(-5.1, 0, Z_FAR)], rgb(mix(amb(pal.ballast), [60, 70, 50], 0.35)));
      poly(g, [P(4.5, 0, bz0), P(5.1, 0, bz0), P(5.1, 0, Z_FAR), P(4.5, 0, Z_FAR)], rgb(mix(amb(pal.ballast), [60, 70, 50], 0.35)));
      poly(g, [P(-4.5, 0, bz0), P(4.5, 0, bz0), P(4.5, 0, Z_FAR), P(-4.5, 0, Z_FAR)], bgrad);

      for (let z = 190; z >= bz0; z -= 0.65) {
        const col = rgb(mix(amb(pal.sleeper), mix(amb(pal.ballast), pal.haze, 0.4), clamp(z / 230, 0, 0.9)));
        [-LANE, LANE].forEach(c => {
          poly(g, [P(c - 1.4, 0.05, z), P(c + 1.4, 0.05, z), P(c + 1.4, 0.05, z + 0.26), P(c - 1.4, 0.05, z + 0.26)], col);
        });
      }

      const rg = g.createLinearGradient(0, hy, 0, H);
      rg.addColorStop(0, rgb(mix(amb(pal.rail), pal.haze, 0.7)));
      rg.addColorStop(1, rgb(amb(pal.rail)));
      [-LANE, LANE].forEach(c => [-1, 1].forEach(s => {
        const xr = c + s * GAUGE;
        poly(g, [P(xr - 0.07, 0.17, bz0), P(xr + 0.07, 0.17, bz0), P(xr + 0.07, 0.17, Z_FAR), P(xr - 0.07, 0.17, Z_FAR)], rg);
      }));

      trees.forEach(t => {
        const fog = clamp(t.z / 950, 0, 0.8);
        const base = P(t.x, 0, t.z), crown = P(t.x, 1.6 + t.r, t.z);
        const rad = Math.max(1, t.r * f / t.z);
        g.strokeStyle = rgb(mix(amb([84, 60, 40]), pal.haze, fog));
        g.lineWidth = Math.max(1, 0.4 * f / t.z);
        g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(crown[0], crown[1]); g.stroke();
        const dark = amb(mix([34, 96, 44], [70, 130, 52], t.tone));
        const light = amb(mix([96, 168, 82], [150, 190, 80], t.tone));
        const cg = g.createRadialGradient(crown[0] - rad * 0.3, crown[1] - rad * 0.35, rad * 0.1, crown[0], crown[1], rad);
        cg.addColorStop(0, rgb(mix(light, pal.haze, fog)));
        cg.addColorStop(1, rgb(mix(dark, pal.haze, fog)));
        g.fillStyle = cg;
        g.beginPath(); g.ellipse(crown[0], crown[1], rad, rad * 1.1, 0, 0, 7); g.fill();
      });
      g.restore();
    }

    /* ----- Vordergrund: Oberleitung, Masten, Brückengeländer ----- */
    function drawForeground() {
      q.setTransform(dpr, 0, 0, dpr, 0, 0);
      q.clearRect(0, 0, W, H);
      const steel = amb([88, 96, 106]);

      for (let z = 800; z >= 20; z -= 45) {
        const fog = clamp(z / 900, 0, 0.8);
        [-1, 1].forEach(s => {
          const x = s * 5.9;
          const b = P(x, 0, z), t = P(x, 8.8, z);
          q.strokeStyle = rgb(mix(steel, pal.haze, fog));
          q.lineCap = 'butt';
          q.lineWidth = Math.max(1, 0.3 * f / z);
          q.beginPath(); q.moveTo(b[0], b[1]); q.lineTo(t[0], t[1]); q.stroke();
          const a1 = P(x, 7.6, z), a2 = P(s * LANE, 7.0, z);
          q.lineWidth = Math.max(1, 0.14 * f / z);
          q.beginPath(); q.moveTo(a1[0], a1[1]); q.lineTo(a2[0], a2[1]); q.stroke();
        });
      }

      q.strokeStyle = rgb(mix(amb([40, 44, 50]), pal.haze, 0.1), 0.9);
      [-LANE, LANE].forEach(c => [5.6, 6.9].forEach((y, k) => {
        const a = P(c, y, 8), b = P(c, y, Z_FAR);
        q.lineWidth = k ? 1 : 1.4;
        q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke();
      }));

      // Brückengeländer
      const ph = Math.round(H * 0.17);
      const top = H - ph;
      const wall = q.createLinearGradient(0, top + 14, 0, H);
      wall.addColorStop(0, rgb(amb([150, 154, 162])));
      wall.addColorStop(1, rgb(amb([96, 100, 108])));
      q.fillStyle = wall;
      q.fillRect(0, top + 22, W, ph - 22);
      q.fillStyle = rgb(amb([188, 192, 200]));
      q.fillRect(0, top + 22, W, 3);
      const shade = q.createLinearGradient(0, top - 40, 0, top + 22);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.35)');
      q.fillStyle = shade;
      q.fillRect(0, top - 40, W, 62);
      q.fillStyle = rgb(amb([58, 64, 72]));
      for (let x = 10; x < W; x += 30) q.fillRect(x, top + 8, 6, 20);
      q.fillStyle = rgb(amb([74, 80, 90]));
      q.fillRect(0, top, W, 10);
      q.fillStyle = rgb(amb([130, 138, 150]));
      q.fillRect(0, top, W, 3);
      [0, W - 22].forEach(x => {
        q.fillStyle = rgb(amb([62, 68, 78]));
        q.fillRect(x, top - 14, 22, ph + 14);
        q.fillStyle = rgb(amb([110, 118, 130]));
        q.fillRect(x, top - 14, 22, 4);
      });

      const vg = q.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.45, W / 2, H * 0.5, Math.max(W, H) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
      q.fillStyle = vg;
      q.fillRect(0, 0, W, H);
    }

    /* ----- Züge ----- */
    function trainSpec(card) {
      const k = card ? card.k : 'ice';
      const body = hexToRgb(card ? card.c : '#e9edf1');
      const accent = hexToRgb(card ? card.c2 : '#ec0016');
      let len = 85, h = 3.9, w = 1.5, car = 26;
      if (/^ice|maglev/.test(k)) { len = 135; }
      else if (k === 'emu') { len = 60; }
      else if (k === 'tee' || k === 'flhamb') { len = 55; }
      else if (/^steam|stream05/.test(k)) { len = 75; h = 4.1; car = 18; }
      else if (k === 'railbus') { len = 26; car = 26; }
      else if (k === 'koef') { len = 12; h = 3.2; w = 1.3; car = 12; }
      else if (/^diesel/.test(k)) { len = 80; }
      return { body, accent, len, h, w, car, steam: /^steam|stream05/.test(k) };
    }

    function pickCard() {
      const list = opts.cards || [];
      if (!list.length) return null;
      const weights = list.map(c => 1 + c.r * 1.5);
      let x = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < list.length; i++) { x -= weights[i]; if (x < 0) return list[i]; }
      return list[0];
    }

    function spawn(lane, near) {
      const spec = trainSpec(pickCard());
      const t = Object.assign({ lane, spec, v: lane < 0 ? 40 + Math.random() * 22 : 26 + Math.random() * 22 }, {});
      t.len = spec.len;
      t.z = lane < 0 ? (near || 640) : Z_CUT - spec.len;
      trains.push(t);
    }

    function drawTrain(t) {
      const sp = t.spec;
      const xc = t.lane * LANE, s = t.lane;
      const w = sp.w, yb = 0.45, yt = sp.h;
      const zn = Math.max(t.z, Z_CUT), zf = t.z + t.len;
      if (zf <= Z_CUT + 0.2) return;
      const fog = clamp(zn / 1000, 0, 0.7);
      const body = amb(sp.body), accent = amb(sp.accent);
      const f2 = c => rgb(mix(c, pal.haze, fog));
      const inner = xc - s * w, ix = xc - s * w * 0.8, ox = xc + s * w * 0.8;
      const sideCol = mix(body, [0, 0, 0], 0.25);

      // Seitenwand (zur Mitte hin)
      poly(q2, [P(inner, yb, zn), P(inner, yt - 0.35, zn), P(inner, yt - 0.35, zf), P(inner, yb, zf)], f2(sideCol));
      poly(q2, [P(inner, yb, zn), P(inner, 0.85, zn), P(inner, 0.85, zf), P(inner, yb, zf)], f2([30, 32, 36].map(v => v * pal.amb)));
      poly(q2, [P(inner, 0.95, zn), P(inner, 1.28, zn), P(inner, 1.28, zf), P(inner, 0.95, zf)], f2(mix(accent, [0, 0, 0], 0.2)));

      // Fenster je Wagen
      if (f * 1.0 / zn > 1.2) {
        const n = Math.ceil((zf - t.z) / sp.car);
        for (let i = 0; i < n; i++) {
          const a = Math.max(zn, t.z + i * sp.car + 1.2), b = t.z + (i + 1) * sp.car - 1.2;
          if (b <= a || b > zf) continue;
          poly(q2, [P(inner, 2.05, a), P(inner, 3.2, a), P(inner, 3.2, b), P(inner, 2.05, b)], f2(pal.night ? [220, 190, 110] : [32, 44, 58]));
        }
      }

      // Dach
      poly(q2, [P(inner, yt - 0.35, zn), P(ix, yt, zn), P(ix, yt, zf), P(inner, yt - 0.35, zf)], f2(mix(body, [255, 255, 255], 0.12)));
      poly(q2, [P(ix, yt, zn), P(ox, yt, zn), P(ox, yt, zf), P(ix, yt, zf)], f2(mix(body, [255, 255, 255], 0.3)));

      // Stirnseite (vorne oder hinten)
      if (t.z >= Z_CUT) {
        const front = t.lane < 0;
        poly(q2, [P(xc - w, yb, zn), P(xc + w, yb, zn), P(xc + w, yt - 0.35, zn), P(xc - w, yt - 0.35, zn)], f2(body));
        poly(q2, [P(xc - w, yt - 0.35, zn), P(xc + w, yt - 0.35, zn), P(xc + w * 0.8, yt, zn), P(xc - w * 0.8, yt, zn)], f2(mix(body, [255, 255, 255], 0.14)));
        poly(q2, [P(xc - w, 0.95, zn), P(xc + w, 0.95, zn), P(xc + w, 1.3, zn), P(xc - w, 1.3, zn)], f2(accent));
        poly(q2, [P(xc - w, yb, zn), P(xc + w, yb, zn), P(xc + w, 0.8, zn), P(xc - w, 0.8, zn)], f2([30, 32, 36].map(v => v * pal.amb)));
        const wsT = sp.steam ? 3.2 : 3.35;
        poly(q2, [P(xc - w * 0.72, 2.1, zn), P(xc + w * 0.72, 2.1, zn), P(xc + w * 0.66, wsT, zn), P(xc - w * 0.66, wsT, zn)], f2(front ? [28, 38, 50] : [44, 52, 62]));
        const lamp = front ? (pal.night ? [255, 250, 220] : [255, 244, 200]) : [230, 40, 40];
        [-0.9, 0.9].forEach(dx => {
          const p = P(xc + dx * (w / 1.5), 1.15, zn);
          const r = Math.max(0.8, (front ? 0.18 : 0.12) * f / zn);
          if (pal.night || !front) {
            const gl = q2.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * (front ? 7 : 4));
            gl.addColorStop(0, rgb(lamp, front ? 0.8 : 0.55)); gl.addColorStop(1, rgb(lamp, 0));
            q2.fillStyle = gl; q2.beginPath(); q2.arc(p[0], p[1], r * (front ? 7 : 4), 0, 7); q2.fill();
          }
          q2.fillStyle = rgb(lamp); q2.beginPath(); q2.arc(p[0], p[1], r, 0, 7); q2.fill();
        });
        if (sp.steam) {
          const c = P(xc, 2.2, zn), r = 0.95 * f / zn;
          q2.fillStyle = rgb(f2([24, 24, 28])); q2.beginPath(); q2.arc(c[0], c[1], r, 0, 7); q2.fill();
          const ch = P(xc, 4.6, zn);
          q2.fillRect(ch[0] - 0.22 * f / zn, ch[1], 0.44 * f / zn, 0.9 * f / zn);
        }
      }
    }

    let q2 = null;

    /* ----- Ablauf ----- */
    function size() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(280, Math.round(r.width));
      H = Math.max(260, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      bg.width = fg.width = W * dpr; bg.height = fg.height = H * dpr;
      hy = H * 0.4;
      f = Math.min(W * 0.8, H * 0.9);
      drawBackground();
      drawForeground();
      render();
    }

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      q2 = ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      trains.slice().sort((a, b) => b.z - a.z).forEach(drawTrain);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fg, 0, 0);
    }

    function step(dt) {
      trains.forEach(t => { t.z += (t.lane < 0 ? -t.v : t.v) * dt; });
      trains = trains.filter(t => t.lane < 0 ? t.z + t.len > Z_CUT + 0.5 : t.z < 760);
      [-1, 1].forEach(lane => {
        if (trains.some(t => t.lane === lane)) { wait[lane] = 2 + Math.random() * 5; return; }
        wait[lane] -= dt;
        if (wait[lane] <= 0) { spawn(lane); wait[lane] = 2 + Math.random() * 5; }
      });
    }

    function frame(now) {
      if (stopped) return;
      if (!canvas.isConnected) { stop(); return; }
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      step(dt);
      render();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', size);
    }

    let ro = null;
    size();
    spawn(-1, opts.initialZ || 260);
    spawn(1, 0);
    trains[1].z = 40;
    render();
    if (window.ResizeObserver) { ro = new ResizeObserver(() => size()); ro.observe(canvas.parentNode || canvas); }
    else window.addEventListener('resize', size);
    if (!calm && !opts.freeze) raf = requestAnimationFrame(frame);

    return {
      stop,
      callTrain() { if (!trains.some(t => t.lane < 0 && t.z > 120)) spawn(-1, 520); }
    };
  }

  return { start, paletteFor, PALETTES };
})();
