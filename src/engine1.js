/* ===== РОДБЛОК · движок: ядро ===== */
let S = null;
let SEED = 1;
function rnd() { SEED = (SEED + 0x6D2B79F5) | 0; let t = Math.imul(SEED ^ (SEED >>> 15), 1 | SEED); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function rint(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function chance(p) { return rnd() < p; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function pickW(a) { let tot = 0; for (const x of a) tot += x.w; let r = rnd() * tot; for (const x of a) { r -= x.w; if (r < 0) return x; } return a[a.length - 1]; }

function clock(t) { const m = (((t + START_HOUR * 60) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function hourOf(t) { return Math.floor((((t + START_HOUR * 60) % 1440) + 1440) % 1440 / 60); }
function isNight() { return hourOf(S.t) < 6; }

const HANDLERS = {}, LATE = {}, FAIL = {}, START = {}, APPLY = {}, LATER = {}, EV = {};

function note(text, kind) { const n = { id: ++S.uid, t: S.t, text, kind: kind || 'info' }; S.notes.push(n); S.log.push(n); if (S.notes.length > 60) S.notes.splice(0, S.notes.length - 60); }
function addScore(n, why) { S.score += n; if (why) S.scoreLog.push({ t: S.t, n, why }); }
const pat = id => S.P[id];
const task = id => S.T[id];
const staffBy = id => S.staff.find(s => s.id === id);
const locName = id => (LOC[id] ? LOC[id].label : 'ОПБ');
const isBox = id => !!id && id.startsWith('box');
const isOR = id => id === 'or1' || id === 'or2' || id === 'orP';
function livePatients() { return Object.values(S.P).filter(p => p.phase !== 'gone'); }
function openTasks() { return Object.values(S.T).filter(t => !t.done); }
function he(s, m, f) { return s.f ? f : m; }

function newGame(seed) {
  SEED = seed || Math.floor(Math.random() * 1e9) + 1;
  S = {
    v: 2, t: 0, uid: 0, rng: SEED, over: false, auto: true, autoPause: true,
    P: {}, T: {}, staff: [], decisions: [], notes: [], log: [], scoreLog: [], review: [], modals: [], later: [],
    rooms: {}, queue: [], planned: [], nextBlogger: false,
    score: 0, vbi: 6, vbiPeak: 6, pauseReq: false,
    mod: { arrival: 1, arrivalUntil: 0, rest: 1, restUntil: 0 },
    slow: {}, ev: { next: rint(45, 80), used: {} }, dzm: null,
    st: { arrivals: 0, births: 0, vag: 0, vep: 0, cs: 0, csEm: 0, csNeedless: 0, pph: 0, kas: 0, asph: 0, oritn: 0, chorio: 0, palata: 0, complaints: 0, noDoc: 0, dyst: 0, decOk: 0, decAll: 0, maxQueue: 0, dirtyUse: 0, cleaned: 0, pmuBirths: 0, pmuStopped: 0, pmuMissed: 0, vipTotal: 0, vipOk: 0, vipBad: 0 },
  };
  for (const id of BED_IDS) S.rooms[id] = { id, pid: null, dirty: false, cleanTask: null, dirtyAfter: false };
  for (const r of ROSTER) S.staff.push({ id: r.id, role: r.role, name: r.name, short: r.short, f: r.f || 0, energy: rint(80, 100), loc: r.start, dest: null, eta: 0, depart: 0, state: 'idle', taskId: null, slot: null, rest: false, forced: false, awayUntil: 0 });
  for (const d of PMU_DOCS) S.staff.push({ id: d.id, role: 'pmu', name: d.name, short: d.short, f: d.f || 0, title: d.title, quirk: d.quirk, absurd: d.absurd, delay: d.delay, energy: 100, loc: 'priem', dest: null, eta: 0, depart: 0, state: 'away', taskId: null, slot: null, rest: false, forced: false, awayUntil: 1e9, out: true });
  handover();
  setupWaves();
  S.rng = SEED;
  return S;
}

/* ---------- персонал ---------- */
function sendTo(s, loc, fast) {
  if (!loc) return;
  if (s.loc === loc && s.state !== 'walk') return;
  let tt = travelTime(s.loc, loc);
  if (fast) tt = Math.max(1, Math.round(tt * 0.6));
  if (s.energy < 30) tt = Math.max(1, Math.round(tt * 1.25));
  s.dest = loc; s.depart = S.t; s.eta = S.t + tt; s.state = 'walk';
}
function fits(role, need) {
  if (need === 'zav') return role === 'zav';
  if (need === 'any') return role !== 'obst';
  if (need === 'obst') return role === 'obst' || role === 'zav' || role === 'pmu';
  if (need === 'neo') return role === 'neo' || role === 'reanim';
  return role === need;
}
function missing(tk) {
  const m = {};
  for (const n in tk.need) { const have = (tk.slots[n] || []).length; if (have < tk.need[n]) m[n] = tk.need[n] - have; }
  return m;
}
function assign(s, tk, need) {
  if (s.taskId) unassign(s);
  (tk.slots[need] = tk.slots[need] || []).push(s.id);
  s.taskId = tk.id; s.slot = need; s.rest = false; s.forced = false;
  if (s.loc === tk.loc && s.state !== 'walk') s.state = 'work'; else sendTo(s, tk.loc, tk.pri >= 3);
}
function unassign(s) {
  const tk = task(s.taskId);
  if (tk && tk.slots[s.slot]) { const i = tk.slots[s.slot].indexOf(s.id); if (i >= 0) tk.slots[s.slot].splice(i, 1); }
  s.taskId = null; s.slot = null;
  if (s.state === 'work') s.state = 'idle';
}
function addTask(o) {
  const tk = Object.assign({ id: ++S.uid, created: S.t, done: false, started: false, startT: null, prog: 0, dur: 10, pri: 1, slots: {}, need: {}, callAt: S.t, deadline: null, failAt: null, late: false, lamps: [], pid: null, label: '' }, o);
  S.T[tk.id] = tk;
  const p = tk.pid && pat(tk.pid);
  if (p) p.tasks.push(tk.id);
  return tk;
}
function closeTask(tk) {
  if (!tk || tk.done) return;
  tk.done = true; tk.doneT = S.t;
  for (const n in tk.slots) for (const id of tk.slots[n]) {
    const s = staffBy(id);
    if (s && s.taskId === tk.id) { s.taskId = null; s.slot = null; if (s.state === 'work') s.state = 'idle'; }
  }
  tk.slots = {};
}
function finish(tk) { closeTask(tk); const h = HANDLERS[tk.type]; if (h) h(tk); }
function cancelTasks(p, types, keep) {
  for (const id of p.tasks) {
    const tk = task(id);
    if (!tk || tk.done) continue;
    if (types && !types.includes(tk.type)) continue;
    if (keep && keep.includes(tk.type)) continue;
    closeTask(tk);
  }
}
function present(tk, roles) {
  if (!tk) return false;
  for (const n in tk.slots) for (const id of tk.slots[n]) {
    const s = staffBy(id);
    if (s && s.state === 'work' && s.loc === tk.loc && (!roles || roles.includes(s.role))) return true;
  }
  return false;
}
function allPresent(tk) {
  for (const n in tk.need) {
    const arr = tk.slots[n] || [];
    if (arr.length < tk.need[n]) return false;
    for (const id of arr) { const s = staffBy(id); if (!s || s.state !== 'work' || s.loc !== tk.loc) return false; }
  }
  return true;
}
function teamRate(tk) {
  let r = 1;
  for (const n in tk.slots) for (const id of tk.slots[n]) { const s = staffBy(id); if (s && s.energy < 30) r = Math.min(r, s.energy < 12 ? 0.6 : 0.8); }
  return r;
}

/* ---------- автораспределение: дежурные сами бегут на кнопки ---------- */
function costOf(s, tk, need) {
  let c = travelTime(s.state === 'walk' ? s.dest : s.loc, tk.loc) + (100 - s.energy) / 20;
  if (s.state === 'rest') c += 4;
  if (need === 'neo' && s.role === 'reanim') c += 8;
  return c;
}
function freePool(need, tk) {
  return S.staff.filter(s => s.role !== 'zav' && s.role !== 'pmu' && fits(s.role, need) && !s.taskId && s.state !== 'away' && (s.state !== 'rest' || tk.pri >= 3 || s.energy >= 85));
}
function dispatch() {
  const list = openTasks().filter(tk => S.t >= tk.callAt).sort((a, b) => b.pri - a.pri || a.created - b.created);
  for (const tk of list) {
    const pp = tk.pid ? pat(tk.pid) : null;
    if (pp && pp.pmu) pmuFill(tk, pp);
    const m = missing(tk);
    for (const need in m) {
      if (need === 'zav') continue;
      if (need === 'obst' && pp && pp.pmu && pp.flags.waitDoc) continue;
      if (need !== 'clean' && !S.auto) continue;
      for (let k = 0; k < m[need]; k++) {
        let c = freePool(need, tk);
        if (!c.length && tk.pri >= 3) c = S.staff.filter(s => s.role !== 'zav' && s.role !== 'pmu' && fits(s.role, need) && s.taskId && task(s.taskId) && task(s.taskId).pri <= 1 && s.state !== 'away');
        if (!c.length) break;
        c.sort((a, b) => costOf(a, tk, need) - costOf(b, tk, need));
        const s = c[0];
        if (s.taskId) { const old = task(s.taskId); note(s.name + ' ' + he(s, 'снят', 'снята') + ' с «' + (old ? old.label : '') + '» → ' + tk.label, 'warn'); }
        assign(s, tk, need);
      }
    }
  }
}
/* ручное управление (зав командует) */
function needFor(s, tk) {
  const m = missing(tk);
  const order = s.role === 'pmu' ? ['obst'] : s.role === 'zav' ? ['zav', 'obst', 'any'] : s.role === 'reanim' ? ['reanim', 'neo', 'any'] : [s.role, 'any'];
  for (const n of order) if (m[n] && fits(s.role, n)) return n;
  return null;
}
function manualAssign(staffId, taskId) {
  const s = staffBy(staffId), tk = task(taskId);
  if (!s || !tk || tk.done || s.state === 'away') return false;
  if (s.taskId === tk.id) return true;
  const need = needFor(s, tk);
  if (!need) return false;
  assign(s, tk, need);
  return true;
}
function sendRest(id) { const s = staffBy(id); if (!s || s.state === 'away') return; if (s.taskId) unassign(s); s.rest = true; s.forced = true; if (s.loc === 'ord' && s.state !== 'walk') s.state = 'rest'; else sendTo(s, 'ord'); }
function wake(id) { const s = staffBy(id); if (!s) return; s.rest = false; s.forced = false; if (s.state === 'rest') s.state = 'idle'; }
function release(id) { const s = staffBy(id); if (s && s.taskId) unassign(s); }

function staffTick() {
  const night = isNight();
  for (const s of S.staff) {
    if (s.state === 'away') { if (S.t >= s.awayUntil) { s.state = 'idle'; note(s.role === 'pmu' ? 'Врач ПМУ ' + s.name + ' ' + he(s, 'приехал', 'приехала') : s.name + ' ' + he(s, 'вернулся', 'вернулась') + ' в родблок'); } continue; }
    if (s.state === 'walk' && S.t >= s.eta) {
      s.loc = s.dest; s.dest = null;
      s.state = s.taskId ? 'work' : (s.rest && s.loc === 'ord') ? 'rest' : 'idle';
    }
    let d = s.state === 'rest' ? 0.33 * S.mod.rest : s.state === 'work' ? -0.085 : s.state === 'walk' ? -0.05 : -0.02;
    if (night && d < 0) d *= 1.5;
    if (s.role === 'zav' && d < 0) d *= 0.8;
    s.energy = Math.max(0, Math.min(100, s.energy + d));
    if (s.state === 'rest' && ((!s.forced && s.energy >= 90) || s.energy >= 100)) { s.rest = false; s.forced = false; s.state = 'idle'; }
    if (S.auto && s.role !== 'zav' && s.role !== 'pmu' && s.state === 'idle' && !s.taskId && s.energy < 25 && !s.rest) { s.rest = true; sendTo(s, 'ord'); if (s.loc === 'ord') s.state = 'rest'; }
  }
  if (S.mod.restUntil && S.t >= S.mod.restUntil) { S.mod.rest = 1; S.mod.restUntil = 0; note('Кофемашину починили', 'good'); }
}

/* ---------- задачи ---------- */
function tasksTick() {
  for (const tk of openTasks()) {
    if (tk.type === 'birth') { birthTick(tk); continue; }
    if (allPresent(tk)) {
      if (!tk.started) { tk.started = true; tk.startT = S.t; if (START[tk.type]) START[tk.type](tk); }
      tk.prog += teamRate(tk);
      if (tk.prog >= tk.dur) { finish(tk); continue; }
    }
    if (tk.deadline != null && !tk.late && !tk.started && S.t > tk.deadline) { tk.late = true; if (LATE[tk.type]) LATE[tk.type](tk); }
    if (tk.failAt != null && !tk.started && S.t >= tk.failAt && !tk.done) { if (FAIL[tk.type]) FAIL[tk.type](tk); else closeTask(tk); }
  }
  for (const id in S.T) if (S.T[id].done && S.t - S.T[id].doneT > 2) delete S.T[id];
}
function birthTick(tk) {
  const p = pat(tk.pid);
  if (!p || p.phase === 'gone') { closeTask(tk); return; }
  if (!tk.started && present(tk)) { tk.started = true; tk.startT = S.t; }
  if (p.bornT != null && S.t >= p.bornT + 10) finish(tk);
}

/* ---------- чистота ---------- */
function dirtyRooms() { return BED_IDS.filter(id => S.rooms[id].dirty); }
function callCleaning(ids) {
  let n = 0;
  for (const id of ids) {
    const r = S.rooms[id];
    if (!r || !r.dirty || r.pid || (r.cleanTask && task(r.cleanTask) && !task(r.cleanTask).done)) continue;
    const tk = addTask({ type: 'clean', loc: id, label: 'Уборка: ' + locName(id), need: { clean: 1 }, dur: isOR(id) ? 22 : 14, pri: 1 });
    r.cleanTask = tk.id; n++;
  }
  return n;
}
HANDLERS.clean = tk => { const r = S.rooms[tk.loc]; if (r) { r.dirty = false; r.cleanTask = null; S.st.cleaned++; } };
function vbiTick() {
  const n = dirtyRooms().length;
  S.vbi += n ? 0.0035 * n : -0.012;
  S.vbi = Math.max(0, Math.min(100, S.vbi));
  S.vbiPeak = Math.max(S.vbiPeak, S.vbi);
}

/* ---------- главный такт: 1 игровая минута ---------- */
function tick() {
  if (S.over) return;
  SEED = S.rng;
  S.t++;
  laterTick();
  arrivalsTick();
  queueTick();
  for (const p of livePatients()) { laborTick(p); wardTick(p); }
  placeTick();
  staffTick();
  dispatch();
  tasksTick();
  decisionsTick();
  vbiTick();
  eventsTick();
  wavesTick();
  pmuTick();
  if (S.t >= SHIFT) endShift();
  S.rng = SEED;
}
function laterTick() {
  if (!S.later.length) return;
  const due = S.later.filter(e => S.t >= e.t);
  if (!due.length) return;
  S.later = S.later.filter(e => S.t < e.t);
  for (const e of due) if (LATER[e.k]) LATER[e.k](e);
}
