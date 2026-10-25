/* ===== РОДБЛОК · движок: размещение, решения, события ===== */
function moveTo(p, loc) {
  vacate(p, false);
  p.loc = loc; S.rooms[loc].pid = p.id;
  const r = S.rooms[loc];
  if (r.cleanTask) { closeTask(task(r.cleanTask)); r.cleanTask = null; }
  for (const id of p.tasks) {
    const tk = task(id);
    if (!tk || tk.done || tk.started || tk.type === 'transfer') continue;
    tk.loc = loc;
    for (const n in tk.slots) for (const sid of tk.slots[n]) { const s = staffBy(sid); if (s) sendTo(s, loc, tk.pri >= 3); }
  }
}
function pickBox(p) {
  const from = p.loc || 'priem';
  const free = BOX_IDS.filter(id => !S.rooms[id].pid && !S.rooms[id].dirty);
  if (free.length) { free.sort((a, b) => zoneLoad(zoneOf(a)) - zoneLoad(zoneOf(b)) || travelTime(from, a) - travelTime(from, b)); return free[0]; }
  if (p.lab === 'second' || p.dil >= 9 || p.phase === 'pp') {
    const dirty = BOX_IDS.find(id => !S.rooms[id].pid);
    if (dirty) { S.vbi = Math.min(100, S.vbi + 6); S.st.dirtyUse++; p.flags.dirtyBox = true; note('Чистых боксов нет — положили в неубранный ' + locName(dirty), 'warn'); return dirty; }
  }
  return null;
}
function placeTick() {
  const live = livePatients();
  const wantOR = live.filter(p => p.want === 'or').sort((a, b) => (b.csPri - a.csPri) || (a.waitSince - b.waitSince));
  for (const p of wantOR) {
    let id = OR_IDS.find(x => !S.rooms[x].pid && !S.rooms[x].dirty);
    if (!id && p.csPri >= 3) { id = OR_IDS.find(x => !S.rooms[x].pid); if (id) { S.vbi = Math.min(100, S.vbi + 8); S.st.dirtyUse++; note('Экстренное КС в неубранной операционной', 'warn'); } }
    if (!id) { if (p.planned && S.t - p.waitSince === 180) complaint(p, 'плановое КС перенесли на вечер'); continue; }
    moveTo(p, id); p.want = null; p.phase = 'or';
    startCS(p, id);
  }
  const wantBox = live.filter(p => p.want === 'box').sort((a, b) => b.dil - a.dil);
  for (const p of wantBox) {
    const b = pickBox(p);
    if (!b) continue;
    moveTo(p, b); p.want = null;
    if (p.phase !== 'pp') p.phase = 'placed';
    onBox(p);
  }
  for (const p of live.filter(x => x.want === 'dop')) {
    const d = DOP_IDS.find(id => !S.rooms[id].pid && !S.rooms[id].dirty);
    if (!d) continue;
    moveTo(p, d); p.want = null; p.phase = 'placed';
  }
}
function onBox(p) {
  if (p.phase === 'pp') return;
  if (p.flags.pe && !p.flags.mg && !hasOpen(p, 'mg')) addTask({ type: 'mg', loc: p.loc, pid: p.id, label: 'Магния сульфат', need: { anest: 1 }, dur: 10, pri: 2, lamps: ['g'] });
  maybeEpid(p);
}
function startCS(p, orId) {
  const pri = p.csPri || 2;
  const neoRole = (pri >= 3 || p.ga < 37) ? 'reanim' : 'neo';
  addTask({ type: 'cs', loc: orId, pid: p.id, label: pri >= 3 ? 'Экстренное КС' : pri === 2 ? 'Срочное КС' : 'Плановое КС', need: { obst: 2, anest: 1, [neoRole]: 1 }, dur: 40, pri, lamps: [pri >= 3 ? 'r' : 'g'], deadline: p.csDeadline || null });
  cancelTasks(p, ['ctg', 'epid', 'vep']);
}
START.cs = tk => { const p = pat(tk.pid); if (p) p.flags.surgery = true; };
LATE.cs = tk => { if (tk.pri >= 3) { addScore(-15, 'Решение–извлечение > 30 мин'); note(locName(tk.loc) + ': бригада не собралась за 30 минут', 'bad'); } };
HANDLERS.cs = tk => {
  const p = pat(tk.pid); if (!p) return;
  if (p.bornT != null) { discharge(p); return; }
  p.extractT = (tk.startT != null ? tk.startT : S.t) + 8;
  if (p.flags.abrupt) p.abruptLate = p.extractT - p.arrived > 30;
  if (p.csPri >= 3) S.st.csEm++;
  if (p.flags.needlessCS) { S.st.csNeedless++; addScore(-10, 'КС без показаний'); blame(6, 'КС без показаний'); }
  born(p, 'cs');
  cancelTasks(p, ['birth']);
  vacate(p, true); p.phase = 'gone';
  vipResolve(p);
};

/* ---------- решения зава ---------- */
function addDecision(d) {
  d.id = ++S.uid; d.t = S.t; d.done = false;
  S.decisions.push(d);
  if (d.red) S.pauseReq = true;
  return d;
}
function closeDecisionFor(pid, kind) { for (const d of S.decisions) if (!d.done && d.pid === pid && d.kind === kind) d.done = true; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function patLine(p) { return p.name + ', ' + p.age + ' л., ' + (p.multip ? 'повторнородящая' : 'первородящая') + ', ' + p.ga + ' нед'; }
function dilText(p) {
  let s = 'раскрытие ' + Math.floor(p.dil) + ' см';
  if (p.dil >= 10) s += ', головка ' + (p.lowHead ? 'на тазовом дне' : 'прижата ко входу в таз');
  return s;
}
function decisionView(d) {
  const p = pat(d.pid); if (!p) return null;
  const where = locName(p.loc || 'priem');
  const base = { where, who: patLine(p), red: !!d.red, pop: !!d.pop };
  if (d.kind === 'pmu') return pmuView(d, p, base);
  if (d.kind === 'vipcs') return vipView(d, p, base);
  if (d.kind === 'triage') {
    const c = CASE[p.kind] || CASE.active;
    const extra = p.flags.blogger ? ' Принесла план родов на 12 листах.' : '';
    return Object.assign(base, { title: 'Куда её?', clue: c.what + '. ' + cap(dilText(p)) + '. КТГ: норма.' + extra, ctg: p.kind === 'previa' ? null : 'N', options: ROUTES.map(r => ({ k: r.k, label: r.label, ok: r.k === c.ok })), why: c.why });
  }
  if (d.kind === 'ctgS') {
    const D = DEC.ctgS;
    return Object.assign(base, { title: D.title, clue: D.clue + ' ' + cap(dilText(p)) + '.', ctg: 'S', options: D.opts.map(o => ({ k: o.k, label: o.label, ok: o.k === 'ok' })), why: D.why });
  }
  if (d.kind === 'ctgP') {
    const D = DEC.ctgP, low = p.dil >= 10 && p.lowHead;
    return Object.assign(base, { title: D.title, clue: D.clue + ' ' + cap(dilText(p)) + '.', ctg: 'P', options: D.opts.map(o => ({ k: o.k, label: o.label, ok: low ? o.k === 'vep' : o.k === 'cs' })), why: low ? D.whyLow : D.whyHigh });
  }
  if (d.kind === 'brady') {
    const low = p.dil >= 10 && p.lowHead, v = d.v || 'acute';
    const clue = (d.msg ? d.msg + ' ЧСС плода 70, 4-я минута.' : BRADY[v].clue) + ' ' + cap(dilText(p)) + '.';
    const okK = v !== 'acute' ? 'reverse' : low ? 'vep' : 'cs';
    return Object.assign(base, { title: DEC.brady.title, clue, ctg: 'B', options: DEC.brady.opts.map(o => ({ k: o.k, label: o.label, ok: o.k === okK })), why: BRADY[v].why });
  }
  if (d.kind === 'pph') {
    const v = PPH.find(x => x.k === p.pph) || PPH[0];
    return Object.assign(base, { title: 'Послеродовое кровотечение', clue: v.clue, ctg: null, options: PPH_OPTS.map(o => ({ k: o.k, label: o.label, ok: o.k === p.pph })), why: PPH_WHY });
  }
  const D = DEC[d.kind];
  if (!D) return null;
  return Object.assign(base, { title: D.title, clue: D.clue + (d.kind === 'chorio' ? ' ' + cap(dilText(p)) + '.' : ''), ctg: d.kind === 'chorio' ? 'T' : null, options: D.opts.map(o => ({ k: o.k, label: o.label, ok: o.k === 'ok' })), why: D.why });
}
function applyDecision(d, idx, byZav) {
  const v = decisionView(d);
  if (!v) { d.done = true; return null; }
  const o = v.options[idx]; if (!o) return null;
  const best = o.ok ? null : (v.options.find(x => x.ok) || {}).label || null;
  d.done = true; d.choice = o.k; d.ok = o.ok; d.byZav = byZav;
  if (byZav) { S.st.decAll++; if (o.ok) { S.st.decOk++; addScore(4); } else addScore(-8, 'Решение: ' + v.title); }
  S.review.push({ t: S.t, title: v.title, where: v.where, choice: o.label, ok: o.ok, byZav, best, why: v.why });
  if (APPLY[d.kind]) APPLY[d.kind](d, o.k, o.ok);
  return { ok: o.ok, why: v.why, best };
}
function decide(id, idx) { const d = S.decisions.find(x => x.id === id); if (!d || d.done) return null; return applyDecision(d, idx, true); }
function decisionsTick() {
  for (const d of S.decisions) {
    if (d.done) continue;
    if (d.kind === 'pmu' || d.kind === 'vipcs') { if (S.t - d.t >= 12) { const v = decisionView(d); const ak = d.kind === 'pmu' ? 'allow' : 'yes'; applyDecision(d, v ? Math.max(0, v.options.findIndex(o => o.k === ak)) : 0, false); note(d.kind === 'pmu' ? 'Врач ПМУ не дождался зава и сделал по-своему' : 'Руководство дозвонилось дежурному — пациентку повезли на КС', 'warn'); } continue; }
    const lim = d.red ? 4 : d.kind === 'triage' ? 25 : 20;
    if (S.t - d.t >= lim) {
      const v = decisionView(d);
      if (!v) { d.done = true; continue; }
      const good = v.options.findIndex(o => o.ok);
      const okP = d.red ? 0.55 : d.kind === 'triage' ? 0.8 : 0.7;
      applyDecision(d, chance(okP) && good >= 0 ? good : rint(0, v.options.length - 1), false);
      note('Зав не ответил — дежурные решили сами: ' + v.title.toLowerCase(), 'warn');
    }
  }
  if (S.decisions.length > 50) S.decisions = S.decisions.filter(d => !d.done || S.t - d.t < 30);
}
APPLY.triage = (d, k, ok) => {
  const p = pat(d.pid); if (!p || p.phase === 'gone' || p.bornT != null) return;
  if (k === 'opb') {
    vacate(p, false); p.phase = 'gone'; cancelTasks(p);
    if (['previa', 'pe', 'transverse'].includes(p.kind) || p.lab === 'active' || p.lab === 'second') S.later.push({ t: S.t + rint(30, 100), k: 'opbBad', pid: p.id });
    else if (p.lab === 'latent') S.later.push({ t: S.t + rint(150, 300), k: 'back', pid: p.id });
    return;
  }
  p.phase = 'wait'; p.want = k; p.waitSince = S.t;
  if (k === 'dop' && (p.lab === 'active' || p.lab === 'second')) p.misplaced = true;
  if (k === 'or') { p.csPri = p.kind === 'previa' ? 3 : 2; if (p.kind === 'previa') p.csDeadline = S.t + 30; if (!ok) p.flags.needlessCS = true; }
};
LATER.opbBad = e => {
  const p = pat(e.pid); if (!p) return;
  const serious = ['previa', 'pe'].includes(p.kind);
  if (serious) S.st.kas++;
  blame(serious ? 25 : 10, serious ? 'КАС в ОПБ' : 'роды в ОПБ');
  addScore(serious ? -35 : -25, 'Отправлена в ОПБ не по делу');
  note(p.name + ' в ОПБ: ' + (p.kind === 'previa' ? 'кровотечение, КАС' : p.kind === 'pe' ? 'эклампсия, КАС' : 'родила в палате ОПБ') + ' — разбор у главврача', 'bad');
};
LATER.back = e => { const p = pat(e.pid); if (!p) return; const q = makePatient('active'); q.name = p.name; q.age = p.age; note(p.name + ' вернулась — теперь уже активные роды'); };
APPLY.ctgS = (d, k) => { const p = pat(d.pid); if (!p || p.bornT != null) return; if (k === 'ok') { p.ctgCare = true; p.ctgFixAt = S.t + 20; } else if (k === 'cs') { p.flags.needlessCS = true; requestCS(p, 2); } else S.later.push({ t: S.t + 40, k: 'recallCTG', pid: p.id }); };
APPLY.ctgP = (d, k) => {
  const p = pat(d.pid); if (!p || p.bornT != null) return;
  if (k === 'vep') { if (p.dil >= 10 && p.lowHead) startVEP(p, 2); else { note('ВЭП невозможна: нет условий', 'bad'); S.later.push({ t: S.t + 10, k: 'recallCTG', pid: p.id }); } }
  else if (k === 'cs') requestCS(p, 2, 75);
  else S.later.push({ t: S.t + 25, k: 'recallCTG', pid: p.id });
};
APPLY.brady = (d, k) => {
  const p = pat(d.pid); if (!p || p.bornT != null) return;
  const v = d.v || 'acute';
  p.em = null;
  if (k === 'reverse') {
    if (v !== 'acute') { p.ctg = 'N'; p.bradyAt = null; if (v === 'hyper') p.flags.oxy = false; note(locName(p.loc) + ': ритм восстановился', 'good'); }
    else { p.reBrady = S.t + 5; note(locName(p.loc) + ': ритм не восстанавливается…', 'bad'); }
  } else if (k === 'cs') {
    if (v !== 'acute') { p.ctg = 'N'; p.bradyAt = null; p.flags.needlessCS = true; }
    requestCS(p, 3, 30);
  } else if (k === 'vep') {
    if (p.dil >= 10 && p.lowHead) { if (v !== 'acute') { p.ctg = 'N'; p.bradyAt = null; } startVEP(p, 3); }
    else { p.reBrady = S.t + 3; note('ВЭП невозможна: раскрытие неполное или головка высоко', 'bad'); }
  }
};
APPLY.pph = (d, k, ok) => { const p = pat(d.pid); if (p) p.pphOk = ok; };
APPLY.dyst = (d, k, ok) => { const p = pat(d.pid); if (p) p.dystOk = ok; };
APPLY.ecl = (d, k, ok) => { const p = pat(d.pid); if (!p) return; p.eclOk = ok; if (k === 'cs') requestCS(p, 3, 30); };
APPLY.chorio = (d, k) => { const p = pat(d.pid); if (!p) return; if (k === 'ok') p.flags.abx = true; else if (k === 'cs') { p.flags.needlessCS = true; p.flags.abx = true; requestCS(p, 2); } };

/* ---------- события ---------- */
function card(title, text, choices, k) { const c = { id: ++S.uid, type: 'event', title, text, choices: choices || null, k: k || null }; S.modals.push(c); S.pauseReq = true; return c; }
function eventsTick() {
  if (S.t >= S.ev.next && S.t < SHIFT - 60) {
    S.ev.next = S.t + rint(70, 140);
    const pool = EVENTS.filter(e => !(e.once && S.ev.used[e.k]) && !(e.max && (S.ev.used[e.k] || 0) >= e.max));
    for (let i = 0; i < 4 && pool.length; i++) {
      const e = pickW(pool);
      if (EV[e.k]() !== false) { S.ev.used[e.k] = (S.ev.used[e.k] || 0) + 1; break; }
      pool.splice(pool.indexOf(e), 1);
    }
  }
  if (S.dzm && !S.dzm.done && S.t >= S.dzm.evalT) dzmEval(false);
}
EV.moon = () => { S.mod.arrival = 1.8; S.mod.arrivalUntil = S.t + 180; card('Полнолуние', 'Акушерки предупреждали. Ближайшие 3 часа поступлений почти вдвое больше.'); };
EV.dzm = () => {
  const tk = addTask({ type: 'dzm', loc: 'priem', label: 'Встретить комиссию ДЗМ', need: { zav: 1 }, dur: 40, pri: 2, deadline: S.t + 20 });
  S.dzm = { task: tk.id, evalT: S.t + 70, done: false };
  card('Проверка ДЗМ', 'Комиссия будет в приёмном через 20 минут. Встретить должен зав лично — кнопка в лотке внизу. Грязные помещения и очередь в приёмном им не понравятся.');
};
EV.faint = () => {
  const ps = livePatients().filter(p => isBox(p.loc) && (p.lab === 'active' || p.lab === 'second'));
  if (!ps.length) return false;
  const p = pick(ps);
  addTask({ type: 'faint', loc: p.loc, pid: p.id, label: 'Муж в обмороке', need: { any: 1 }, dur: 5, pri: 1, deadline: S.t + 15, failAt: S.t + 30 });
  card('Муж в обмороке', locName(p.loc) + ': партнёр по родам прилёг рядом с пациенткой. Акушерке ' + MIDWIVES[zoneOf(p.loc)] + ' нужен кто-нибудь с нашатырём.');
};
EV.blogger = () => { S.nextBlogger = true; card('Блогерша едет', 'Следующая пациентка — с планом родов на 12 листах и кольцевой лампой. Осмотр будет долгим, жалоба — громкой, хорошие роды — бесплатной рекламой.'); };
EV.lift = () => {
  const p = makePatient('lift', true);
  p.loc = 'priem'; p.phase = 'placed'; p.flags.lift = true;
  callBirth(p);
  card('Роды в лифте', 'Повторнородящая не доехала до родблока. Нужны акушер и неонатолог в приёмном — бегом.');
};
EV.amb = () => { for (let i = 0; i < 3; i++) newArrival(); card('Три скорые разом', 'В приёмном сразу три пациентки. Мест в распреде — два.'); };
EV.coffee = () => { S.mod.rest = 0.5; S.mod.restUntil = S.t + 240; card('Сломалась кофемашина', 'Ближайшие 4 часа отдых в ординаторской вдвое менее эффективен.'); };
EV.cake = () => { for (const s of S.staff) s.energy = Math.min(100, s.energy + 20); card('Торт от благодарной пациентки', 'Вся смена приободрилась: +20 к бодрости.'); };
EV.anest = () => {
  const c = S.staff.filter(s => s.role === 'anest' && s.state !== 'away' && !(s.taskId && task(s.taskId) && task(s.taskId).pri >= 3));
  if (!c.length) return false;
  const s = pick(c);
  if (s.taskId) unassign(s);
  s.state = 'away'; s.awayUntil = S.t + 60; s.rest = false; s.forced = false;
  card('Анестезиолога забрали', s.name + ' ' + he(s, 'ушёл', 'ушла') + ' в общую реанимацию на час. В родблоке остаётся двое анестезиологов.');
};
EV.doula = () => {
  const z = rint(0, 3);
  S.slow[z] = S.t + 120;
  addTask({ type: 'doula', loc: 'box' + (z * 5 + 1), label: 'Разрулить доулу (зона ' + ZONES[z] + ')', need: { zav: 1 }, dur: 10, pri: 1, zone: z, failAt: S.t + 120 });
  card('Доула против акушерки', 'Зона ' + ZONES[z] + ': доула спорит с акушеркой ' + MIDWIVES[z] + '. Пока зав не придёт, вызовы из этой зоны идут с опозданием.');
};
EV.abruption = () => {
  if (S.rooms.orP.pid) return false;
  const p = makePatient('abrupt', true);
  p.loc = 'orP'; S.rooms.orP.pid = p.id; p.phase = 'or'; p.flags.abrupt = true; p.csPri = 3; p.csDeadline = S.t + 30;
  if (S.rooms.orP.dirty) { S.vbi = Math.min(100, S.vbi + 8); S.st.dirtyUse++; }
  startCS(p, 'orP');
  card('Отслойка с улицы', 'Скорая везёт пациентку с отслойкой плаценты сразу в операционную приёмного. Нужны два акушера, анестезиолог и реаниматолог. Решение–извлечение — не больше 30 минут.');
};
EV.mil = () => { card('Свекровь в приёмном', 'Требует заведующего и «нормального врача, а не этого».', ['Выйти и поговорить', 'Передать через охрану'], 'mil'); };
function eventChoice(id, idx) {
  const c = S.modals.find(m => m.id === id);
  if (!c) return;
  c.chosen = idx;
  if (c.k === 'vipcall') vipCallChoice(c, idx);
  if (c.k === 'atata') atataChoice(idx);
  if (c.k === 'meeting') meetingChoice(idx);
  if (c.k === 'mil') {
    if (idx === 0) addTask({ type: 'mil', loc: 'priem', label: 'Поговорить со свекровью', need: { zav: 1 }, dur: 15, pri: 1, deadline: S.t + 30, failAt: S.t + 90 });
    else if (chance(0.5)) complaint(null, 'свекровь написала в ДЗМ');
    else note('Свекровь ушла ругаться на парковку', 'good');
  }
}
HANDLERS.mil = () => { addScore(8, 'Свекровь успокоена'); note('Свекровь успокоилась и пошла за пирожками', 'good'); };
LATE.mil = () => complaint(null, 'свекровь не дождалась зава');
HANDLERS.doula = tk => { S.slow[tk.zone] = 0; addScore(5, 'Доула нейтрализована'); note('Зав разрулил: доула пьёт чай в коридоре', 'good'); };
HANDLERS.faint = () => note('Муж пришёл в себя. Нашатырь 1 : 0 муж', 'good');
LATE.faint = tk => complaint(pat(tk.pid), 'мужу стало плохо, никто не подошёл');
HANDLERS.dzm = () => dzmEval(true);
LATE.dzm = () => { addScore(-20, 'Комиссию встретил охранник'); note('Комиссию ДЗМ встретил охранник. Зава нигде нет', 'bad'); };
function dzmEval(withZav) {
  if (!S.dzm || S.dzm.done) return;
  S.dzm.done = true;
  const tk = task(S.dzm.task); if (tk && !tk.done) closeTask(tk);
  const dirty = dirtyRooms().length, q = S.queue.length;
  const pts = (withZav ? 15 : 0) + 25 - dirty * 7 - q * 6;
  addScore(pts, 'Итог проверки ДЗМ');
  if (pts < 0) blame(20, 'предписание ДЗМ');
  note('Комиссия ДЗМ: грязных помещений ' + dirty + ', в очереди ' + q + ' — ' + (pts >= 0 ? 'уехали довольные' : 'будет предписание'), pts >= 0 ? 'good' : 'bad');
}

/* ---------- конец смены ---------- */
const GRADES = [
  { min: 750, stars: 3, title: 'Зав года' },
  { min: 450, stars: 2, title: 'Нормальные сутки' },
  { min: 150, stars: 1, title: 'Объяснительная главврачу' },
  { min: -1e9, stars: 0, title: 'Комиссия ДЗМ в понедельник' },
];
function endShift() {
  S.over = true;
  const st = S.st, csRate = st.births ? st.cs / st.births : 0, bonus = [];
  if (st.births >= 12 && csRate <= 0.25) { addScore(30, 'Доля КС ≤ 25%'); bonus.push('Доля КС ≤ 25%'); }
  if (S.vbiPeak < 20) { addScore(20, 'ВБИ под контролем'); bonus.push('ВБИ ниже 20 всю смену'); }
  if (st.asph === 0 && st.kas === 0) { addScore(25, 'Без КАС и асфиксий'); bonus.push('Ни одного КАС и асфиксии'); }
  if (S.waves && st.bossWon === S.waves.length) { addScore(30, 'Все боссы повержены'); bonus.push('Все боссы повержены'); }
  const g = GRADES.find(x => S.score >= x.min);
  S.final = { csRate, bonus, left: livePatients().length, stars: g.stars, title: g.title };
  S.modals.push({ id: ++S.uid, type: 'report' });
  S.pauseReq = true;
}
if (typeof module !== 'undefined') module.exports = { get S() { return S; }, newGame, tick, decide, decisionView, eventChoice, callCleaning, dirtyRooms, manualAssign, sendRest, wake, release, openTasks, livePatients, missing, task, pat, staffBy };
