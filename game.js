'use strict';

/* ================= Spielstand ================= */

const SAVE_KEY = 'gleiskampf-spielstand-v1';

function freshState() {
  return { coins: 0, own: {}, done: {}, team: [], decks: [], active: 0, muted: false, intro: false };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const st = Object.assign(freshState(), JSON.parse(raw));
      if (!Array.isArray(st.decks)) st.decks = [];
      // Alter Spielstand: das letzte Team wird zum ersten Deck
      if (!st.decks.length && Array.isArray(st.team) && st.team.length >= 3) {
        st.decks.push({ name: 'Deck 1', ids: st.team.slice() });
      }
      return st;
    }
  } catch (e) { /* ohne Speicher weiterspielen */ }
  return freshState();
}

let S = loadState();

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignorieren */ }
}

/* ================= Hilfsfunktionen ================= */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pad = n => String(n).padStart(2, '0');

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

const lvlMult = l => 1 + 0.12 * (l - 1);
const level = id => Math.min(5, S.own[id] || 0);

function stats(card, lvl, extra) {
  const m = lvlMult(lvl) * (extra || 1);
  return { hp: Math.round(card.hp * m), at: Math.round(card.at * m) };
}

function effectiveness(attTy, defTy) {
  if (TYPES[attTy].beats === defTy) return 1.5;
  if (TYPES[defTy].beats === attTy) return 0.67;
  return 1;
}

/* ================= Karten ================= */

function cardHTML(c, o) {
  o = o || {};
  const lvl = o.lvl || 1;
  const st = stats(c, lvl);
  const ty = TYPES[c.ty];
  const a2 = Math.round(st.at * 1.7);
  return `<div class="card r${c.r} t-${c.ty}${o.mini ? ' mini' : ''}${o.cls ? ' ' + o.cls : ''}" data-id="${c.id}">
    <div class="c-head"><span class="c-name">${c.nm}</span><span class="c-ty">${typeIcon(c.ty)}</span></div>
    <div class="c-art">${trainSVG(c)}<span class="c-rar">${RARITY[c.r].name}</span>${lvl > 1 ? `<span class="c-lv">Stufe ${lvl}</span>` : ''}</div>
    <div class="c-stats"><div><b>${st.hp}</b><small>LP</small></div><div><b>${st.at}</b><small>Angriff</small></div><div><b>${c.v}</b><small>km/h</small></div></div>
    <div class="c-atks"><div><span>${ty.atk[0]}</span><b>${st.at}</b></div><div><span>${c.sp || ty.atk[1]}</span><b>${a2}</b></div></div>
    <div class="c-fact">${c.t}</div>
    <div class="c-foot"><span>Nr. ${pad(c.id)}/${CARDS.length}</span><span>${ty.name} · ${c.y}</span></div>
  </div>`;
}

function cardBackHTML(cls) {
  return `<div class="card back${cls ? ' ' + cls : ''}"><div class="back-inner"><div class="back-logo">G</div><div class="back-text">GLEISKAMPF</div></div></div>`;
}

function lockedHTML(c) {
  return `<div class="card locked mini t-${c.ty}" data-id="${c.id}">
    <div class="c-head"><span class="c-name">Nr. ${pad(c.id)}</span></div>
    <div class="c-art">${trainSVG(c)}</div>
    <div class="c-foot"><span>Noch nicht gefunden</span></div></div>`;
}

/* ================= Oberfläche ================= */

const screenEl = $('#screen');
const modalRoot = $('#modal-root');
let backAction = null;
let currentScreen = 'home';

function setTop(back) {
  backAction = back || null;
  $('#btn-back').hidden = !back;
  $('#coins-n').textContent = S.coins;
}

function updateCoins() { $('#coins-n').textContent = S.coins; }

const NAV_OF = { map: 'map', team: 'map', battle: null, decks: 'decks', deckedit: 'decks', album: 'album', shop: 'shop' };
const NAV_GO = { map: () => screenMap(), decks: () => screenDecks(), album: () => screenAlbum(), shop: () => screenShop() };

function updateNav(name) {
  document.body.classList.toggle('in-battle', name === 'battle');
  const active = NAV_OF[name];
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === active));
}

function show(name, build) {
  stopBridge();
  currentScreen = name;
  screenEl.className = 'screen s-' + name;
  updateNav(name);
  screenEl.innerHTML = '';
  screenEl.scrollTop = 0;
  build(screenEl);
}

function openModal(html, cls) {
  const m = h(`<div class="modal ${cls || ''}"><div class="modal-box">${html}</div></div>`);
  modalRoot.appendChild(m);
  return m;
}

function closeModal(m) { if (m && m.parentNode) m.parentNode.removeChild(m); }

function toast(text) {
  const t = h(`<div class="toast">${text}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2300);
}

/* ================= Startseite ================= */

function clockText(plus) {
  const d = new Date(Date.now() + plus * 60000);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function bestCards(n) {
  const ids = Object.keys(S.own).map(Number);
  ids.sort((a, b) => {
    const A = CARD_BY_ID[a], B = CARD_BY_ID[b];
    return (B.r - A.r) || (level(b) - level(a)) || (B.at - A.at);
  });
  return ids.slice(0, n).map(id => CARD_BY_ID[id]);
}

function ownedCount() { return Object.keys(S.own).length; }

/* ================= Startseite: Blick von der Brücke ================= */

function ownedCards() {
  return Object.keys(S.own).map(id => CARD_BY_ID[id]).filter(Boolean);
}

function greeting() {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 11) return 'Guten Morgen';
  if (hr >= 11 && hr < 17) return 'Guten Tag';
  return 'Guten Abend';
}

let bridgeScene = null;

function stopBridge() {
  if (bridgeScene) { bridgeScene.stop(); bridgeScene = null; }
}

function screenHome() {
  ensureDecks();
  setTop(null);
  show('home', root => {
    const nextStage = STATIONS.find(st => !S.done[st.n]);
    const hasCards = ownedCount() > 0;
    const lead = !hasCards ? 'Öffne dein erstes Kartenpack, dann geht es los.'
      : nextStage ? `Nächster Halt: ${nextStage.name}` : 'Du hast alle Bahnhöfe erobert. Fahr sie gern noch einmal.';
    root.innerHTML = `
      <div class="hero">
        <canvas id="bridge" aria-label="Blick von einer Brücke auf eine zweigleisige Strecke"></canvas>
        <div class="hero-card">
          <small class="hello">${greeting()}</small>
          <h1>Willkommen, Lokführer!</h1>
          <p>${lead}</p>
          <button class="btn primary" id="hero-go">${!hasCards ? 'Zu den Packs' : nextStage ? 'Weiterfahren' : 'Strecke ansehen'}</button>
          <div class="hero-chips"><span>Album ${ownedCount()}/${CARDS.length}</span><span>${deckSummary()}</span></div>
        </div>
        <div class="hero-foot"><span>Tippe aufs Bild, um einen Zug zu rufen.</span><button class="link" id="reset">Spiel zurücksetzen</button></div>
      </div>`;
    $('#hero-go', root).onclick = () => { Sound.click(); (hasCards ? screenMap : screenShop)(); };
    $('#reset', root).onclick = confirmReset;
    const canvas = $('#bridge', root);
    bridgeScene = Bridge.start(canvas, { cards: ownedCards() });
    canvas.addEventListener('click', () => { Sound.hornShort(); bridgeScene && bridgeScene.callTrain(); });
  });
}

function confirmReset() {
  const m = openModal(`<h2>Spiel zurücksetzen?</h2><p>Dein Album, deine Münzen und dein Fortschritt werden gelöscht. Das lässt sich nicht rückgängig machen.</p>
    <div class="btns"><button class="btn ghost" id="m-no">Abbrechen</button><button class="btn danger" id="m-yes">Alles löschen</button></div>`);
  $('#m-no', m).onclick = () => closeModal(m);
  $('#m-yes', m).onclick = () => {
    S = freshState();
    save();
    closeModal(m);
    startFirstRun();
  };
}

/* ================= Erster Start ================= */

function startFirstRun() {
  S.coins = 150;
  setTop(null);
  updateCoins();
  screenHome();
  const m = openModal(`
    <div class="sign">GLEISKAMPF</div>
    <h2>Willkommen, Lokführer!</h2>
    <ul class="steps">
      <li><span><b>Sammeln.</b> Öffne Kartenpacks und finde alle ${CARDS.length} Züge für dein Album.</span></li>
      <li><span><b>Kämpfen.</b> Stell ein Team aus 3 Zügen zusammen und fahre gegen Bahnhofs-Chefs von Dorf bis Berlin.</span></li>
      <li><span><b>Verbessern.</b> Doppelte Karten machen einen Zug stärker, bis Stufe 5.</span></li>
    </ul>
    <p class="dim">Dein Startpaket mit 5 Zügen liegt schon bereit.</p>
    <div class="btns"><button class="btn primary" id="m-go">Startpaket öffnen</button></div>`);
  $('#m-go', m).onclick = () => {
    Sound.resume();
    Sound.horn();
    S.intro = true;
    save();
    closeModal(m);
    openPack({ name: 'Startpaket', n: 5, w: [75, 25, 0, 0], guar: 0, unique: true }, { free: true });
  };
}

/* ================= Strecke (Bahnhöfe) ================= */

const STATIONS = [
  { n: 1,  name: 'Haltepunkt Niederwiese', boss: 'Weichenwärter Bernd',   types: ['dampf'],           reward: 100, bio: 'Ein ruhiger Dorfbahnhof. Hier beginnt jede Karriere.' },
  { n: 2,  name: 'Bahnhof Altenbach',      boss: 'Fahrdienstleiterin Marta', types: ['dampf', 'diesel'], reward: 110, bio: 'Qualm und Dieselgeruch hängen über den Gleisen.' },
  { n: 3,  name: 'Hannover Hbf',           boss: 'Rangiermeister Kowalski', types: ['diesel'],        reward: 125, ace: 15, bio: 'Im Rangierbahnhof zählt jede Weiche.' },
  { n: 4,  name: 'Fulda',                  boss: 'Schaffnerin Inge',      types: ['elektro'],         reward: 140, bio: 'Hier kreuzen sich viele Fernverkehrslinien.' },
  { n: 5,  name: 'Kassel-Wilhelmshöhe',    boss: 'Oberlokführer Henk',    types: ['elektro', 'ice'],  reward: 155, bio: 'Schnelle Züge, kurze Halte.' },
  { n: 6,  name: 'Nürnberg Hbf',           boss: 'Museumsdirektor Adler', types: ['dampf'],           reward: 175, ace: 1, bio: 'Die Wiege der deutschen Eisenbahn.' },
  { n: 7,  name: 'Frankfurt Hbf',          boss: 'Stellwerker Yilmaz',    types: ['elektro', 'diesel'], reward: 195, bio: 'Einer der größten Bahnhöfe des Landes.' },
  { n: 8,  name: 'München Hbf',            boss: 'Bahnhofsvorsteher Sepp', types: ['elektro', 'dampf'], reward: 220, ace: 19, bio: 'Kopfbahnhof am Rand der Alpen.' },
  { n: 9,  name: 'Hamburg Hbf',            boss: 'Käpt\'n Jan von der Hafenbahn', types: ['diesel', 'ice'], reward: 250, ace: 32, bio: 'Hier endet der Zug, und der Hafen beginnt.' },
  { n: 10, name: 'Berlin Hbf',             boss: 'Bahnchefin Dr. Reuter', types: ['ice', 'elektro', 'dampf', 'diesel'], reward: 400, ace: 34, bio: 'Die letzte Station. Wer hier gewinnt, ist Meister der Schiene.' }
];

function stationState(st) {
  if (S.done[st.n]) return 'done';
  if (st.n === 1 || S.done[st.n - 1]) return 'open';
  return 'locked';
}

function screenMap() {
  setTop(screenHome);
  show('map', root => {
    root.innerHTML = `<div class="pagehead"><h1>Strecke</h1><p class="dim">Gewinne in jedem Bahnhof, um den nächsten freizuschalten.</p></div><ol class="route">
      ${STATIONS.map(st => {
        const state = stationState(st);
        return `<li class="stop ${state}" data-n="${st.n}">
          <span class="node">${state === 'done' ? '✓' : st.n}</span>
          <button class="stop-card" ${state === 'locked' ? 'disabled' : ''}>
            <span class="stop-name">${st.name}</span>
            <span class="stop-boss">${st.boss}</span>
            <span class="stop-meta">${st.types.map(t => `<span class="tychip t-${t}">${typeIcon(t)}${TYPES[t].name}</span>`).join('')}<span class="reward">+${state === 'done' ? Math.round(st.reward / 3) : st.reward} Münzen</span></span>
          </button></li>`;
      }).join('')}</ol>`;
    $$('.stop-card:not([disabled])', root).forEach(b => b.addEventListener('click', () => {
      Sound.click();
      screenTeam(STATIONS[+b.closest('.stop').dataset.n - 1]);
    }));
    const open = $('.stop.open', root);
    if (open) open.scrollIntoView({ block: 'center' });
  });
}

/* ================= Team wählen ================= */

function screenTeam(st) {
  ensureDecks();
  setTop(screenMap);
  const head = `
    <div class="pagehead"><h1>${st.name}</h1><p class="dim">Gegner: ${st.boss}</p>
      <div class="tyrow">${st.types.map(t => `<span class="tychip t-${t}">${typeIcon(t)}${TYPES[t].name}</span>`).join('')}</div></div>`;
  const valid = S.decks.map((d, i) => ({ d, i })).filter(o => o.d.ids.length >= 3);

  show('team', root => {
    if (!valid.length) {
      root.innerHTML = head + `<div class="empty-note"><h2>Du brauchst ein Deck</h2><p>Ein Deck braucht mindestens 3 Züge. Bau eins oder öffne erst Kartenpacks.</p>
        <div class="btns center-btns"><button class="btn primary" id="to-decks">Deck bauen</button></div></div>`;
      $('#to-decks', root).onclick = () => screenDecks();
      return;
    }
    let cur = valid.find(o => o.i === S.active) || valid[0];

    function build() {
      const d = cur.d;
      root.innerHTML = head + `
        <div class="hint">Dampf schlägt Diesel, Diesel schlägt Elektro, Elektro schlägt Hochgeschwindigkeit, Hochgeschwindigkeit schlägt Dampf.</div>
        <div class="filters deckchips">${valid.map(o => `<button class="chip${o.i === cur.i ? ' on' : ''}" data-i="${o.i}">${esc(o.d.name)}</button>`).join('')}<button class="link" id="edit-deck">Deck bearbeiten</button></div>
        <p class="dim">Diese Züge fahren für dich:</p>
        <div class="team-cards">${d.ids.map(id => `<div class="team-card">${cardHTML(CARD_BY_ID[id], { lvl: level(id), mini: true })}</div>`).join('')}</div>
        <div class="btnrow"><button class="btn primary big" id="go">Abfahrt!</button></div>`;
      $$('.deckchips .chip', root).forEach(b => b.onclick = () => {
        cur = valid.find(o => o.i === +b.dataset.i);
        S.active = cur.i;
        save();
        Sound.click();
        build();
      });
      $('#edit-deck', root).onclick = () => screenDeckEdit(cur.i);
      $('#go', root).onclick = () => {
        Sound.horn();
        startBattle(st, cur.d.ids.slice(0, 3));
      };
    }

    build();
  });
}

/* ================= Kampf ================= */

let B = null;

function makeInst(card, lvl, extra) {
  const s = stats(card, lvl, extra);
  return { c: card, lvl, hp: s.hp, max: s.hp, at: s.at, sp: 2 };
}

function buildEnemy(st) {
  const s = st.n;
  const lvl = Math.min(5, Math.ceil(s / 2));
  const extra = s <= 2 ? 0.9 : 1;
  const wts = s <= 2 ? [8, 2, 0, 0] : s <= 4 ? [5, 4, 1, 0] : s <= 6 ? [2, 5, 3, 0.3] : s <= 8 ? [1, 4, 4, 1] : s === 9 ? [0, 3, 5, 2] : [0, 2, 5, 3];
  const chosen = [];
  const ace = st.ace ? CARD_BY_ID[st.ace] : null;
  const count = ace ? 2 : 3;
  for (let i = 0; i < count; i++) {
    const pool = CARDS.filter(c => !chosen.includes(c) && c !== ace);
    const w = pool.map(c => wts[c.r] * (st.types.includes(c.ty) ? 3 : 1));
    chosen.push(weighted(pool, w));
  }
  if (ace) chosen.push(ace);
  return chosen.map(c => makeInst(c, lvl, extra));
}

function startBattle(st, teamIds) {
  B = {
    id: Date.now(),
    st,
    p: teamIds.map(id => makeInst(CARD_BY_ID[id], level(id))),
    e: buildEnemy(st),
    pi: 0, ei: 0,
    busy: true,
    over: false
  };
  setTop(confirmLeave);
  show('battle', root => {
    root.innerHTML = `
      <div class="battle">
        <div class="arena">
          <div class="station-sign"><span>${st.name}</span></div>
          ${fighterHTML('e')}
          ${fighterHTML('p')}
        </div>
        <div class="b-log" id="log" aria-live="polite"></div>
        <div class="b-actions" id="actions">
          <button class="act a1" id="a1"></button>
          <button class="act a2" id="a2"></button>
          <button class="act sw" id="asw"><b>Wechseln</b><small>Anderen Zug schicken</small></button>
        </div>
      </div>`;
    $('#a1', root).onclick = () => playerAct('atk1');
    $('#a2', root).onclick = () => playerAct('atk2');
    $('#asw', root).onclick = () => openSwap(false);
    refreshBattle();
    const bid = B.id;
    playBattleIntro().then(() => { if (B && B.id === bid) intro(); });
  });
}

/* ----- Kampfstart: Blitz, Balken, Gegenüberstellung, VS ----- */

function typeChipsFor(team) {
  const seen = [];
  team.forEach(t => { if (!seen.includes(t.c.ty)) seen.push(t.c.ty); });
  return seen.map(t => `<span class="tychip t-${t}">${typeIcon(t)}${TYPES[t].name}</span>`).join('');
}

function playBattleIntro() {
  return new Promise(resolve => {
    const st = B.st;
    const p0 = B.p[0], e0 = B.e[0];
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bars = Array.from({ length: 8 }, (_, n) => `<i style="--n:${n}"></i>`).join('');
    const el = h(`<div class="bt-intro" role="presentation">
      <div class="bt-vs">
        <div class="bt-lines"></div>
        <div class="bt-seam"></div>
        <div class="bt-banner"><small>Bahnhof</small><b>${st.name}</b></div>
        <div class="bt-side p">
          <div class="bt-train">${trainSVG(p0.c)}</div>
          <div class="bt-plate"><small>Du</small><b>${esc(p0.c.nm)}</b><span class="tyrow">${typeChipsFor(B.p)}</span></div>
        </div>
        <div class="bt-side e">
          <div class="bt-train">${trainSVG(e0.c, { flip: true })}</div>
          <div class="bt-plate"><small>Gegner</small><b>${esc(st.boss)}</b><span class="tyrow">${typeChipsFor(B.e)}</span></div>
        </div>
        <div class="bt-center"><span>VS</span></div>
        <p class="bt-skip">Antippen zum Überspringen</p>
      </div>
      <div class="bt-bars">${bars}</div>
      <div class="bt-flash"></div>
    </div>`);
    document.body.appendChild(el);

    let finished = false;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 500);
    }
    el.addEventListener('pointerdown', () => { if (el.classList.contains('vs')) finish(); });

    if (calm) {
      el.classList.add('vs', 'open', 'slam', 'calm');
      at(1500, finish);
      return;
    }
    Sound.riser();
    el.classList.add('flash');
    at(700, () => el.classList.add('bars'));
    at(1350, () => el.classList.add('vs'));
    at(1400, () => { el.classList.add('open'); Sound.swap(); });
    at(2100, () => { el.classList.add('slam'); Sound.boom(); Sound.hornShort(); });
    at(3900, finish);
  });
}

function fighterHTML(side) {
  return `<div class="fighter ${side}" id="f${side}">
    <div class="f-info">
      <div class="f-name"><b class="nm"></b><span class="lv"></span></div>
      <div class="f-ty"></div>
      <div class="hpbar"><i></i></div>
      <div class="hptext"></div>
      <div class="pips"></div>
    </div>
    <div class="f-train"><div class="f-sprite"></div><div class="pop"></div></div>
  </div>`;
}

const activeOf = side => side === 'p' ? B.p[B.pi] : B.e[B.ei];
const otherSide = side => side === 'p' ? 'e' : 'p';

function refreshFighter(side) {
  const f = $('#f' + side);
  if (!f) return;
  const a = activeOf(side);
  const pct = Math.max(0, a.hp / a.max * 100);
  $('.nm', f).textContent = a.c.nm;
  $('.lv', f).textContent = 'Stufe ' + a.lvl;
  $('.f-ty', f).innerHTML = `<span class="tychip t-${a.c.ty}">${typeIcon(a.c.ty)}${TYPES[a.c.ty].name}</span>`;
  const bar = $('.hpbar i', f);
  bar.style.width = pct + '%';
  bar.className = pct > 50 ? 'ok' : pct > 25 ? 'mid' : 'low';
  $('.hptext', f).textContent = Math.max(0, a.hp) + ' / ' + a.max + ' LP';
  const team = side === 'p' ? B.p : B.e;
  $('.pips', f).innerHTML = team.map((t, i) => `<i class="${t.hp <= 0 ? 'ko' : ''}${(side === 'p' ? B.pi : B.ei) === i ? ' cur' : ''}"></i>`).join('');
}

function refreshSprite(side) {
  const f = $('#f' + side);
  const a = activeOf(side);
  $('.f-sprite', f).innerHTML = trainSVG(a.c, { flip: side === 'e' });
  f.classList.remove('ko');
}

function refreshBattle() {
  refreshSprite('p'); refreshSprite('e');
  refreshFighter('p'); refreshFighter('e');
  refreshActions();
}

function refreshActions() {
  if (!B) return;
  const a = activeOf('p');
  const ty = TYPES[a.c.ty];
  const a1 = $('#a1'), a2 = $('#a2');
  if (!a1) return;
  a1.innerHTML = `<b>${ty.atk[0]}</b><small>Stärke ${a.at}</small>`;
  a2.innerHTML = `<b>${a.c.sp || ty.atk[1]}</b><small>Stärke ${Math.round(a.at * 1.7)} · noch ${a.sp}×</small>`;
  const off = B.busy || B.over;
  a1.disabled = off;
  a2.disabled = off || a.sp <= 0;
  $('#asw').disabled = off || B.p.filter(t => t.hp > 0).length < 2;
}

async function say(text, ms) {
  const l = $('#log');
  if (l) l.textContent = text;
  await sleep(ms || 750);
}

async function intro() {
  const id = B.id;
  await say(`${B.st.boss} fordert dich heraus!`, 1100);
  if (!B || B.id !== id) return;
  Sound.hornShort();
  await say(`${activeOf('e').c.nm} fährt ein.`, 800);
  if (!B || B.id !== id) return;
  await say('Du bist dran. Wähle einen Angriff.', 200);
  B.busy = false;
  refreshActions();
}

function pop(side, text, cls) {
  const p = $('#f' + side + ' .pop');
  if (!p) return;
  p.textContent = text;
  p.className = 'pop ' + (cls || '');
  void p.offsetWidth;
  p.classList.add('show');
}

function animate(side, cls, ms) {
  const f = $('#f' + side + ' .f-train');
  if (!f) return Promise.resolve();
  f.classList.remove(cls);
  void f.offsetWidth;
  f.classList.add(cls);
  return sleep(ms || 400);
}

function aiChoose() {
  const e = activeOf('e'), p = activeOf('p');
  const s = B.st.n;
  const eff = effectiveness(e.c.ty, p.c.ty);
  if (s >= 4 && Math.random() < 0.2 && eff < 1) {
    const better = B.e.map((t, i) => ({ t, i })).filter(o => o.t.hp > 0 && o.i !== B.ei && effectiveness(o.t.c.ty, p.c.ty) > 1);
    if (better.length) return { side: 'e', kind: 'swap', to: pick(better).i };
  }
  const chance = 0.25 + 0.03 * s + (eff > 1 ? 0.3 : 0);
  if (e.sp > 0 && Math.random() < chance) return { side: 'e', kind: 'atk2' };
  return { side: 'e', kind: 'atk1' };
}

async function playerAct(kind) {
  if (!B || B.busy || B.over) return;
  B.busy = true;
  refreshActions();
  const id = B.id;
  const pa = { side: 'p', kind };
  const ea = aiChoose();
  await resolveActions(pa, ea);
  if (!B || B.id !== id || B.over) return;
  await afterTurn();
}

async function afterTurn() {
  const id = B.id;
  if (activeOf('p').hp <= 0) {
    await say('Dein Zug ist ausgefallen. Schick den nächsten.', 700);
    if (!B || B.id !== id) return;
    openSwap(true);
    return;
  }
  await say('Dein Zug. Wähle einen Angriff.', 150);
  B.busy = false;
  refreshActions();
}

async function resolveActions(pa, ea) {
  const id = B.id;
  const alive = () => B && B.id === id && !B.over;
  // Wechsel passieren zuerst
  for (const a of [pa, ea]) {
    if (a.kind === 'swap' && alive()) await doSwap(a);
  }
  const atks = [pa, ea].filter(a => a.kind !== 'swap');
  atks.sort((a, b) => {
    const va = activeOf(a.side).c.v, vb = activeOf(b.side).c.v;
    return vb - va || (a.side === 'p' ? -1 : 1);
  });
  for (const a of atks) {
    if (!alive()) return;
    if (activeOf(a.side).hp <= 0) continue;
    await doAttack(a);
  }
}

async function doSwap(a) {
  const side = a.side;
  const team = side === 'p' ? B.p : B.e;
  const old = activeOf(side);
  if (side === 'p') B.pi = a.to; else B.ei = a.to;
  const now = activeOf(side);
  Sound.swap();
  await say(side === 'p' ? `${old.c.nm} fährt ab. ${now.c.nm} übernimmt!` : `${B.st.boss} wechselt zu ${now.c.nm}.`, 600);
  refreshSprite(side);
  refreshFighter(side);
  await animate(side, 'enter', 450);
  refreshActions();
}

function attackSound(ty, special) {
  if (ty === 'dampf') Sound.chug(special ? 7 : 4);
  else if (ty === 'diesel') { Sound.hornShort(); }
  else if (ty === 'elektro') Sound.zap();
  else Sound.whoosh();
}

async function doAttack(a) {
  const id = B.id;
  const att = activeOf(a.side);
  const defSide = otherSide(a.side);
  const def = activeOf(defSide);
  const special = a.kind === 'atk2';
  if (special) att.sp--;
  const ty = TYPES[att.c.ty];
  const name = special ? (att.c.sp || ty.atk[1]) : ty.atk[0];
  await say(`${att.c.nm} setzt ${name} ein!`, 500);
  if (!B || B.id !== id) return;
  attackSound(att.c.ty, special);
  await animate(a.side, 'lunge-' + a.side, 420);
  if (!B || B.id !== id) return;
  const eff = effectiveness(att.c.ty, def.c.ty);
  const dmg = Math.max(1, Math.round(att.at * (special ? 1.7 : 1) * eff * rnd(0.9, 1.1)));
  def.hp = Math.max(0, def.hp - dmg);
  if (special || eff > 1) Sound.heavyHit(); else Sound.hit();
  pop(defSide, '-' + dmg, eff > 1 ? 'big' : eff < 1 ? 'weak' : '');
  animate(defSide, 'shake', 450);
  refreshFighter(defSide);
  await sleep(500);
  if (eff > 1) await say('Sehr effektiv!', 650);
  else if (eff < 1) await say('Nicht sehr effektiv.', 650);
  if (!B || B.id !== id) return;
  if (def.hp <= 0) await faint(defSide);
  refreshActions();
}

async function faint(side) {
  const id = B.id;
  const t = activeOf(side);
  Sound.faint();
  $('#f' + side).classList.add('ko');
  await say(side === 'p' ? `${t.c.nm} ist ausgefallen!` : `${t.c.nm} von ${B.st.boss} fällt aus!`, 900);
  if (!B || B.id !== id) return;
  const team = side === 'p' ? B.p : B.e;
  const next = team.findIndex(x => x.hp > 0);
  if (next < 0) {
    endBattle(side === 'e');
    return;
  }
  if (side === 'e') {
    B.ei = next;
    await say(`${B.st.boss} schickt ${B.e[next].c.nm}.`, 700);
    if (!B || B.id !== id) return;
    refreshSprite('e');
    refreshFighter('e');
    await animate('e', 'enter', 450);
  }
}

function openSwap(forced) {
  if (!B || B.over) return;
  const m = openModal(`<h2>${forced ? 'Nächsten Zug schicken' : 'Zug wechseln'}</h2><p class="dim">${forced ? '' : 'Der Gegner greift danach an.'}</p>
    <div class="swap-list">${B.p.map((t, i) => `<button class="swap-item t-${t.c.ty}" data-i="${i}" ${t.hp <= 0 || i === B.pi ? 'disabled' : ''}>
      <span class="tychip t-${t.c.ty}">${typeIcon(t.c.ty)}</span>
      <span class="si-name"><b>${t.c.nm}</b><small>${t.hp <= 0 ? 'ausgefallen' : TYPES[t.c.ty].name + (i === B.pi ? ' · fährt gerade' : '')}</small></span>
      <span class="si-hp"><span class="hpbar"><i style="width:${t.hp / t.max * 100}%"></i></span><small>${t.hp}/${t.max}</small></span>
    </button>`).join('')}</div>
    ${forced ? '' : '<div class="btns"><button class="btn ghost" id="m-no">Abbrechen</button></div>'}`);
  if (!forced) $('#m-no', m).onclick = () => closeModal(m);
  $$('.swap-item', m).forEach(b => b.addEventListener('click', async () => {
    const to = +b.dataset.i;
    closeModal(m);
    if (forced) {
      const id = B.id;
      B.pi = to;
      Sound.swap();
      refreshSprite('p'); refreshFighter('p');
      await animate('p', 'enter', 450);
      if (!B || B.id !== id) return;
      B.busy = false;
      await say('Du bist dran. Wähle einen Angriff.', 150);
      refreshActions();
    } else {
      B.busy = true;
      refreshActions();
      const id = B.id;
      await resolveActions({ side: 'p', kind: 'swap', to }, aiChoose());
      if (!B || B.id !== id || B.over) return;
      await afterTurn();
    }
  }));
}

function confirmLeave() {
  if (!B || B.over) { screenMap(); return; }
  const m = openModal(`<h2>Kampf aufgeben?</h2><p>Du verlierst diesen Kampf und bekommst nichts.</p>
    <div class="btns"><button class="btn ghost" id="m-no">Weiterfahren</button><button class="btn danger" id="m-yes">Aufgeben</button></div>`);
  $('#m-no', m).onclick = () => closeModal(m);
  $('#m-yes', m).onclick = () => { closeModal(m); B = null; screenMap(); };
}

function endBattle(won) {
  B.over = true;
  const st = B.st;
  const first = !S.done[st.n];
  let reward;
  if (won) {
    reward = first ? st.reward : Math.round(st.reward / 3);
    S.done[st.n] = true;
    Sound.win();
  } else {
    reward = 15;
    Sound.lose();
  }
  S.coins += reward;
  save();
  updateCoins();
  const next = STATIONS[st.n];
  const m = openModal(`
    <div class="result ${won ? 'win' : 'lose'}">
      <div class="sign ${won ? '' : 'grey'}">${won ? 'Sieg' : 'Niederlage'}</div>
      <h2>${won ? (st.n === 10 ? 'Du bist Meister der Schiene!' : st.name + ' erobert!') : 'Alle Züge ausgefallen'}</h2>
      <p>${won ? (first && next ? 'Der nächste Halt ist freigeschaltet: ' + next.name + '.' : 'Gut gefahren!') : 'Stell ein anderes Team zusammen. Achte auf die Typen des Gegners.'}</p>
      <div class="reward-line">+${reward} Münzen</div>
      <div class="btns">
        <button class="btn ghost" id="r-map">Zur Strecke</button>
        <button class="btn primary" id="r-again">${won ? 'Kartenpacks kaufen' : 'Nochmal versuchen'}</button>
      </div>
    </div>`, 'result-modal');
  $('#r-map', m).onclick = () => { closeModal(m); B = null; screenMap(); };
  $('#r-again', m).onclick = () => {
    closeModal(m);
    B = null;
    if (won) screenShop(); else screenTeam(st);
  };
}

/* ================= Packs ================= */

const PACKS = {
  regio:   { id: 'regio',   name: 'Regio-Pack',         price: 100, n: 5, w: [62, 28, 9, 1],  guar: 0, color: '#c4372b', sub: 'Meist normale Züge. Mit etwas Glück ist mehr drin.' },
  dampf:   { id: 'dampf',   name: 'Dampf-Pack',         price: 150, n: 5, w: [62, 28, 9, 1],  guar: 0, type: 'dampf',   color: '#8f2d24', sub: 'Nur Dampfloks, vom Adler bis zur BR 05.' },
  diesel:  { id: 'diesel',  name: 'Diesel-Pack',        price: 150, n: 5, w: [62, 28, 10, 0], guar: 0, type: 'diesel',  color: '#b36f00', sub: 'Nur Dieselloks und Triebwagen.' },
  elektro: { id: 'elektro', name: 'Elektro-Pack',       price: 150, n: 5, w: [62, 28, 9, 1],  guar: 0, type: 'elektro', color: '#1f5fb8', sub: 'Nur E-Loks und S-Bahnen.' },
  schnell: { id: 'schnell', name: 'Schnellfahrt-Pack',  price: 150, n: 5, w: [45, 35, 15, 5], guar: 0, type: 'ice',     color: '#0e8472', sub: 'Nur ICE und Transrapid.' },
  ic:      { id: 'ic',      name: 'InterCity-Pack',     price: 260, n: 5, w: [30, 45, 20, 5],  guar: 1, color: '#2b7de0', sub: 'Mindestens ein seltener Zug oder besser.' },
  ice:     { id: 'ice',     name: 'ICE-Sprinter-Pack',  price: 600, n: 5, w: [8, 37, 40, 15],  guar: 2, color: '#12a58f', sub: 'Mindestens ein epischer Zug oder besser.' }
};

function rollPack(pack) {
  const got = [];
  const inType = c => !pack.type || c.ty === pack.type;
  const drawOne = minR => {
    const w = pack.w.map((x, r) => r >= minR ? x : 0);
    const r = weighted([0, 1, 2, 3], w);
    let pool = [];
    // Gibt es in diesem Typ keine Karte der Seltenheit, eine Stufe tiefer ziehen
    for (let k = 0; k < 4 && !pool.length; k++) {
      const rr = Math.max(0, r - k);
      pool = CARDS.filter(c => c.r === rr && inType(c) && !(pack.unique && got.includes(c)));
    }
    if (!pool.length) pool = CARDS.filter(inType);
    return pick(pool);
  };
  for (let i = 0; i < pack.n; i++) got.push(drawOne(0));
  if (pack.guar && !got.some(c => c.r >= pack.guar)) {
    got[pack.n - 1] = drawOne(pack.guar);
  }
  // Seltene Karten ans Ende, damit es spannend bleibt
  got.sort((a, b) => a.r - b.r);
  return got;
}

function addToCollection(card) {
  const before = S.own[card.id] || 0;
  S.own[card.id] = before + 1;
  if (before === 0) return { card, kind: 'new', lvl: 1 };
  if (before < 5) return { card, kind: 'up', lvl: before + 1 };
  S.coins += 25;
  return { card, kind: 'max', lvl: 5 };
}

function screenShop() {
  setTop(screenHome);
  show('shop', root => {
    const list = Object.values(PACKS);
    root.innerHTML = `<div class="pagehead"><h1>Kartenpacks</h1><p class="dim">Wische nach links und rechts, um alle Packs zu sehen. Münzen verdienst du im Kampf.</p></div>
      <div class="carousel">
        <button class="car-btn prev" aria-label="Vorheriges Pack">‹</button>
        <div class="packs" id="packs">${list.map(p => `
          <div class="pack-tile" style="--pc:${p.color}">
            <div class="pack-art">
              <div class="pack-label"><span>${p.name}</span><small>${p.n} Karten</small></div>
              ${p.type ? `<span class="pack-ty t-${p.type}">${typeIcon(p.type)}${TYPES[p.type].name}</span>` : ''}
            </div>
            <p>${p.sub}</p>
            <div class="odds">${p.w.map((x, r) => `<span style="--rc:${RARITY[r].color}">${RARITY[r].short} ${Math.round(x / p.w.reduce((a, b) => a + b, 0) * 100)}%</span>`).join('')}</div>
            <button class="btn primary" data-pack="${p.id}" ${S.coins < p.price ? 'disabled' : ''}>${p.price} Münzen</button>
          </div>`).join('')}</div>
        <button class="car-btn next" aria-label="Nächstes Pack">›</button>
      </div>
      <div class="dots" id="dots">${list.map((p, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <p class="dim center">N Normal · S Selten · E Episch · L Legendär</p>`;

    const strip = $('#packs', root);
    const tiles = $$('.pack-tile', strip);
    function updateDots() {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let best = 0, bd = 1e9;
      tiles.forEach((t, i) => {
        const d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - mid);
        if (d < bd) { bd = d; best = i; }
      });
      $$('#dots i', root).forEach((d, i) => d.classList.toggle('on', i === best));
      $('.car-btn.prev', root).classList.toggle('off', strip.scrollLeft < 8);
      $('.car-btn.next', root).classList.toggle('off', strip.scrollLeft + strip.clientWidth > strip.scrollWidth - 8);
    }
    const step = dir => strip.scrollBy({ left: dir * (tiles[0].offsetWidth + 18), behavior: 'smooth' });
    $('.car-btn.prev', root).onclick = () => { Sound.click(); step(-1); };
    $('.car-btn.next', root).onclick = () => { Sound.click(); step(1); };
    $$('#dots i', root).forEach(d => d.onclick = () => tiles[+d.dataset.i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
    strip.addEventListener('scroll', updateDots, { passive: true });
    updateDots();

    $$('[data-pack]', root).forEach(b => b.addEventListener('click', () => {
      const p = PACKS[b.dataset.pack];
      if (S.coins < p.price) return;
      S.coins -= p.price;
      save();
      updateCoins();
      Sound.coin();
      openPack(p, {});
    }));
  });
}

/* ----- Partikel-Effekte (Funken, Konfetti) ----- */

function makeFX(canvas) {
  const ctx = canvas.getContext('2d');
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let parts = [], raf = 0;

  function size() {
    canvas.width = Math.max(1, canvas.clientWidth * dpr);
    canvas.height = Math.max(1, canvas.clientHeight * dpr);
  }
  size();
  window.addEventListener('resize', size);

  function add(p) { parts.push(p); if (!raf) raf = requestAnimationFrame(tick); }

  function burst(x, y, o) {
    const r = canvas.getBoundingClientRect();
    const n = calm ? Math.ceil(o.n / 5) : o.n;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(0.25, 1) * o.speed;
      add({ x: x - r.left, y: y - r.top, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g == null ? 0.05 : o.g,
        life: o.life * rnd(0.6, 1), age: 0, size: rnd(0.6, 1) * o.size, color: pick(o.colors), shape: o.shape || 'spark',
        rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2) });
    }
  }

  function rain(o) {
    const w = canvas.clientWidth;
    const n = calm ? Math.ceil(o.n / 5) : o.n;
    for (let i = 0; i < n; i++) {
      add({ x: rnd(0, w), y: rnd(-60, -5), vx: rnd(-1, 1), vy: rnd(1.5, 4), g: 0.02, life: rnd(110, 170), age: 0,
        size: rnd(5, 10), color: pick(o.colors), shape: 'confetti', rot: rnd(0, 6.28), vr: rnd(-0.25, 0.25) });
    }
  }

  function star(c, s) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? s * 0.25 : s;
      const a = i * Math.PI / 4;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  }

  function tick() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.age < p.life);
    for (const p of parts) {
      p.age++;
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.shape !== 'confetti') { p.vx *= 0.985; }
      const t = p.age / p.life;
      ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.fillStyle = p.color;
      if (p.shape === 'spark') star(ctx, p.size * (1 - t * 0.5));
      else if (p.shape === 'confetti') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  return { burst, rain, destroy() { window.removeEventListener('resize', size); cancelAnimationFrame(raf); parts = []; } };
}

const RARITY_FX = [
  null,
  { colors: ['#3fa7ff', '#a8d8ff', '#ffffff'], n: 32, speed: 5, size: 9 },
  { colors: ['#b266ff', '#ff77ee', '#ffffff', '#77eeff'], n: 80, speed: 7, size: 11 },
  { colors: ['#ffb000', '#ffe08a', '#ffffff', '#ff7a3c'], n: 150, speed: 9, size: 13 }
];

/* ----- Pack öffnen: Wisch-Schnitt, Lichtblitz, Karten-Flip ----- */

function openPack(pack, opts) {
  const cards = rollPack(pack);
  const results = cards.map(addToCollection);
  save();
  updateCoins();

  const m = openModal('', 'pack-modal');
  m.style.setProperty('--pc', pack.color || '#c4372b');
  const canvas = h('<canvas class="fx"></canvas>');
  m.insertBefore(canvas, m.firstChild);
  const fx = makeFX(canvas);
  const box = $('.modal-box', m);
  let idx = 0;
  let confettiTimer = 0;

  const close = () => { clearInterval(confettiTimer); fx.destroy(); closeModal(m); };
  const flash = cls => { m.classList.remove('flash0', 'flash1', 'flash2', 'flash3'); void m.offsetWidth; m.classList.add(cls); };

  function sealed() {
    box.innerHTML = `
      <div class="pack-stage">
        <div class="pk-wrap">
          <div class="pk" id="pk">
            <div class="pk-body">
              <div class="pk-logo">G</div>
              <div class="pk-label"><span>${pack.name}</span><small>${pack.n} Karten</small></div>
            </div>
            <div class="pk-crimp"></div>
            <i class="pk-cut"></i>
            <i class="pk-sheen"></i>
            <i class="pk-arrow">➜</i>
          </div>
        </div>
        <p class="tap-hint">Wische über die Oberkante, um das Pack aufzuschneiden</p>
      </div>`;
    const pk = $('#pk', box);
    let sx = null, moved = false, opened = false;

    function cut() {
      if (opened) return;
      opened = true;
      pk.style.setProperty('--cut', 1);
      pk.classList.add('open');
      Sound.tear();
      const r = pk.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height * 0.14, { colors: ['#fff', '#ffe9a3', '#ffffff'], n: 60, speed: 9, size: 10, life: 50 });
      flash('flash1');
      setTimeout(() => { Sound.boom(); }, 250);
      setTimeout(stack, 900);
    }
    pk.addEventListener('pointerdown', e => {
      sx = e.clientX; moved = false;
      try { pk.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    });
    pk.addEventListener('pointermove', e => {
      if (sx == null || opened) return;
      const r = pk.getBoundingClientRect();
      const p = Math.min(1, Math.abs(e.clientX - sx) / (r.width * 0.65));
      if (p > 0.04) moved = true;
      pk.style.setProperty('--cut', p);
      if (p >= 1) cut();
    });
    pk.addEventListener('pointerup', () => {
      if (!opened) { if (!moved) cut(); else pk.style.setProperty('--cut', 0); }
      sx = null;
    });
    Sound.shimmer(0);
  }

  function stack() {
    box.innerHTML = `
      <div class="pack-stage">
        <div class="rays" id="rays"></div>
        <div class="counter" id="counter">1 / ${results.length}</div>
        <div class="deck" id="deck">${results.map((r, i) => `
          <div class="dk" data-i="${i}" style="--o:${i}">
            <div class="tilt"><div class="dk-in">
              <div class="face back">${cardBackHTML()}</div>
              <div class="face front">${cardHTML(r.card, { lvl: r.lvl })}<i class="sheen"></i></div>
            </div></div>
          </div>`).join('')}</div>
        <div class="reveal-info" id="info"><p class="tap-hint">Antippen zum Aufdecken</p></div>
        <button class="link" id="skip">Alle aufdecken</button>
      </div>`;
    Sound.whoosh();
    const deck = $('#deck', box), info = $('#info', box), rays = $('#rays', box);
    let phase = 'back';
    const topCard = () => $(`.dk[data-i="${idx}"]`, deck);

    function effects(r, dk) {
      const rr = r.card.r;
      const rect = dk.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      if (rr >= 1) Sound.rare(rr);
      Sound.shimmer(rr);
      const f = RARITY_FX[rr];
      if (f) fx.burst(cx, cy, { colors: f.colors, n: f.n, speed: f.speed, size: f.size, life: 55 + rr * 12, g: 0.04 });
      rays.className = 'rays' + (rr >= 1 ? ' on c' + rr : '');
      if (rr >= 2) flash('flash' + rr);
      if (rr >= 2) { dk.classList.add('wow'); setTimeout(() => dk.classList.remove('wow'), 900); }
      if (rr === 3) {
        Sound.win();
        let n = 0;
        confettiTimer = setInterval(() => {
          fx.rain({ n: 14, colors: f.colors });
          fx.burst(cx + rnd(-90, 90), cy + rnd(-120, 60), { colors: f.colors, n: 10, speed: 4, size: 9, life: 40 });
          if (++n > 14) clearInterval(confettiTimer);
        }, 150);
      }
      if (r.kind === 'max') { Sound.coin(); updateCoins(); }
    }

    function tagText(r) {
      if (r.kind === 'new') return '<span class="tag new">Neu im Album!</span>';
      if (r.kind === 'up') return `<span class="tag up">Aufgewertet auf Stufe ${r.lvl}</span>`;
      return '<span class="tag max">Schon auf Stufe 5: +25 Münzen</span>';
    }

    function flip(dk) {
      phase = 'busy';
      const r = results[idx];
      Sound.flip();
      dk.classList.add('flipped');
      setTimeout(() => {
        effects(r, dk);
        info.innerHTML = `<div class="rar-banner r${r.card.r}">${RARITY[r.card.r].name}</div>${tagText(r)}<p class="tap-hint dim">Antippen für die nächste Karte</p>`;
        phase = 'front';
      }, 450);
    }

    function next(dk) {
      phase = 'busy';
      clearInterval(confettiTimer);
      rays.className = 'rays';
      dk.classList.add('away');
      Sound.swap();
      setTimeout(() => {
        dk.remove();
        idx++;
        if (idx >= results.length) { summary(); return; }
        $$('.dk', deck).forEach(el => el.style.setProperty('--o', +el.dataset.i - idx));
        $('#counter', box).textContent = (idx + 1) + ' / ' + results.length;
        info.innerHTML = '<p class="tap-hint">Antippen zum Aufdecken</p>';
        phase = 'back';
      }, 380);
    }

    deck.addEventListener('click', () => {
      if (phase === 'busy') return;
      const dk = topCard();
      if (!dk) return;
      if (phase === 'back') flip(dk); else next(dk);
    });

    // Neigungseffekt mit Glanz, wie beim Kippen einer echten Karte
    deck.addEventListener('pointermove', e => {
      const dk = topCard();
      if (!dk || !dk.classList.contains('flipped')) return;
      const r = dk.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const t = $('.tilt', dk);
      t.style.setProperty('--rx', ((0.5 - y) * 22).toFixed(1) + 'deg');
      t.style.setProperty('--ry', ((x - 0.5) * 26).toFixed(1) + 'deg');
      t.style.setProperty('--mx', (x * 100).toFixed(0) + '%');
      t.style.setProperty('--my', (y * 100).toFixed(0) + '%');
    });
    deck.addEventListener('pointerleave', () => {
      const dk = topCard();
      if (dk) { const t = $('.tilt', dk); t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); }
    });
    $('#skip', box).addEventListener('click', () => { clearInterval(confettiTimer); summary(); });
  }

  function summary() {
    const again = !opts.free && pack.price && S.coins >= pack.price;
    const best = Math.max.apply(null, results.map(r => r.card.r));
    m.classList.add('summary');
    box.innerHTML = `
      <div class="sum-wrap">
        <h2>Deine neuen Züge</h2>
        <div class="sum-grid">${results.map((r, i) => `<div class="sum-item r${r.card.r}" style="--d:${i * 0.09}s">${cardHTML(r.card, { lvl: r.lvl, mini: true })}<span class="tag ${r.kind}">${r.kind === 'new' ? 'Neu' : r.kind === 'up' ? 'Stufe ' + r.lvl : '+25 Münzen'}</span></div>`).join('')}</div>
        <div class="btns center-btns">
          ${again ? '<button class="btn ghost" id="p-again">Noch ein Pack</button>' : ''}
          <button class="btn primary" id="p-done">${opts.free ? 'Los geht\'s' : 'Fertig'}</button>
        </div>
      </div>`;
    if (best >= 2) {
      const f = RARITY_FX[best];
      setTimeout(() => fx.burst(window.innerWidth / 2, window.innerHeight * 0.3, { colors: f.colors, n: 60, speed: 7, size: 10, life: 60 }), 300);
    }
    Sound.win();
    $('#p-done', box).onclick = () => { close(); if (currentScreen === 'shop') screenShop(); else screenHome(); };
    const ag = $('#p-again', box);
    if (ag) ag.onclick = () => {
      close();
      S.coins -= pack.price;
      save();
      updateCoins();
      Sound.coin();
      openPack(pack, opts);
    };
  }

  sealed();
}

/* ================= Decks ================= */

const DECK_SIZE = 3;
const DECK_SLOTS = 5;

function esc(t) {
  return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function ensureDecks() {
  S.decks.forEach(d => {
    d.ids = d.ids.filter(id => S.own[id]);
    // Ältere Decks mit mehr Zügen: die zuletzt gewählte Aufstellung bleibt erhalten
    if (d.ids.length > DECK_SIZE) {
      const keep = (d.lineup || []).filter(id => d.ids.includes(id));
      d.ids = keep.length === DECK_SIZE ? keep : d.ids.slice(0, DECK_SIZE);
    }
  });
  if (!S.decks.length && ownedCount() >= 3) {
    S.decks.push({ name: 'Deck 1', ids: bestCards(DECK_SIZE).map(c => c.id) });
    S.active = 0;
    save();
  }
  if (S.active >= S.decks.length) S.active = 0;
}

function deckSummary() {
  ensureDecks();
  const d = S.decks[S.active];
  if (!d) return 'Noch kein Deck gebaut';
  return `Aktiv: ${esc(d.name)} (${d.ids.length}/${DECK_SIZE} Züge)`;
}

function typeCounts(ids) {
  const n = {};
  ids.forEach(id => { const t = CARD_BY_ID[id].ty; n[t] = (n[t] || 0) + 1; });
  return n;
}

function typeChips(ids) {
  const n = typeCounts(ids);
  return Object.keys(TYPES).filter(t => n[t]).map(t => `<span class="tychip t-${t}">${typeIcon(t)}${n[t]}</span>`).join('');
}

function thumbHTML(c) {
  return `<div class="thumb r${c.r} t-${c.ty}">${trainSVG(c)}</div>`;
}

function screenDecks() {
  ensureDecks();
  setTop(screenHome);
  show('decks', root => {
    const tiles = [];
    for (let i = 0; i < DECK_SLOTS; i++) {
      const d = S.decks[i];
      if (!d) {
        tiles.push(`<button class="deck-tile empty" data-new="${i}"><span class="plus">+</span><b>Neues Deck</b><small>Bau ein Deck aus deinen Zügen</small></button>`);
        continue;
      }
      const slots = [];
      for (let k = 0; k < DECK_SIZE; k++) {
        const id = d.ids[k];
        slots.push(id ? thumbHTML(CARD_BY_ID[id]) : '<div class="thumb blank"></div>');
      }
      tiles.push(`<div class="deck-tile${i === S.active ? ' active' : ''}" data-i="${i}">
        <div class="dt-head"><b>${esc(d.name)}</b>${i === S.active ? '<span class="badge">Aktiv</span>' : ''}${d.ids.length < 3 ? '<span class="badge warn">Zu klein</span>' : ''}</div>
        <div class="dt-cards">${slots.join('')}</div>
        <div class="dt-meta"><span class="dim">${d.ids.length} von ${DECK_SIZE} Zügen</span><span class="tyrow">${typeChips(d.ids)}</span></div>
        <div class="dt-actions"><button class="btn primary sm" data-edit="${i}">Bearbeiten</button>${i !== S.active ? `<button class="btn ghost sm" data-act="${i}">Aktiv setzen</button>` : ''}</div>
      </div>`);
    }
    root.innerHTML = `<div class="pagehead"><h1>Decks</h1><p class="dim">Baue bis zu ${DECK_SLOTS} Decks mit je ${DECK_SIZE} Zügen. Im Kampf fährt dein aktives Deck. Wechsle das Deck passend zum Gegner.</p></div>
      <div class="deck-list">${tiles.join('')}</div>`;
    $$('[data-edit]', root).forEach(b => b.onclick = () => { Sound.click(); screenDeckEdit(+b.dataset.edit); });
    $$('[data-act]', root).forEach(b => b.onclick = () => { S.active = +b.dataset.act; save(); Sound.coin(); screenDecks(); });
    $$('[data-new]', root).forEach(b => b.onclick = () => {
      Sound.click();
      if (ownedCount() < 1) { toast('Öffne zuerst ein Kartenpack.'); return; }
      S.decks.push({ name: 'Deck ' + (S.decks.length + 1), ids: [] });
      save();
      screenDeckEdit(S.decks.length - 1);
    });
  });
}

function screenDeckEdit(i) {
  ensureDecks();
  const d = S.decks[i];
  if (!d) { screenDecks(); return; }
  d.ids = d.ids.filter(id => S.own[id]);
  setTop(screenDecks);
  let filter = 'alle', sort = 'rar';
  const SORTS = { rar: 'Seltenheit', at: 'Angriff', hp: 'Leben', nr: 'Nummer' };

  show('deckedit', root => {
    root.innerHTML = `
      <div class="de-top">
        <div class="de-row">
          <input id="dname" class="dname" maxlength="18" aria-label="Name des Decks" autocomplete="off">
          <button class="btn ghost sm" id="d-act"></button>
          <button class="btn ghost sm" id="d-del">Löschen</button>
        </div>
        <div class="de-slots" id="de-slots"></div>
        <div class="de-info" id="de-info"></div>
      </div>
      <div class="filters" id="filters">${['alle', 'dampf', 'diesel', 'elektro', 'ice'].map(f => `<button class="chip" data-f="${f}">${f === 'alle' ? 'Alle' : TYPES[f].name}</button>`).join('')}</div>
      <div class="filters sorts" id="sorts"><span class="dim">Sortieren:</span>${Object.keys(SORTS).map(k => `<button class="chip" data-s="${k}">${SORTS[k]}</button>`).join('')}</div>
      <div class="pick-grid" id="grid"></div>`;
    $('#dname', root).value = d.name;
    $('#dname', root).addEventListener('input', e => { d.name = e.target.value.trim() || 'Deck ' + (i + 1); save(); });

    const grid = $('#grid', root);

    function refreshTop() {
      const slots = [];
      for (let k = 0; k < DECK_SIZE; k++) {
        const id = d.ids[k];
        if (!id) { slots.push('<div class="de-slot empty"><span>+</span></div>'); continue; }
        const c = CARD_BY_ID[id];
        slots.push(`<button class="de-slot t-${c.ty}" data-id="${id}" aria-label="${c.nm} entfernen">${thumbHTML(c)}<b>${c.nm}</b><i class="x">×</i></button>`);
      }
      $('#de-slots', root).innerHTML = slots.join('');
      const n = d.ids.length;
      const types = Object.keys(typeCounts(d.ids));
      let msg;
      if (n < 3) msg = `<span class="warn-t">Noch ${3 - n} ${3 - n === 1 ? 'Zug' : 'Züge'} bis das Deck kämpfen kann.</span>`;
      else if (n < DECK_SIZE) msg = `<span class="dim">Noch Platz für ${DECK_SIZE - n} ${DECK_SIZE - n === 1 ? 'Zug' : 'Züge'}.</span>`;
      else msg = '<span class="ok-t">Deck ist voll.</span>';
      if (n >= 3 && types.length === 1) msg += ' <span class="dim">Alle Züge haben denselben Typ. Mische Typen, um Gegner zu kontern.</span>';
      $('#de-info', root).innerHTML = `<span class="tyrow">${typeChips(d.ids)}</span>${msg}`;
      const act = $('#d-act', root);
      act.textContent = i === S.active ? 'Aktives Deck' : 'Als aktiv setzen';
      act.disabled = i === S.active;
      $$('.de-slot[data-id]', root).forEach(b => b.onclick = () => removeCard(+b.dataset.id));
    }

    function fillGrid() {
      let ids = Object.keys(S.own).map(Number).filter(id => filter === 'alle' || CARD_BY_ID[id].ty === filter);
      const key = { rar: id => CARD_BY_ID[id].r * 1000 + CARD_BY_ID[id].at, at: id => stats(CARD_BY_ID[id], level(id)).at, hp: id => stats(CARD_BY_ID[id], level(id)).hp, nr: id => -id };
      ids.sort((a, b) => key[sort](b) - key[sort](a));
      if (!ids.length) { grid.innerHTML = '<p class="dim">Keine Züge dieses Typs in deiner Sammlung.</p>'; return; }
      grid.innerHTML = ids.map(id => `<div class="de-item${d.ids.includes(id) ? ' in' : ''}" data-id="${id}">
        <button class="de-add" aria-label="${CARD_BY_ID[id].nm} hinzufügen oder entfernen">${cardHTML(CARD_BY_ID[id], { lvl: level(id), mini: true })}</button>
        <button class="de-i" data-info="${id}" aria-label="Details">i</button>
        <span class="de-mark">Im Deck</span></div>`).join('');
    }

    function markItems() {
      $$('.de-item', grid).forEach(el => el.classList.toggle('in', d.ids.includes(+el.dataset.id)));
    }

    function removeCard(id) {
      d.ids = d.ids.filter(x => x !== id);
      save(); Sound.swap(); refreshTop(); markItems();
    }

    grid.addEventListener('click', e => {
      const info = e.target.closest('[data-info]');
      if (info) { openDetail(+info.dataset.info); return; }
      const it = e.target.closest('.de-item');
      if (!it) return;
      const id = +it.dataset.id;
      if (d.ids.includes(id)) { removeCard(id); return; }
      if (d.ids.length >= DECK_SIZE) { toast('Das Deck ist voll. Entferne oben erst einen Zug.'); return; }
      d.ids.push(id);
      save(); Sound.click(); refreshTop(); markItems();
    });

    $('#filters', root).addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filter = b.dataset.f;
      $$('#filters .chip', root).forEach(x => x.classList.toggle('on', x === b));
      Sound.click(); fillGrid();
    });
    $('#sorts', root).addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      sort = b.dataset.s;
      $$('#sorts .chip', root).forEach(x => x.classList.toggle('on', x === b));
      Sound.click(); fillGrid();
    });
    $$('#filters .chip', root)[0].classList.add('on');
    $('#sorts .chip', root).classList.add('on');

    $('#d-act', root).onclick = () => { S.active = i; save(); Sound.coin(); refreshTop(); };
    $('#d-del', root).onclick = () => {
      const m = openModal(`<h2>Deck löschen?</h2><p>„${esc(d.name)}“ wird gelöscht. Deine Karten bleiben im Album.</p>
        <div class="btns"><button class="btn ghost" id="m-no">Abbrechen</button><button class="btn danger" id="m-yes">Löschen</button></div>`);
      $('#m-no', m).onclick = () => closeModal(m);
      $('#m-yes', m).onclick = () => {
        closeModal(m);
        S.decks.splice(i, 1);
        if (S.active >= S.decks.length) S.active = Math.max(0, S.decks.length - 1);
        save();
        screenDecks();
      };
    };

    refreshTop();
    fillGrid();
  });
}

/* ================= Album ================= */

let albumFilter = 'alle';

function screenAlbum() {
  setTop(screenHome);
  show('album', root => {
    root.innerHTML = `<div class="pagehead"><h1>Album</h1><p class="dim">${ownedCount()} von ${CARDS.length} Zügen gefunden</p></div>
      <div class="filters" id="filters">
        ${['alle', 'dampf', 'diesel', 'elektro', 'ice'].map(f => `<button class="chip${albumFilter === f ? ' on' : ''}" data-f="${f}">${f === 'alle' ? 'Alle' : TYPES[f].name}</button>`).join('')}
      </div>
      <div class="album-grid" id="ag"></div>`;
    const grid = $('#ag', root);
    function fill() {
      const list = CARDS.filter(c => albumFilter === 'alle' || c.ty === albumFilter);
      grid.innerHTML = list.map(c => {
        const n = S.own[c.id] || 0;
        if (!n) return `<div class="album-item">${lockedHTML(c)}</div>`;
        return `<button class="album-item">${cardHTML(c, { lvl: level(c.id), mini: true })}${n > 1 ? `<span class="count">×${n}</span>` : ''}</button>`;
      }).join('');
    }
    $('#filters', root).addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      albumFilter = b.dataset.f;
      $$('.chip', root).forEach(x => x.classList.toggle('on', x === b));
      Sound.click();
      fill();
    });
    grid.addEventListener('click', e => {
      const it = e.target.closest('button.album-item');
      if (it) openDetail(+$('.card', it).dataset.id);
    });
    fill();
  });
}

function openDetail(id) {
  const c = CARD_BY_ID[id];
  if (!c || !S.own[id]) return;
  const lvl = level(id);
  const n = S.own[id];
  const st = stats(c, lvl);
  const ty = TYPES[c.ty];
  const strong = Object.keys(TYPES).find(t => TYPES[t].beats === c.ty);
  const m = openModal(`
    <div class="detail">
      ${cardHTML(c, { lvl, cls: 'big' })}
      <div class="detail-info">
        <h2>${c.nm}</h2>
        <p><span class="tychip t-${c.ty}">${typeIcon(c.ty)}${ty.name}</span> <span class="rar" style="--rc:${RARITY[c.r].color}">${RARITY[c.r].name}</span></p>
        <dl>
          <dt>Stufe</dt><dd>${lvl} von 5${n > 1 ? ` (${n} Exemplare)` : ''}</dd>
          <dt>Lebenspunkte</dt><dd>${st.hp}</dd>
          <dt>Angriff</dt><dd>${st.at} / ${Math.round(st.at * 1.7)}</dd>
          <dt>Stark gegen</dt><dd>${TYPES[ty.beats].name}</dd>
          <dt>Schwach gegen</dt><dd>${TYPES[strong].name}</dd>
        </dl>
        <p class="dim">${lvl < 5 ? 'Noch ' + (5 - lvl) + ' doppelte Karten bis Stufe 5.' : 'Höchste Stufe erreicht.'}</p>
        <div class="btns"><button class="btn primary" id="m-close">Schließen</button></div>
      </div>
    </div>`, 'detail-modal');
  $('#m-close', m).onclick = () => closeModal(m);
  m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
}

/* ================= Start ================= */

function init() {
  Sound.setMuted(S.muted);
  const sndBtn = $('#btn-sound');
  const showSnd = () => { sndBtn.classList.toggle('off', S.muted); sndBtn.setAttribute('aria-pressed', String(!S.muted)); };
  sndBtn.addEventListener('click', () => {
    S.muted = !S.muted;
    Sound.setMuted(S.muted);
    save();
    showSnd();
    if (!S.muted) Sound.horn();
  });
  showSnd();
  $$('#nav button').forEach(b => b.addEventListener('click', () => {
    Sound.click();
    if (modalRoot.childElementCount) return;
    NAV_GO[b.dataset.nav]();
  }));
  $('#btn-back').addEventListener('click', () => { Sound.click(); if (backAction) backAction(); });
  $('#logo').addEventListener('click', () => { if (currentScreen !== 'battle') screenHome(); });
  document.addEventListener('pointerdown', () => Sound.resume(), { once: true });

  if (!S.intro) startFirstRun();
  else screenHome();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* Offline-Funktion nicht verfügbar */ });
  }
}

document.addEventListener('DOMContentLoaded', init);
