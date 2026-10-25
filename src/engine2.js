/* ===== РОДБЛОК · движок: пациентки и роды ===== */
function makePatient(kind, noQueue) {
  const c = CASE[kind] || CASE.active;
  const multip = (kind === 'lift' || kind === 'push') ? chance(0.85) : chance(0.5);
  const p = {
    id: ++S.uid, name: pick(SURN), age: rint(19, 42), multip, para: multip ? rint(1, 3) : 0,
    ga: kind === 'preterm' ? rint(32, 35) : rint(37, 41), kind,
    dil: rint(c.dil[0], c.dil[1]), phase: noQueue ? 'placed' : 'queue', loc: noQueue ? null : 'priem',
    want: null, ctg: 'N', ctgT: 0, flags: {}, arrived: S.t, labStart: S.t, waitSince: S.t,
    latRate: 0.35 + rnd() * 0.45, actRate: multip ? 1.6 + rnd() * 1.1 : 1.0 + rnd() * 0.7,
    secondDur: multip ? rint(12, 30) : rint(35, 75), lowHead: chance(multip ? 0.85 : 0.7), big: chance(0.08),
    girl: chance(0.5), apgar: null, bornT: null, mode: null, tasks: [], lab: 'none', csPri: 0,
  };
  p.flags.mec = chance(0.1);
  if (kind === 'prom') { p.flags.prom = true; p.latRate = 0.15; }
  if (kind === 'pe') p.flags.pe = true;
  if (kind === 'transverse') p.lowHead = false;
  if ((kind === 'active' || kind === 'latent') && chance(0.22)) p.flags.oxy = true;
  initLab(p);
  S.P[p.id] = p;
  if (!noQueue) { S.queue.push(p.id); S.st.arrivals++; }
  assignPMU(p);
  assignVIP(p);
  return p;
}
function initLab(p) {
  if (['false', 'planned', 'previa', 'abrupt'].includes(p.kind)) p.lab = 'none';
  else if (p.dil >= 10) { p.lab = 'second'; p.secondStart = S.t; p.secondEnd = S.t + (p.kind === 'lift' ? 7 : rint(15, 30)); }
  else if (p.dil >= 5) p.lab = 'active';
  else p.lab = 'latent';
}
function handover() {
  const put = (kind, loc, dil, fn) => {
    const p = makePatient(kind, true);
    p.dil = dil; initLab(p);
    p.loc = loc; S.rooms[loc].pid = p.id; p.arrived = -rint(60, 360); p.labStart = p.arrived;
    if (fn) fn(p);
    return p;
  };
  put('active', 'box2', 6, p => { p.flags.epid = true; p.epidAt = -60; p.epidAsked = true; });
  put('active', 'box4', 8, p => { p.epidAsked = true; });
  put('active', 'box7', 7, p => { p.flags.oxy = true; p.epidAsked = true; });
  put('active', 'box9', 9, p => { p.multip = true; p.secondDur = 20; p.epidAsked = true; });
  put('active', 'box12', 5);
  put('pe', 'box14', 6, p => { p.flags.mg = true; p.epidAsked = true; });
  put('active', 'box17', 10, p => { p.secondStart = -10; p.secondEnd = 22; p.epidAsked = true; });
  put('active', 'box18', 10, p => { p.lab = 'born'; p.phase = 'pp'; p.bornT = -40; p.mode = 'vag'; p.apgar = 8; p.ppEnd = 80; });
  put('latent', 'dop0', 3);
  put('prom', 'dop1', 1, p => { p.arrived = -150; });
  S.rooms.box5.dirty = true; S.rooms.box11.dirty = true; S.rooms.or2.dirty = true;
  S.planned = [60, 150, 270].map(t => ({ t, sent: false, why: pick(PLANNED_WHY) }));
  makePatient(pickW(CASES).k);
}

/* ---------- поток ---------- */
function newArrival(kind) {
  const c = kind ? CASE[kind] : pickW(CASES);
  const p = makePatient(c.k);
  if (S.nextBlogger) { p.flags.blogger = true; S.nextBlogger = false; }
  note('В приёмное поступила ' + p.name + (p.flags.blogger ? ' (с кольцевой лампой)' : ''));
  return p;
}
function arrivalsTick() {
  if (S.mod.arrivalUntil && S.t >= S.mod.arrivalUntil) { S.mod.arrival = 1; S.mod.arrivalUntil = 0; note('Полнолуние отпустило', 'good'); }
  if (S.t < SHIFT - 10 && chance(1.25 * diurnal() * S.mod.arrival / 60)) newArrival();
  for (const pl of S.planned) if (!pl.sent && S.t >= pl.t) {
    pl.sent = true;
    const p = makePatient('planned', true);
    p.phase = 'wait'; p.want = 'or'; p.csPri = 1; p.planned = pl.why; p.waitSince = S.t; p.ga = rint(38, 40); p.dil = 0;
    note('Плановое КС (' + pl.why + '): ' + p.name + ' ждёт операционную');
  }
}
function queueTick() {
  S.st.maxQueue = Math.max(S.st.maxQueue, S.queue.length);
  for (const rid of RASPRED_IDS) {
    if (!S.queue.length) break;
    const r = S.rooms[rid];
    if (r.pid) continue;
    const p = pat(S.queue.shift());
    if (!p || p.phase !== 'queue') continue;
    p.loc = rid; r.pid = p.id; p.phase = 'triage';
    addTask({ type: 'triage', loc: rid, pid: p.id, label: 'Осмотр в распреде', need: { obst: 1 }, dur: p.flags.blogger ? 20 : 8, pri: p.lab === 'second' ? 3 : 2, lamps: ['g'], callAt: S.t + mwDelay('rd') });
  }
  for (const id of S.queue) { const p = pat(id); if (p && S.t - p.arrived === 60) complaint(p, 'час в очереди в приёмном'); if (p && p.vip && S.t - p.arrived === 25) vipHit(p, 'ждала в приёмном'); }
}
HANDLERS.triage = tk => { const p = pat(tk.pid); if (!p || p.bornT != null || p.phase === 'gone') return; p.phase = 'await'; addDecision({ kind: 'triage', pid: p.id }); };
function mwDelay(z) {
  let d = rint(0, 2);
  if (z !== 'rd' && zoneLoad(z) > 3) d += rint(1, 4);
  if (S.slow[z] && S.t < S.slow[z]) d += rint(2, 5);
  return d;
}
function zoneLoad(z) { let n = 0; for (const id of BOX_IDS) if (zoneOf(id) === z && S.rooms[id].pid) n++; return n; }
function complaint(p, reason) {
  S.st.complaints++;
  const pen = p && p.flags.blogger ? 30 : p && p.flags.contract ? 25 : 15;
  addScore(-pen, 'Жалоба: ' + reason);
  if (p) p.flags.complained = true;
  if (p && p.vip) vipHit(p, 'жалоба пациентки');
  note('Жалоба: ' + reason + (p && p.flags.blogger ? ' — и пост в соцсетях' : ''), 'bad');
}

/* ---------- роды ---------- */
function laborTick(p) {
  if (p.phase === 'gone' || p.phase === 'dyst' || p.flags.surgery) return;
  const inBed = p.loc && p.loc !== 'priem';
  if (p.reBrady && S.t >= p.reBrady && !p.em && p.bornT == null) { p.reBrady = null; startBrady(p, 'acute', 'Ритм так и не восстановился!'); }
  if (p.lab === 'latent') {
    p.dil += p.latRate / 60;
    if (p.flags.prom && !p.flags.induced && S.t - p.arrived >= 240 && inBed) { p.flags.induced = true; p.flags.oxy = true; p.latRate = 0.7; note(p.name + ': начата индукция родов'); }
    if (p.dil >= 5) { p.dil = 5; p.lab = 'active'; if (isBox(p.loc)) maybeEpid(p); }
    if (inBed) chorioCheck(p);
  } else if (p.lab === 'active') {
    p.dil = Math.min(10, p.dil + p.actRate / 60 * (p.flags.epid ? 0.92 : 1));
    if (p.kind === 'transverse' && p.dil >= 8 && !p.flags.prolapse) { p.flags.prolapse = true; startBrady(p, 'acute', 'Выпадение петель пуповины при поперечном положении!'); }
    if (isBox(p.loc)) ctgTick(p);
    if (inBed) { chorioCheck(p); eclCheck(p); }
    if (p.dil >= 10) { p.dil = 10; p.lab = 'second'; p.secondStart = S.t; p.secondEnd = S.t + p.secondDur; }
  } else if (p.lab === 'second') {
    if (isBox(p.loc)) ctgTick(p);
    if (inBed) eclCheck(p);
    if (!p.birthTask && S.t >= p.secondEnd - 15) callBirth(p);
    if (S.t >= p.secondEnd && !p.em) deliver(p);
  }
  if (p.phase === 'pp') ppTick(p);
}
function wardTick(p) {
  if (p.phase !== 'placed') return;
  if (DOP_IDS.includes(p.loc) && (p.lab === 'active' || p.lab === 'second') && !p.want) {
    if (!p.transferAt) p.transferAt = S.t + (p.misplaced ? rint(30, 60) : rint(3, 10));
    if (S.t >= p.transferAt) { p.want = 'box'; p.transferAt = null; }
  }
  if (p.kind === 'false' && S.t - p.waitSince > 180) { vacate(p, false); p.phase = 'gone'; cancelTasks(p); addScore(-5, 'Ложные схватки заняли место'); note(p.name + ' переведена в ОПБ: родов так и нет'); }
  if (p.kind === 'previa' && (isBox(p.loc) || DOP_IDS.includes(p.loc)) && !p.flags.bled && S.t - p.waitSince > 20) { p.flags.bled = true; startBrady(p, 'acute', 'Кровотечение при предлежании плаценты!'); }
}
function callBirth(p) {
  const risk = p.ga < 37 || p.flags.mec || p.ctg !== 'N' || p.flags.chorio;
  const tk = addTask({ type: 'birth', loc: p.loc || 'priem', pid: p.id, label: 'Роды', need: risk ? { obst: 1, reanim: 1 } : { obst: 1, neo: 1 }, pri: p.flags.lift ? 3 : 2, lamps: ['g', 'y'], callAt: S.t + mwDelay(zoneOf(p.loc)), deadline: p.secondEnd });
  p.birthTask = tk.id;
}
function deliver(p) {
  if (p.bornT != null) return;
  cancelTasks(p, ['vep', 'ctg', 'epid', 'cs', 'chorio', 'mg']);
  if (p.want === 'or') p.want = null;
  const tk = p.birthTask ? task(p.birthTask) : null;
  p.obstAt = present(tk, ['obst', 'zav', 'pmu']);
  p.neoAt = present(tk, ['neo', 'reanim']);
  const where = p.loc || 'priem';
  const shop = p.shopUntil && S.t < p.shopUntil;
  if (shop) { p.obstAt = false; p.neoAt = false; S.st.palata++; p.flags.outside = true; addScore(-20, 'Роды по дороге из магазина'); note(p.name + ' родила в такси по дороге из магазина!', 'bad'); complaint(p, 'в родах отпустили в магазин'); }
  else if (!isBox(where) && !isOR(where) && !p.flags.lift) {
    S.st.palata++; p.flags.outside = true; addScore(-20, 'Роды вне бокса'); vipHit(p, 'роды вне бокса');
    note('Роды прямо здесь: ' + locName(where) + '!', 'bad');
    if (S.rooms[where]) S.rooms[where].dirtyAfter = true;
  }
  if (!p.obstAt) { S.st.noDoc++; addScore(-6, 'Роды без врача'); vipHit(p, 'роды без врача'); note(locName(where) + ': роды приняла акушерка, врача не было', 'warn'); }
  if (p.flags.kristeller) addScore(-10, 'Приём Кристеллера');
  if (chance(0.012 + (p.big ? 0.06 : 0) + (p.flags.kristeller ? 0.05 : 0))) { startDyst(p); return; }
  born(p, 'vag');
}
function born(p, mode) {
  p.bornT = S.t; p.mode = mode; p.lab = 'born';
  const qi = S.queue.indexOf(p.id); if (qi >= 0) S.queue.splice(qi, 1);
  for (const d of S.decisions) if (!d.done && d.pid === p.id && d.kind !== 'pph') d.done = true;
  S.st.births++;
  if (mode === 'vag') S.st.vag++; else if (mode === 'vep') S.st.vep++; else S.st.cs++;
  addScore(6);
  const a = apgar(p); p.apgar = a;
  p.weight = p.ga < 35 ? rint(1900, 2600) : p.big ? rint(4200, 4650) : rint(2850, 4050);
  note(locName(p.loc || 'priem') + ': ' + (p.girl ? 'девочка' : 'мальчик') + ' ' + p.weight + ' г, Апгар ' + a + '/' + Math.min(10, a + (a < 7 ? 2 : 1)), a >= 7 ? 'good' : 'bad');
  if (a < 7) startResus(p);
  else if (p.ga <= 34 || (p.flags.chorio && !p.flags.abx)) transferBaby(p);
  if (p.flags.contract) { S.st.pmuBirths++; if (a >= 7 && !p.flags.complained) addScore(8, 'Довольная контрактная пациентка'); }
  if (p.flags.blogger && a >= 7 && !p.flags.complained) { addScore(25, 'Сторис блогерши'); note('Блогерша выложила сторис «лучший роддом Москвы»', 'good'); }
  if (mode !== 'cs') {
    p.phase = 'pp'; p.ppEnd = S.t + 120; pphRoll(p);
    if (!isBox(p.loc) && !isOR(p.loc)) p.want = 'box';
  }
}
function apgar(p) {
  const tD = p.extractT != null ? p.extractT : S.t;
  let a = chance(0.45) ? 9 : 8;
  if (p.ctg === 'S') a -= 1;
  if (p.ctg === 'P') a -= 2;
  if (p.bradyAt != null) { const dt = tD - p.bradyAt; a -= dt <= 12 ? 1 : dt <= 25 ? 3 : 5; }
  if (p.ga < 34) a -= 2; else if (p.ga < 37) a -= 1;
  if (p.flags.mec && p.ctg !== 'N') a -= 1;
  if (p.flags.chorio && !p.flags.abx) a -= 2;
  if (p.flags.dystBad) a -= 4;
  if (p.flags.abrupt) a -= p.abruptLate ? 4 : 2;
  if (p.flags.ecl && !p.eclOk) a -= 2;
  if (p.flags.kristeller) a -= 1;
  return Math.max(1, Math.min(9, a));
}
function startResus(p) {
  addTask({ type: 'resus', loc: p.loc || 'priem', pid: p.id, label: 'Реанимация новорождённого', need: { reanim: 1 }, dur: 10, pri: 3, lamps: ['r'], deadline: S.t + 3, failAt: S.t + 12 });
}
LATE.resus = tk => { const p = pat(tk.pid); if (p && !p.flags.asph) { p.flags.asph = true; S.st.asph++; addScore(-40, 'Асфиксия: реаниматолог опоздал'); vipHit(p, 'асфиксия новорождённого'); note('Реаниматолог не успел — асфиксия новорождённого!', 'bad'); } };
FAIL.resus = tk => { closeTask(tk); const p = pat(tk.pid); if (p) transferBaby(p); };
HANDLERS.resus = tk => { const p = pat(tk.pid); if (p) transferBaby(p); };
function transferBaby(p) { S.st.oritn++; addTask({ type: 'transfer', loc: 'oritn', pid: p.id, label: 'Малыш в ОРИТН', need: { reanim: 1 }, dur: 6, pri: 2, failAt: S.t + 90 }); }
FAIL.transfer = tk => closeTask(tk);

/* ---------- послеродовый период ---------- */
function ppTick(p) {
  if (p.pphAt != null && S.t >= p.pphAt && !p.pphDone && !p.pphActive) startPPH(p);
  if (S.t >= p.ppEnd && !p.pphActive && p.want !== 'box') discharge(p);
  else if (S.t >= p.ppEnd + 30 && !p.pphActive) discharge(p);
}
function vacate(p, dirty) {
  const r = p.loc && S.rooms[p.loc];
  if (r && r.pid === p.id) { r.pid = null; if (dirty || r.dirtyAfter) { r.dirty = true; r.dirtyAfter = false; } }
}
function discharge(p) { vacate(p, isBox(p.loc) || isOR(p.loc)); p.phase = 'gone'; p.want = null; cancelTasks(p, null, ['transfer', 'resus']); vipResolve(p); }
function pphRoll(p) {
  const long = p.bornT - p.labStart > 720;
  const r = 0.055 + (p.para >= 3 ? 0.04 : 0) + (p.big ? 0.03 : 0) + (p.flags.chorio ? 0.05 : 0) + (long ? 0.04 : 0) + (p.flags.oxy ? 0.02 : 0);
  if (chance(r)) p.pphAt = S.t + rint(4, 45);
}
function startPPH(p) {
  p.pphActive = true; p.pph = pickW(PPH).k; S.st.pph++;
  addTask({ type: 'pph', loc: p.loc || 'priem', pid: p.id, label: 'ПРК', need: { obst: 1, anest: 1 }, dur: 18, pri: 3, lamps: ['r'], deadline: S.t + 10, failAt: S.t + 25, callAt: S.t + mwDelay(zoneOf(p.loc)) });
  addDecision({ kind: 'pph', pid: p.id, red: true });
  note(locName(p.loc || 'priem') + ': послеродовое кровотечение!', 'bad');
}
HANDLERS.pph = tk => {
  const p = pat(tk.pid); if (!p) return;
  if (p.pphOk == null) { p.pphOk = p.pph === 'tone'; closeDecisionFor(p.id, 'pph'); }
  const inTime = tk.startT != null && tk.startT <= tk.deadline;
  if (p.pphOk && inTime) note(locName(p.loc) + ': кровотечение остановлено, ~900 мл', 'good');
  else { S.st.kas++; addScore(-35, 'КАС: массивная кровопотеря'); vipHit(p, 'КАС'); note(locName(p.loc) + ': кровопотеря 1800 мл — КАС, перевод в ОРИТ', 'bad'); }
  p.pphActive = false; p.pphDone = true;
};
FAIL.pph = tk => { const p = pat(tk.pid); if (p) p.pphOk = false; tk.startT = null; finish(tk); };

/* ---------- КТГ и экстренные ---------- */
function ctgTick(p) {
  if (p.em || p.bornT != null || (p.shopUntil && S.t < p.shopUntil)) return;
  if (p.ctgFixAt && S.t >= p.ctgFixAt) { p.ctgFixAt = null; if (p.ctg === 'S' && chance(0.8)) { p.ctg = 'N'; p.ctgCare = false; note(locName(p.loc) + ': КТГ нормализовалась', 'good'); } }
  let hz = 0.00008;
  if (p.flags.epid && S.t - p.epidAt < 25) hz += 0.0012;
  if (p.flags.oxy) hz += 0.00025;
  if (p.flags.oxyMax) hz += 0.0012;
  if (p.ctg === 'P') hz += 0.0025;
  if (chance(hz)) { startBrady(p); return; }
  if (p.ctg === 'N' && chance(0.0011)) { p.ctg = 'S'; p.ctgT = S.t; callCTG(p); }
  else if (p.ctg === 'S' && chance(p.ctgCare ? 0.0004 : (S.t - p.ctgT > 30 ? 0.004 : 0.0015))) { p.ctg = 'P'; p.ctgT = S.t; callCTG(p); }
}
function hasOpen(p, type) { return p.tasks.some(id => { const t = task(id); return t && !t.done && t.type === type; }); }
function callCTG(p) {
  if (hasOpen(p, 'ctg') || p.flags.noCtg) return;
  addTask({ type: 'ctg', loc: p.loc, pid: p.id, label: 'Посмотреть КТГ', need: { obst: 1 }, dur: 5, pri: p.ctg === 'P' ? 2 : 1, lamps: ['g'], callAt: S.t + mwDelay(zoneOf(p.loc)) });
}
HANDLERS.ctg = tk => { const p = pat(tk.pid); if (!p || p.bornT != null || p.em) return; if (p.ctg === 'S' || p.ctg === 'P') addDecision({ kind: p.ctg === 'S' ? 'ctgS' : 'ctgP', pid: p.id }); };
LATER.recallCTG = e => { const p = pat(e.pid); if (p && p.bornT == null && p.phase !== 'gone' && (p.ctg === 'P' || p.ctg === 'S') && !p.em) callCTG(p); };
function startBrady(p, variant, msg) {
  const v = variant || (p.flags.epid && S.t - p.epidAt < 25 ? 'hypo' : p.flags.oxy && chance(0.6) ? 'hyper' : 'acute');
  p.em = { type: 'brady', v };
  if (p.bradyAt == null) p.bradyAt = S.t;
  p.ctg = 'B';
  cancelTasks(p, ['ctg']);
  addTask({ type: 'brady', loc: p.loc, pid: p.id, label: 'Брадикардия', need: { obst: 1, anest: 1, reanim: 1 }, dur: 4, pri: 3, lamps: ['r'], callAt: S.t + 1, failAt: S.t + 20 });
  addDecision({ kind: 'brady', pid: p.id, red: true, v, msg: msg || null });
  note(locName(p.loc) + ': ' + (msg || 'брадикардия плода!'), 'bad');
}
function requestCS(p, pri, dd) {
  p.want = 'or'; p.csPri = Math.max(p.csPri || 0, pri); p.waitSince = S.t;
  if (dd) p.csDeadline = S.t + dd;
  cancelTasks(p, ['ctg', 'epid', 'vep']);
}
function startVEP(p, pri) {
  if (hasOpen(p, 'vep')) return;
  addTask({ type: 'vep', loc: p.loc, pid: p.id, label: 'ВЭП', need: { obst: 1, reanim: 1 }, dur: 8, pri, lamps: pri >= 3 ? ['r'] : ['g', 'y'] });
}
HANDLERS.vep = tk => { const p = pat(tk.pid); if (!p || p.bornT != null) return; p.obstAt = true; p.neoAt = true; born(p, 'vep'); };
function startDyst(p) {
  p.phase = 'dyst'; p.em = { type: 'dyst' }; S.st.dyst++;
  addTask({ type: 'dyst', loc: p.loc || 'priem', pid: p.id, label: 'Дистоция плечиков', need: { obst: 1, reanim: 1 }, dur: 3, pri: 3, lamps: ['r'], deadline: S.t + 4, failAt: S.t + 8 });
  addDecision({ kind: 'dyst', pid: p.id, red: true });
  note(locName(p.loc || 'priem') + ': дистоция плечиков!', 'bad');
}
HANDLERS.dyst = tk => {
  const p = pat(tk.pid); if (!p) return;
  if (p.dystOk == null) { p.dystOk = chance(0.7); closeDecisionFor(p.id, 'dyst'); }
  const inTime = tk.startT != null && tk.startT <= tk.deadline + 1;
  if (!(p.dystOk && inTime)) { p.flags.dystBad = true; addScore(-20, 'Травма при дистоции'); }
  p.em = null; p.phase = 'placed';
  born(p, 'vag');
};
FAIL.dyst = tk => { const p = pat(tk.pid); if (p) p.dystOk = false; tk.startT = null; finish(tk); };
function eclCheck(p) {
  if (!p.flags.pe || p.flags.eclNow || p.bornT != null) return;
  if (chance(p.flags.mg ? 0.00006 : 0.0006)) {
    p.flags.eclNow = true; p.flags.ecl = true; p.em = { type: 'ecl' };
    addTask({ type: 'ecl', loc: p.loc, pid: p.id, label: 'Эклампсия', need: { obst: 1, anest: 1 }, dur: 12, pri: 3, lamps: ['r'], deadline: S.t + 6, failAt: S.t + 20 });
    addDecision({ kind: 'ecl', pid: p.id, red: true });
    note(locName(p.loc) + ': судороги — эклампсия!', 'bad');
  }
}
HANDLERS.ecl = tk => {
  const p = pat(tk.pid); if (!p) return;
  if (p.eclOk == null) { p.eclOk = chance(0.6); closeDecisionFor(p.id, 'ecl'); }
  if (p.eclOk) note(locName(p.loc) + ': эклампсия купирована, состояние стабилизировано', 'good');
  else { S.st.kas++; addScore(-30, 'КАС: эклампсия'); vipHit(p, 'КАС'); note(locName(p.loc) + ': КАС — эклампсия без стабилизации', 'bad'); }
  p.flags.mg = true; p.em = null; p.flags.eclNow = false;
};
FAIL.ecl = tk => { const p = pat(tk.pid); if (p) p.eclOk = false; finish(tk); };
function chorioCheck(p) {
  if (p.flags.chorio || p.bornT != null) return;
  const hours = (S.t - p.labStart) / 60;
  const hz = 0.00003 + S.vbi * 0.000012 + (p.flags.prom ? 0.00015 : 0) + (p.flags.dirtyBox ? 0.0005 : 0) + (hours > 12 ? 0.0001 : 0);
  if (chance(hz)) {
    p.flags.chorio = true; S.st.chorio++;
    addTask({ type: 'chorio', loc: p.loc, pid: p.id, label: 'Температура 38,7', need: { obst: 1 }, dur: 6, pri: 2, lamps: ['g'], callAt: S.t + mwDelay(zoneOf(p.loc)) });
    note(locName(p.loc) + ': t 38,7 °C — похоже на хориоамнионит', 'warn');
  }
}
HANDLERS.chorio = tk => { const p = pat(tk.pid); if (!p) return; if (p.bornT == null && p.phase !== 'gone') addDecision({ kind: 'chorio', pid: p.id }); else p.flags.abx = true; };
function maybeEpid(p) {
  if (p.epidAsked || p.lab !== 'active' || p.dil >= 8 || !isBox(p.loc)) return;
  p.epidAsked = true;
  if (chance(0.6)) addTask({ type: 'epid', loc: p.loc, pid: p.id, label: 'Эпидуральная анальгезия', need: { anest: 1 }, dur: 15, pri: 1, deadline: S.t + 40 });
}
HANDLERS.epid = tk => { const p = pat(tk.pid); if (p && p.bornT == null) { p.flags.epid = true; p.epidAt = S.t; } };
LATE.epid = tk => { const p = pat(tk.pid); if (p) complaint(p, 'долго ждала обезболивания'); };
HANDLERS.mg = tk => { const p = pat(tk.pid); if (p) p.flags.mg = true; };
