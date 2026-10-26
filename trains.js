'use strict';

// Typen: Dampf schlägt Diesel, Diesel schlägt Elektro,
// Elektro schlägt Hochgeschwindigkeit, Hochgeschwindigkeit schlägt Dampf.
const TYPES = {
  dampf:   { name: 'Dampf',            color: '#c4372b', beats: 'diesel',  atk: ['Kohle schaufeln', 'Volldampf'] },
  diesel:  { name: 'Diesel',           color: '#d98a00', beats: 'elektro', atk: ['Dieselstoß', 'Turbolader'] },
  elektro: { name: 'Elektro',          color: '#2b7de0', beats: 'ice',     atk: ['Funkenflug', 'Oberleitungsblitz'] },
  ice:     { name: 'Hochgeschwindigkeit', color: '#12a58f', beats: 'dampf', atk: ['Schnellfahrt', 'Rekordfahrt'] }
};

const RARITY = [
  { name: 'Normal',   short: 'N', color: '#9aa3ad' },
  { name: 'Selten',   short: 'S', color: '#3fa7ff' },
  { name: 'Episch',   short: 'E', color: '#b266ff' },
  { name: 'Legendär', short: 'L', color: '#ffb000' }
];

// k = Zeichnung, c/c2 = Körper-/Akzentfarbe, v = km/h, hp = Lebenspunkte, at = Angriff
// sp = eigener Name für Angriff 2 (optional)
const CARDS = [
  // Dampf
  { id: 1,  nm: 'Adler',            ty: 'dampf',   r: 2, y: 1835, v: 30,  hp: 86,  at: 17, k: 'steamOld', c: '#2b2b2b', c2: '#a8321f', sp: 'Erste Fahrt',     t: 'Erste Dampflok Deutschlands. Fuhr 1835 von Nürnberg nach Fürth.' },
  { id: 2,  nm: 'BR 01',            ty: 'dampf',   r: 1, y: 1925, v: 120, hp: 82,  at: 17, k: 'steam',    c: '#23262b', c2: '#b3261e', t: 'Schnellzuglok der Reichsbahn. Lief bis in die 1970er.' },
  { id: 3,  nm: 'BR 03',            ty: 'dampf',   r: 0, y: 1930, v: 120, hp: 70,  at: 14, k: 'steam',    c: '#262a30', c2: '#b3261e', t: 'Die kleine Schwester der BR 01.' },
  { id: 4,  nm: 'BR 05',            ty: 'dampf',   r: 3, y: 1935, v: 200, hp: 122, at: 26, k: 'stream05', c: '#a71d17', c2: '#1b1d21', sp: 'Rekordlauf',      t: 'Stromlinien-Rekordlok. 1936 fuhr sie 200,4 km/h.' },
  { id: 5,  nm: 'Bayerische S 3/6', ty: 'dampf',   r: 2, y: 1908, v: 120, hp: 92,  at: 19, k: 'steam',    c: '#1d4d3a', c2: '#c8a24a', t: 'Die »Hochhaxige« zog schwere Schnellzüge durch Bayern.' },
  { id: 6,  nm: 'BR 41',            ty: 'dampf',   r: 0, y: 1937, v: 90,  hp: 72,  at: 14, k: 'steam',    c: '#24272c', c2: '#b3261e', t: 'Kräftige Lok für schwere Güterzüge.' },
  { id: 7,  nm: 'BR 50',            ty: 'dampf',   r: 0, y: 1939, v: 80,  hp: 68,  at: 13, k: 'steam',    c: '#272a2f', c2: '#b3261e', t: 'Einheits-Güterzuglok. Tausendfach gebaut.' },
  { id: 8,  nm: 'BR 52',            ty: 'dampf',   r: 0, y: 1942, v: 80,  hp: 66,  at: 13, k: 'steam',    c: '#2a2c30', c2: '#8a8f96', t: 'Die Kriegslok. Über 6000 Stück wurden gebaut.' },
  { id: 9,  nm: 'BR 64 Bubikopf',   ty: 'dampf',   r: 0, y: 1928, v: 90,  hp: 60,  at: 12, k: 'steamTank', c: '#25282d', c2: '#b3261e', t: 'Wendige Lok für den Nahverkehr. Der Spitzname: Bubikopf.' },

  // Diesel
  { id: 10, nm: 'V 200',            ty: 'diesel',  r: 1, y: 1953, v: 140, hp: 80,  at: 16, k: 'diesel',   c: '#8f2b22', c2: '#d9cdb0', t: 'Erste Großdiesellok der Bundesbahn.' },
  { id: 11, nm: 'BR 218',           ty: 'diesel',  r: 0, y: 1971, v: 160, hp: 74,  at: 15, k: 'diesel',   c: '#c33a2b', c2: '#e8e2d2', t: 'Die Diesel-Allzweckwaffe. Fast 400 Stück gebaut.' },
  { id: 12, nm: 'BR 232 Ludmilla',  ty: 'diesel',  r: 1, y: 1973, v: 120, hp: 84,  at: 17, k: 'dieselBig', c: '#b8321f', c2: '#e8e2d2', t: 'In der Sowjetunion gebaut. Bei uns heißt sie Ludmilla.' },
  { id: 13, nm: 'V 100',            ty: 'diesel',  r: 0, y: 1958, v: 100, hp: 66,  at: 13, k: 'dieselSmall', c: '#a8301f', c2: '#d9cdb0', t: 'Kleine Streckenlok für Nebenbahnen.' },
  { id: 14, nm: 'Schienenbus',      ty: 'diesel',  r: 0, y: 1950, v: 90,  hp: 56,  at: 11, k: 'railbus',  c: '#b8321f', c2: '#e8e2d2', t: 'Der Schienenbus rettete viele Nebenbahnen.' },
  { id: 15, nm: 'Köf II',           ty: 'diesel',  r: 0, y: 1935, v: 45,  hp: 50,  at: 10, k: 'koef',     c: '#b8321f', c2: '#2a2c30', t: 'Kleine Rangierlok im Bahnhof.' },
  { id: 16, nm: 'Fliegender Hamburger', ty: 'diesel', r: 2, y: 1933, v: 160, hp: 95, at: 20, k: 'flhamb',  c: '#2d5da8', c2: '#e9dcc0', sp: 'Blitzstart', t: 'Stromlinien-Triebzug. Berlin–Hamburg in gut zwei Stunden.' },
  { id: 17, nm: 'VT 11.5',          ty: 'diesel',  r: 2, y: 1957, v: 140, hp: 96,  at: 19, k: 'tee',      c: '#a62a22', c2: '#e9dcc0', sp: 'Trans-Europ',     t: 'Der TEE: Luxus auf Schienen durch ganz Europa.' },

  // Elektro
  { id: 18, nm: 'E 19',             ty: 'elektro', r: 2, y: 1939, v: 180, hp: 98,  at: 21, k: 'electricRound', c: '#6d7c8c', c2: '#d9dde2', t: 'Stromlinienlok für 180 km/h. Ihrer Zeit weit voraus.' },
  { id: 19, nm: 'BR 103',           ty: 'elektro', r: 3, y: 1965, v: 200, hp: 118, at: 25, k: 'electricRound', c: '#b52b20', c2: '#e8e2d2', sp: 'Königin der Strecke', t: 'Tempo 200 im Alltag. Die Königin der Strecke.' },
  { id: 20, nm: 'BR 110',           ty: 'elektro', r: 1, y: 1956, v: 150, hp: 82,  at: 16, k: 'electric', c: '#2f6aa8', c2: '#e4e0d4', t: 'Die E 10 fuhr überall in Deutschland.' },
  { id: 21, nm: 'BR 140',           ty: 'elektro', r: 0, y: 1957, v: 110, hp: 70,  at: 14, k: 'electric', c: '#4a5560', c2: '#c0392b', t: 'Das Arbeitstier für Güterzüge.' },
  { id: 22, nm: 'BR 143',           ty: 'elektro', r: 0, y: 1984, v: 120, hp: 68,  at: 13, k: 'electric', c: '#c0392b', c2: '#dcd6c6', t: 'Aus der DDR. Viele fahren noch heute.' },
  { id: 23, nm: 'BR 101',           ty: 'elektro', r: 2, y: 1996, v: 220, hp: 100, at: 21, k: 'electricRound', c: '#e6eaee', c2: '#ec0016', t: 'Moderne Intercity-Lok mit 220 km/h.' },
  { id: 24, nm: 'BR 185',           ty: 'elektro', r: 1, y: 2001, v: 140, hp: 86,  at: 17, k: 'electricRound', c: '#b32a22', c2: '#222428', t: 'TRAXX: Güterzuglok, die durch mehrere Länder fährt.' },
  { id: 25, nm: 'BR 193 Vectron',   ty: 'elektro', r: 1, y: 2010, v: 160, hp: 88,  at: 18, k: 'electricRound', c: '#2a2e35', c2: '#ec0016', t: 'Moderne Mehrsystem-Lok von Siemens.' },
  { id: 26, nm: 'S-Bahn BR 481',    ty: 'elektro', r: 0, y: 1996, v: 100, hp: 62,  at: 11, k: 'emu',      c: '#c33a2b', c2: '#f0dd7a', t: 'Die Berliner S-Bahn in Rot und Gelb.' },
  { id: 27, nm: 'S-Bahn BR 423',    ty: 'elektro', r: 0, y: 1999, v: 140, hp: 64,  at: 12, k: 'emu',      c: '#c9ced4', c2: '#ec0016', t: 'Beschleunigt schnell und hält oft.' },

  // Hochgeschwindigkeit
  { id: 28, nm: 'ICE 1',            ty: 'ice',     r: 1, y: 1991, v: 280, hp: 90,  at: 18, k: 'ice',      c: '#eef1f4', c2: '#ec0016', t: 'Der Start der ICE-Ära im Jahr 1991.' },
  { id: 29, nm: 'ICE 2',            ty: 'ice',     r: 1, y: 1996, v: 280, hp: 88,  at: 18, k: 'ice',      c: '#eef1f4', c2: '#ec0016', t: 'Kann geteilt fahren. Zwei Ziele in einer Fahrt.' },
  { id: 30, nm: 'ICE 3',            ty: 'ice',     r: 3, y: 1999, v: 330, hp: 125, at: 27, k: 'ice3',     c: '#f2f4f6', c2: '#ec0016', sp: 'Vollgas 330',     t: 'Motoren unter dem ganzen Zug. Testfahrt: 330 km/h.' },
  { id: 31, nm: 'ICE T',            ty: 'ice',     r: 2, y: 1999, v: 230, hp: 96,  at: 20, k: 'ice',      c: '#eef1f4', c2: '#ec0016', sp: 'Neigefahrt',      t: 'Neigt sich in Kurven und fährt dadurch schneller.' },
  { id: 32, nm: 'ICE 4',            ty: 'ice',     r: 2, y: 2017, v: 250, hp: 105, at: 22, k: 'ice3',     c: '#f4f6f8', c2: '#ec0016', t: 'Der moderne Alleskönner im ICE-Netz.' },
  { id: 33, nm: 'ICE-TD',           ty: 'ice',     r: 2, y: 2001, v: 200, hp: 92,  at: 19, k: 'ice',      c: '#eef1f4', c2: '#ec0016', t: 'Ein ICE mit Dieselmotoren und Neigetechnik.' },
  { id: 34, nm: 'Transrapid',       ty: 'ice',     r: 3, y: 1993, v: 450, hp: 130, at: 28, k: 'maglev',   c: '#e8ecf0', c2: '#3b8ee6', sp: 'Magnetschub',     t: 'Schwebt auf Magneten. Testrekord: 450 km/h.' }
];

const CARD_BY_ID = {};
CARDS.forEach(c => { CARD_BY_ID[c.id] = c; });

/* ---------- Zeichnungen (Seitenansicht, Nase nach rechts) ---------- */

function wheel(x, y, r, col, spokes) {
  let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="#15171a"/><circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="${col || '#7b828a'}"/><circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="#15171a"/>`;
  if (spokes) {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      s += `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(a) * r * 0.7).toFixed(1)}" y2="${(y + Math.sin(a) * r * 0.7).toFixed(1)}" stroke="#15171a" stroke-width="1.4"/>`;
    }
  }
  return s;
}

function bogie(x, y) {
  return `<rect x="${x - 17}" y="${y - 9}" width="34" height="9" rx="2" fill="#1b1d21"/>` + wheel(x - 9, y, 7) + wheel(x + 9, y, 7);
}

function pantograph(x, y) {
  return `<g stroke="#15171a" stroke-width="1.6" fill="none"><path d="M${x} ${y} l9 -11 l9 11"/><path d="M${x + 9} ${y - 11} l0 -2"/><line x1="${x + 1}" y1="${y - 14}" x2="${x + 17}" y2="${y - 14}" stroke-width="2.2"/></g>`;
}

function windowsRow(x0, x1, y, h, n, col) {
  const gap = 3, w = (x1 - x0 - gap * (n - 1)) / n;
  let s = '';
  for (let i = 0; i < n; i++) s += `<rect x="${(x0 + i * (w + gap)).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="1.5" fill="${col || '#27323d'}"/>`;
  return s;
}

const ART = {
  steam(c) {
    return `
      <rect x="6" y="52" width="66" height="30" rx="2" fill="#1d1f23"/>
      <path d="M8 52 L16 40 L36 36 L58 40 L70 52 Z" fill="#101113"/>
      <rect x="6" y="64" width="66" height="3" fill="${c.c2}"/>
      <rect x="72" y="34" width="34" height="48" rx="2" fill="${c.c}"/>
      <rect x="68" y="30" width="42" height="6" rx="1.5" fill="#15171a"/>
      <rect x="80" y="42" width="16" height="14" rx="1.5" fill="#27323d"/>
      <rect x="104" y="48" width="86" height="30" rx="14" fill="${c.c}"/>
      <rect x="116" y="48" width="3" height="30" fill="#ffffff22"/><rect x="144" y="48" width="3" height="30" fill="#ffffff22"/><rect x="170" y="48" width="3" height="30" fill="#ffffff22"/>
      <rect x="186" y="50" width="14" height="26" rx="6" fill="#16181b"/>
      <path d="M176 48 l-3 -16 l14 0 l-3 16 Z" fill="#15171a"/>
      <rect x="170" y="30" width="22" height="4" rx="2" fill="#15171a"/>
      <ellipse cx="138" cy="46" rx="8" ry="6" fill="#16181b"/>
      <ellipse cx="156" cy="46" rx="4" ry="4" fill="#16181b"/>
      <rect x="102" y="78" width="96" height="4" fill="#15171a"/>
      <rect x="196" y="76" width="10" height="12" rx="1.5" fill="${c.c2}"/>
      <circle cx="199" cy="62" r="3.4" fill="#ffe9a3"/>
      <rect x="164" y="80" width="22" height="9" rx="2" fill="#2b2e33"/>
      <line x1="96" y1="82" x2="152" y2="82" stroke="#c9ced4" stroke-width="2.4"/>
      ${wheel(24, 86, 7)}${wheel(42, 86, 7)}${wheel(60, 86, 7)}
      ${wheel(96, 80, 14, c.c2, true)}${wheel(124, 80, 14, c.c2, true)}${wheel(152, 80, 14, c.c2, true)}
      ${wheel(186, 87, 6)}
      <g class="puffs"><circle class="puff p1" cx="181" cy="26" r="6"/><circle class="puff p2" cx="181" cy="26" r="6"/><circle class="puff p3" cx="181" cy="26" r="6"/></g>`;
  },

  steamTank(c) {
    return `
      <rect x="36" y="34" width="52" height="50" rx="2" fill="${c.c}"/>
      <rect x="32" y="30" width="60" height="6" rx="1.5" fill="#15171a"/>
      <rect x="48" y="42" width="22" height="16" rx="1.5" fill="#27323d"/>
      <rect x="88" y="46" width="94" height="34" rx="16" fill="${c.c}"/>
      <rect x="40" y="62" width="50" height="22" fill="#1d1f23"/>
      <rect x="40" y="68" width="140" height="3" fill="${c.c2}"/>
      <rect x="178" y="50" width="14" height="26" rx="6" fill="#16181b"/>
      <path d="M168 46 l-3 -16 l14 0 l-3 16 Z" fill="#15171a"/>
      <rect x="162" y="28" width="22" height="4" rx="2" fill="#15171a"/>
      <ellipse cx="130" cy="44" rx="8" ry="6" fill="#16181b"/>
      <rect x="40" y="80" width="150" height="5" fill="#15171a"/>
      <rect x="190" y="76" width="10" height="12" rx="1.5" fill="${c.c2}"/>
      <circle cx="190" cy="60" r="3.4" fill="#ffe9a3"/>
      ${wheel(62, 84, 9)}${wheel(104, 82, 13, c.c2, true)}${wheel(136, 82, 13, c.c2, true)}${wheel(170, 86, 8)}
      <g class="puffs"><circle class="puff p1" cx="173" cy="24" r="6"/><circle class="puff p2" cx="173" cy="24" r="6"/><circle class="puff p3" cx="173" cy="24" r="6"/></g>`;
  },

  steamOld(c) {
    return `
      <rect x="6" y="52" width="70" height="26" rx="3" fill="#8a5a33"/>
      <rect x="6" y="50" width="70" height="4" fill="#5e3b1f"/>
      <rect x="14" y="58" width="12" height="12" rx="1" fill="#e6d1a6"/><rect x="32" y="58" width="12" height="12" rx="1" fill="#e6d1a6"/><rect x="50" y="58" width="12" height="12" rx="1" fill="#e6d1a6"/>
      <rect x="84" y="46" width="94" height="26" rx="12" fill="${c.c}"/>
      <rect x="92" y="46" width="3" height="26" fill="${c.c2}"/><rect x="130" y="46" width="3" height="26" fill="${c.c2}"/><rect x="164" y="46" width="3" height="26" fill="${c.c2}"/>
      <rect x="172" y="28" width="12" height="22" rx="1.5" fill="#15171a"/>
      <path d="M168 28 l28 0 l-5 -10 l-18 0 Z" fill="#15171a"/>
      <rect x="82" y="30" width="22" height="42" rx="1.5" fill="#6d4426"/>
      <rect x="86" y="36" width="12" height="12" rx="1" fill="#e6d1a6"/>
      <ellipse cx="120" cy="45" rx="7" ry="5" fill="${c.c2}"/>
      <rect x="82" y="72" width="108" height="4" fill="#15171a"/>
      ${wheel(26, 84, 7)}${wheel(58, 84, 7)}${wheel(104, 80, 11, '#8a5a33', true)}${wheel(128, 80, 11, '#8a5a33', true)}${wheel(176, 84, 8, '#8a5a33', true)}
      <g class="puffs"><circle class="puff p1" cx="190" cy="14" r="5"/><circle class="puff p2" cx="190" cy="14" r="5"/><circle class="puff p3" cx="190" cy="14" r="5"/></g>`;
  },

  stream05(c) {
    return `
      <rect x="6" y="52" width="60" height="30" rx="3" fill="${c.c2}"/>
      <path d="M8 52 L20 42 L54 42 L66 52 Z" fill="#101113"/>
      <path d="M66 36 L106 36 L106 82 L66 82 Z" fill="${c.c}"/>
      <rect x="76" y="42" width="16" height="12" rx="2" fill="#27323d"/>
      <path d="M104 40 L196 40 Q226 40 232 72 L232 82 L104 82 Z" fill="${c.c}"/>
      <path d="M104 74 L232 74 L232 82 L104 82 Z" fill="${c.c2}"/>
      <path d="M150 56 L226 56" stroke="#ffffff55" stroke-width="2.4"/>
      <circle cx="224" cy="62" r="3.6" fill="#ffe9a3"/>
      <path d="M232 76 L240 84 L232 86 Z" fill="${c.c2}"/>
      ${wheel(24, 86, 7)}${wheel(46, 86, 7)}
      ${wheel(100, 82, 13, '#9097a0', true)}${wheel(128, 82, 13, '#9097a0', true)}${wheel(156, 82, 13, '#9097a0', true)}${wheel(210, 88, 6)}
      <g class="puffs"><circle class="puff p1" cx="196" cy="34" r="5"/><circle class="puff p2" cx="196" cy="34" r="5"/><circle class="puff p3" cx="196" cy="34" r="5"/></g>`;
  },

  diesel(c) {
    return `
      <rect x="14" y="36" width="212" height="50" rx="7" fill="${c.c}"/>
      <rect x="14" y="62" width="212" height="9" fill="${c.c2}"/>
      <rect x="14" y="36" width="44" height="26" rx="5" fill="${c.c2}"/>
      <rect x="182" y="36" width="44" height="26" rx="5" fill="${c.c2}"/>
      <rect x="20" y="40" width="30" height="16" rx="2" fill="#27323d"/>
      <rect x="190" y="40" width="30" height="16" rx="2" fill="#27323d"/>
      <rect x="66" y="40" width="108" height="18" fill="${c.c}"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${72 + i * 11}" y="44" width="6" height="12" rx="1" fill="#1b1d21"/>`).join('')}
      <circle cx="223" cy="76" r="3" fill="#ffe9a3"/><circle cx="17" cy="76" r="3" fill="#ffd0c8"/>
      ${bogie(54, 92)}${bogie(186, 92)}`;
  },

  dieselBig(c) {
    return `
      <rect x="10" y="30" width="220" height="56" rx="6" fill="${c.c}"/>
      <rect x="10" y="64" width="220" height="8" fill="${c.c2}"/>
      <rect x="10" y="30" width="48" height="34" rx="5" fill="${c.c}"/>
      <rect x="186" y="30" width="44" height="34" rx="5" fill="${c.c}"/>
      <rect x="198" y="36" width="28" height="18" rx="2" fill="#27323d"/>
      <rect x="14" y="36" width="28" height="18" rx="2" fill="#27323d"/>
      ${Array.from({ length: 10 }, (_, i) => `<rect x="${66 + i * 11}" y="38" width="6" height="22" rx="1" fill="#1b1d21"/>`).join('')}
      <circle cx="227" cy="76" r="3" fill="#ffe9a3"/>
      ${bogie(50, 92)}${bogie(190, 92)}${bogie(120, 92)}`;
  },

  dieselSmall(c) {
    return `
      <rect x="40" y="40" width="160" height="46" rx="6" fill="${c.c}"/>
      <rect x="40" y="64" width="160" height="8" fill="${c.c2}"/>
      <rect x="40" y="26" width="64" height="34" rx="4" fill="${c.c}"/>
      <rect x="48" y="32" width="48" height="20" rx="2" fill="#27323d"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${120 + i * 12}" y="46" width="6" height="14" rx="1" fill="#1b1d21"/>`).join('')}
      <rect x="196" y="76" width="8" height="10" fill="#2a2c30"/><rect x="36" y="76" width="8" height="10" fill="#2a2c30"/>
      <circle cx="199" cy="58" r="3" fill="#ffe9a3"/>
      ${wheel(70, 84, 10)}${wheel(104, 84, 10)}${wheel(150, 84, 10)}${wheel(184, 84, 10)}`;
  },

  koef(c) {
    return `
      <rect x="62" y="48" width="120" height="38" rx="5" fill="${c.c}"/>
      <rect x="62" y="30" width="62" height="24" rx="4" fill="${c.c}"/>
      <rect x="68" y="35" width="50" height="14" rx="2" fill="#27323d"/>
      <rect x="130" y="40" width="42" height="12" rx="3" fill="${c.c}"/>
      <rect x="158" y="34" width="6" height="12" fill="#15171a"/>
      <rect x="62" y="68" width="120" height="5" fill="${c.c2}"/>
      <rect x="54" y="78" width="8" height="10" fill="#2a2c30"/><rect x="182" y="78" width="8" height="10" fill="#2a2c30"/>
      <circle cx="178" cy="60" r="3" fill="#ffe9a3"/>
      ${wheel(86, 86, 9)}${wheel(158, 86, 9)}
      <line x1="86" y1="86" x2="158" y2="86" stroke="#c9ced4" stroke-width="2"/>`;
  },

  railbus(c) {
    return `
      <rect x="22" y="38" width="196" height="48" rx="12" fill="${c.c}"/>
      <rect x="22" y="66" width="196" height="8" fill="${c.c2}"/>
      ${windowsRow(34, 190, 46, 16, 7)}
      <rect x="194" y="44" width="20" height="20" rx="4" fill="#27323d"/>
      <circle cx="214" cy="74" r="3" fill="#ffe9a3"/>
      <rect x="36" y="82" width="10" height="3" fill="#15171a"/>
      ${wheel(70, 87, 9)}${wheel(172, 87, 9)}`;
  },

  flhamb(c) {
    return `
      <path d="M14 78 Q14 40 50 38 L196 38 Q232 42 234 74 L234 86 L14 86 Z" fill="${c.c}"/>
      <path d="M14 70 L234 70 L234 78 L14 78 Z" fill="${c.c2}"/>
      ${windowsRow(46, 170, 46, 14, 8, '#27323d')}
      <path d="M176 46 Q212 46 222 62 L176 62 Z" fill="#27323d"/>
      <circle cx="230" cy="74" r="3" fill="#ffe9a3"/>
      ${wheel(54, 87, 8)}${wheel(182, 87, 8)}`;
  },

  tee(c) {
    return `
      <path d="M12 82 L12 42 Q12 36 20 36 L196 36 Q226 40 234 70 L234 86 L12 86 Z" fill="${c.c}"/>
      <rect x="12" y="62" width="222" height="9" fill="${c.c2}"/>
      ${windowsRow(26, 150, 42, 15, 7, '#27323d')}
      <path d="M170 42 Q206 42 220 60 L170 60 Z" fill="#27323d"/>
      <circle cx="231" cy="76" r="3" fill="#ffe9a3"/>
      ${bogie(54, 92)}${bogie(190, 92)}`;
  },

  electric(c) {
    return `
      <path d="M12 86 L12 44 L28 32 L212 32 L228 44 L228 86 Z" fill="${c.c}"/>
      <rect x="12" y="62" width="216" height="9" fill="${c.c2}"/>
      <path d="M18 44 L30 36 L50 36 L50 54 L18 54 Z" fill="#27323d"/>
      <path d="M222 44 L210 36 L190 36 L190 54 L222 54 Z" fill="#27323d"/>
      ${Array.from({ length: 8 }, (_, i) => `<rect x="${64 + i * 14}" y="40" width="8" height="14" rx="1" fill="#00000033"/>`).join('')}
      <circle cx="224" cy="76" r="3" fill="#ffe9a3"/>
      ${pantograph(78, 32)}${pantograph(146, 32)}
      ${bogie(54, 92)}${bogie(186, 92)}`;
  },

  electricRound(c) {
    return `
      <path d="M12 86 L12 50 Q14 34 40 32 L200 32 Q230 36 232 60 L232 86 Z" fill="${c.c}"/>
      <rect x="12" y="62" width="220" height="9" fill="${c.c2}"/>
      <path d="M20 50 Q24 38 42 38 L52 38 L52 54 L20 54 Z" fill="#27323d"/>
      <path d="M224 50 Q220 38 202 38 L190 38 L190 54 L224 54 Z" fill="#27323d"/>
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${66 + i * 15}" y="40" width="9" height="14" rx="1" fill="#00000033"/>`).join('')}
      <circle cx="228" cy="76" r="3" fill="#ffe9a3"/>
      ${pantograph(82, 32)}${pantograph(142, 32)}
      ${bogie(54, 92)}${bogie(190, 92)}`;
  },

  emu(c) {
    const car = (x0, x1, nose) => `
      <path d="M${x0} 86 L${x0} 42 Q${x0} 36 ${x0 + 8} 36 L${x1 - (nose ? 18 : 6)} 36 ${nose ? `Q${x1} 38 ${x1} 56 L${x1} 86 Z` : `L${x1} 36 L${x1} 86 Z`}" fill="${c.c}"/>
      <rect x="${x0}" y="64" width="${x1 - x0}" height="8" fill="${c.c2}"/>
      ${windowsRow(x0 + 8, x1 - (nose ? 30 : 10), 42, 16, 4)}
      ${nose ? `<path d="M${x1 - 28} 42 L${x1 - 10} 42 Q${x1 - 3} 44 ${x1 - 2} 56 L${x1 - 28} 56 Z" fill="#27323d"/>` : ''}`;
    return `${car(8, 118, false)}${car(121, 234, true)}
      <circle cx="231" cy="76" r="3" fill="#ffe9a3"/>
      ${pantograph(56, 36)}
      ${bogie(32, 92)}${bogie(96, 92)}${bogie(146, 92)}${bogie(208, 92)}`;
  },

  ice(c) {
    return `
      <path d="M4 86 L4 46 Q4 36 14 36 L150 36 Q200 36 226 62 Q238 72 238 86 Z" fill="${c.c}"/>
      <path d="M4 66 L238 66 L238 74 L4 74 Z" fill="${c.c2}"/>
      ${windowsRow(14, 140, 42, 15, 8, '#27323d')}
      <path d="M156 42 Q196 42 218 62 L156 62 Z" fill="#27323d"/>
      <circle cx="233" cy="76" r="3" fill="#ffe9a3"/>
      <rect x="4" y="80" width="234" height="3" fill="#0000001f"/>
      ${pantograph(90, 36)}
      ${bogie(40, 92)}${bogie(110, 92)}${bogie(200, 92)}`;
  },

  ice3(c) {
    return `
      <path d="M4 86 L4 46 Q4 36 14 36 L130 36 Q196 34 232 66 Q240 74 240 86 Z" fill="${c.c}"/>
      <path d="M4 66 L240 66 L240 74 L4 74 Z" fill="${c.c2}"/>
      ${windowsRow(14, 118, 42, 15, 7, '#27323d')}
      <path d="M134 42 Q192 40 222 62 L134 62 Z" fill="#27323d"/>
      <circle cx="236" cy="77" r="3" fill="#ffe9a3"/>
      <rect x="4" y="80" width="236" height="3" fill="#0000001f"/>
      ${pantograph(70, 36)}
      ${bogie(40, 92)}${bogie(106, 92)}${bogie(190, 92)}`;
  },

  maglev(c) {
    return `
      <path d="M8 76 L8 56 Q8 46 22 44 L170 44 Q218 46 236 66 L236 76 Z" fill="${c.c}"/>
      <path d="M8 64 L236 64 L236 70 L8 70 Z" fill="${c.c2}"/>
      ${windowsRow(22, 150, 50, 11, 8, '#27323d')}
      <path d="M164 50 Q204 52 226 64 L164 64 Z" fill="#27323d"/>
      <rect x="20" y="76" width="210" height="6" rx="2" fill="#2a4a70"/>
      <rect x="0" y="84" width="240" height="14" fill="#8b9199"/>
      <rect x="0" y="84" width="240" height="3" fill="#aab0b8"/>
      <circle cx="232" cy="60" r="3" fill="#bff"/>`;
  }
};

const NO_RAILS = { maglev: true };

function trainSVG(card, opts) {
  opts = opts || {};
  const draw = ART[card.k] || ART.diesel;
  let rails = '';
  if (!NO_RAILS[card.k] && !opts.noRails) {
    rails = '<rect x="0" y="93" width="240" height="3" fill="#6f757d"/><rect x="0" y="96" width="240" height="2" fill="#2c2f34"/>';
    for (let x = -6; x < 250; x += 16) rails += `<rect x="${x}" y="98" width="9" height="3" fill="#3b3128"/>`;
  }
  const dir = opts.flip ? ' style="transform:scaleX(-1)"' : '';
  const vb = opts.tight ? '0 12 240 82' : '0 12 240 92';
  return `<svg class="trainsvg" viewBox="${vb}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"${dir}>${rails}${draw(card)}</svg>`;
}

const TYPE_ICON = {
  dampf:   '<path d="M7 17a4 4 0 0 1 1-7.8A5 5 0 0 1 17.5 8 3.5 3.5 0 0 1 17 17Z" fill="currentColor"/>',
  diesel:  '<path d="M12 3c3 4.5 6 7.2 6 10.5a6 6 0 0 1-12 0C6 10.200 9 7.500 12 3Z" fill="currentColor"/>',
  elektro: '<path d="M13.500 2 5 13.500h6L10 22l9-12h-6Z" fill="currentColor"/>',
  ice:     '<path d="M3 6l7 6-7 6V6Zm9 0 7 6-7 6V6Z" fill="currentColor"/>'
};

function typeIcon(ty) {
  return `<svg class="tyicon" viewBox="0 0 24 24" aria-hidden="true">${TYPE_ICON[ty]}</svg>`;
}
