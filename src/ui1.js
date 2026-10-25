/* ===== РОДБЛОК · интерфейс: план этажа ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UI = { speed: 0, prevSpeed: 1, built: false, open: null, modal: null, autoPaused: false, msPerMin: 500, seenNote: 0, dirty: true, deferred: {}, shownModals: {}, down: false, lastSheet: 0, started: false, tokPos: {} };
function setHTML(el, h) { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } }
function setCls(el, c) { if (el && el.className !== c) el.className = c; }

function buildBoard() {
  $('boxes').innerHTML = BOX_IDS.map(id => `<div class="box" id="r-${id}" data-act="room" data-loc="${id}" tabindex="0"></div>`).join('') + '<div class="box post" id="r-post" data-act="post" data-loc="post" tabindex="0"></div>';
  $('beds-raspred').innerHTML = RASPRED_IDS.map(id => `<div class="bed" id="r-${id}" data-act="room" data-loc="${id}" tabindex="0"></div>`).join('');
  $('beds-dop').innerHTML = DOP_IDS.map(id => `<div class="bed" id="r-${id}" data-act="room" data-loc="${id}" tabindex="0"></div>`).join('');
  $('tokens').innerHTML = S.staff.map(s => `<div class="tok ${s.role}" id="t-${s.id}" data-act="staff" data-id="${s.id}" title="${esc(s.name)}">${s.short}</div>`).join('');
  UI.tokPos = {};
  UI.built = true;
}
function shortLoc(id) {
  if (!id) return 'ОПБ';
  if (id.startsWith('box')) return 'Б' + id.slice(3);
  if (id.startsWith('dop')) return 'Доп';
  if (id.startsWith('raspred')) return 'Распред';
  return { orP: 'ОР приём.', or1: 'ОР 1', or2: 'ОР 2', priem: 'Приёмное', oritn: 'ОРИТН', ord: 'Ординат.', post: 'Пост' }[id] || id;
}
function teamOf(tk, roles) { const out = []; for (const n in tk.slots) for (const id of tk.slots[n]) { const s = staffBy(id); if (s && (!roles || roles.includes(s.role))) out.push(s); } return out; }
function lampState(loc) {
  const L = { g: '', y: '', r: '' };
  for (const tk of openTasks()) {
    if (tk.loc !== loc || !tk.lamps.length || S.t < tk.callAt) continue;
    for (const c of tk.lamps) {
      let roles = null;
      if (c === 'g' && (tk.need.obst || tk.need.zav)) roles = ['obst', 'zav'];
      if (c === 'y' && (tk.need.neo || tk.need.reanim)) roles = ['neo', 'reanim'];
      const team = teamOf(tk, roles);
      const answered = roles ? team.some(s => s.state === 'work' && s.loc === tk.loc) : tk.started;
      if (answered) continue;
      const st = team.length ? 'on' : 'on blink';
      if (L[c] !== 'on blink') L[c] = st;
    }
  }
  return L;
}
const lampHTML = L => `<span class="lamps"><i class="lamp g ${L.g}"></i><i class="lamp y ${L.y}"></i><i class="lamp r ${L.r}"></i></span>`;
function ptChip(p, sm) {
  let cls = 'pt', txt = Math.floor(p.dil);
  if (p.lab === 'latent' || p.lab === 'none') cls += ' lat';
  if (p.lab === 'second') { cls += ' sec'; txt = 'П'; }
  if (p.phase === 'pp' || p.lab === 'born') { cls += ' pp'; txt = 'п/р'; }
  if (p.phase === 'or') txt = 'КС';
  if (p.em || p.phase === 'dyst' || p.pphActive) cls += ' em';
  cls += ' c-' + (p.bornT != null ? 'N' : p.ctg === 'T' ? 'S' : p.ctg);
  if (sm) cls += ' sm';
  return `<span class="${cls}">${txt}</span>`;
}
function tagsOf(p, max) {
  const t = [];
  if (p.flags.pe) t.push('<span class="tag r">ПЭ</span>');
  if (p.flags.chorio && p.bornT == null) t.push('<span class="tag r">t°</span>');
  if (hasOpen(p, 'faint')) t.push('<span class="tag w">муж</span>');
  if (p.flags.epid && p.bornT == null) t.push('<span class="tag o">ЭА</span>');
  else if (hasOpen(p, 'epid')) t.push('<span class="tag w">ЭА?</span>');
  if (p.ga < 37) t.push(`<span class="tag v">${p.ga}н</span>`);
  if (p.flags.blogger) t.push('<span class="tag v">блог</span>');
  if (p.flags.prom && p.bornT == null) t.push('<span class="tag">ДИВ</span>');
  if (p.flags.oxy && p.bornT == null) t.push('<span class="tag">окс</span>');
  if (p.phase === 'pp') t.push(`<span class="tag">${Math.max(0, p.ppEnd - S.t)}м</span>`);
  return t.slice(0, max || 3).join('');
}
function cleanState(r) { const ct = r.cleanTask && task(r.cleanTask); if (!ct || ct.done) return 'грязно'; return ct.started ? 'уборка' : 'ждёт клининг'; }
function renderBox(id) {
  const el = $('r-' + id), r = S.rooms[id], p = r.pid && pat(r.pid);
  let body = '', bar = '', foot = '';
  if (p) {
    body = ptChip(p);
    if (p.bornT == null && p.lab !== 'none') bar = `<div class="dbar"><i style="width:${Math.min(100, p.dil * 10)}%"></i></div>`;
    foot = tagsOf(p, 3);
  } else if (r.dirty) body = `<div class="dirty-l">${cleanState(r)}</div>`;
  setCls(el, 'box' + (r.dirty ? ' dirty' : ''));
  setHTML(el, `<div class="bx-h"><span class="bx-n">${id.slice(3)}</span>${lampHTML(lampState(id))}</div><div class="bx-b">${body}</div>${bar}<div class="bx-f">${foot}</div>`);
}
function renderBed(id) {
  const el = $('r-' + id), r = S.rooms[id], p = r.pid && pat(r.pid);
  let h = '';
  if (p) {
    h += ptChip(p, true);
    const dec = S.decisions.find(d => !d.done && d.pid === p.id);
    if (dec) h += '<span class="tag w">?</span>';
    else if (p.want === 'box') h += '<span class="tag">→бокс</span>';
    else if (p.want === 'or') h += '<span class="tag r">→КС</span>';
    else if (p.want === 'dop') h += '<span class="tag">→доп</span>';
  } else if (r.dirty) h = `<span class="dirty-l">${cleanState(r)}</span>`;
  setCls(el, 'bed' + (r.dirty ? ' dirty' : ''));
  setHTML(el, h + lampHTML(lampState(id)));
}
function renderOR(id) {
  const el = $('r-' + id), r = S.rooms[id], p = r.pid && pat(r.pid);
  const tk = p && openTasks().find(t => t.pid === p.id && t.type === 'cs');
  let s;
  if (p && tk) s = tk.started ? 'КС: ' + Math.min(tk.dur, Math.floor(tk.prog)) + ' из ' + tk.dur + ' мин' : (tk.pri >= 3 ? 'экстренное КС' : 'КС') + ' — ждём бригаду';
  else if (p) s = p.phase === 'pp' ? 'родила здесь' : 'пациентка';
  else if (r.dirty) s = cleanState(r);
  else s = 'свободна';
  const wait = id === 'or1' ? livePatients().filter(x => x.want === 'or').length : 0;
  setCls(el, 'room' + (r.dirty && !p ? ' dirty' : ''));
  setHTML(el, `<div class="lbl"><span>${id === 'orP' ? 'ОР приёмного' : 'ОР ' + id.slice(2)}</span>${lampHTML(lampState(id))}</div><div class="sub">${s}</div>${wait ? `<div class="sub" style="color:var(--bad)">ждут КС: ${wait}</div>` : ''}`);
}
function renderPriem() {
  const q = S.queue.map(pat).filter(Boolean);
  const longest = q.length ? S.t - Math.min(...q.map(p => p.arrived)) : 0;
  const extra = livePatients().filter(p => p.loc === 'priem' && p.phase !== 'queue');
  setHTML($('r-priem'), `<div class="lbl"><span>Приёмное</span>${lampHTML(lampState('priem'))}</div><div class="sub">${q.length ? 'Очередь ' + q.length + (q.some(p => p.src === 'opb') ? ' (ОПБ ' + q.filter(p => p.src === 'opb').length + ')' : '') + ' · ждёт ' + longest + ' мин' : 'Очереди нет'}</div><div class="queue">${q.map(p => `<span class="qd${p.lab === 'second' ? ' hot' : p.src === 'opb' ? ' opb' : ''}"></span>`).join('')}${extra.map(p => ptChip(p, true)).join('')}</div>`);
}
function renderMisc() {
  const babies = openTasks().filter(t => t.type === 'transfer').length;
  setHTML($('r-oritn'), `<div class="lbl"><span>ОРИТН</span>${lampHTML(lampState('oritn'))}</div><div class="sub">за смену: ${S.st.oritn}${babies ? ' · несут ' + babies : ''}</div>`);
  const resting = S.staff.filter(s => s.state === 'rest').length;
  setHTML($('r-ord'), `<div class="lbl"><span>Ординат.</span></div><div class="sub">${resting ? 'спят: ' + resting : 'пусто'}</div>`);
  const d = dirtyRooms().length;
  setHTML($('r-post'), `<b>Пост</b><span class="cnt">${d}</span><small>${d ? 'вызвать клининг' : 'всё чисто'}</small>`);
}
function renderZones() {
  let h = '';
  for (let z = 0; z < 4; z++) {
    const load = zoneLoad(z), slow = S.slow[z] && S.slow[z] > S.t;
    h += `<span class="zn${slow || load > 3 ? ' hot' : ''}">${ZONES[z]} · ${MIDWIVES[z]} ${load}/${z === 3 ? 4 : 5}${slow ? ' · доула!' : load > 3 ? ' · зашивается' : ''}</span>`;
  }
  setHTML($('zones'), h + `<span class="zn">Распред и доп · ${MIDWIVES.rd}</span>`);
}
function renderHUD() {
  $('clk').textContent = clock(S.t);
  const left = SHIFT - S.t, h = hourOf(S.t);
  $('clkSub').textContent = S.over ? 'смена сдана' : (h < 6 ? 'ночь' : h < 9 ? 'утро' : h < 18 ? 'день' : 'вечер') + ' · осталось ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  for (const v of [0, 1, 2, 4]) { const b = $('sp' + v); const on = UI.speed === v; if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on)); }
  $('hScore').textContent = Math.round(S.score);
  $('hBirths').textContent = S.st.births;
  $('hCs').textContent = (S.st.births ? Math.round(100 * S.st.cs / S.st.births) : 0) + '%';
  const v = Math.round(S.vbi);
  $('hVbi').textContent = v;
  const bar = $('hVbiBar'); bar.style.width = Math.max(3, v) + '%'; bar.style.background = v >= 40 ? 'var(--lamp-r)' : v >= 20 ? 'var(--lamp-y)' : 'var(--lamp-g)';
  renderBoss();
}
function staffState(s) {
  if (s.state === 'away') return 'в общей реанимации';
  if (s.state === 'rest') return 'спит в ординаторской';
  const tk = s.taskId && task(s.taskId);
  if (tk) return (s.state === 'walk' ? '→ ' : '') + shortLoc(tk.loc) + ' · ' + tk.label.toLowerCase();
  if (s.state === 'walk') return '→ ' + shortLoc(s.dest);
  return he(s, 'свободен', 'свободна') + (s.loc === 'ord' ? ', ординат.' : '');
}
function renderStaff() {
  setHTML($('staffbar'), S.staff.map(s => `<button type="button" class="chip${s.role === 'zav' ? ' zav' : ''}" data-act="staff" data-id="${s.id}"><span class="cn"><i class="dot ${s.role}"></i>${s.role === 'zav' ? 'Зав · ты' : s.short + ' ' + esc(s.name)}</span><span class="cs">${esc(staffState(s))}</span><span class="en"><i style="width:${Math.round(s.energy)}%;background:${s.energy < 30 ? 'var(--lamp-r)' : s.energy < 55 ? 'var(--lamp-y)' : 'var(--lamp-g)'}"></i></span></button>`).join(''));
}
function renderTray() {
  const pend = S.decisions.filter(d => !d.done).sort((a, b) => (b.red ? 1 : 0) - (a.red ? 1 : 0) || a.t - b.t);
  let h = pend.map(d => { const p = pat(d.pid); const v = p ? shortLoc(p.loc || 'priem') : ''; const t = { triage: 'куда её?', ctgS: 'КТГ', ctgP: 'КТГ!', brady: 'брадикардия', pph: 'ПРК', dyst: 'дистоция', ecl: 'эклампсия', chorio: 'лихорадка' }[d.kind]; return `<button type="button" class="pill${d.red ? ' red' : ''}" data-act="dec" data-id="${d.id}">${esc(v)}: ${t}</button>`; }).join('');
  const zt = openTasks().filter(t => t.need.zav && !(t.slots.zav || []).length);
  h += zt.map(t => `<button type="button" class="pill zv" data-act="zavgo" data-task="${t.id}">Зав нужен: ${esc(t.label.toLowerCase())}</button>`).join('');
  setHTML($('tray'), h);
}
const OFFS = [[0, 10], [-15, 10], [15, 10], [-30, 10], [30, 10], [0, -6], [-15, -6], [15, -6], [-30, -6], [30, -6]];
const EOFFS = [[0, 0], [-17, 0], [17, 0], [-8, -15], [8, -15], [-25, -15], [25, -15], [0, -30]];
const atEdge = k => k.startsWith('box') || k.startsWith('dop') || k.startsWith('raspred') || k === 'post';
function placeTokens(instant) {
  const board = $('board'), br = board.getBoundingClientRect();
  const groups = {};
  for (const s of S.staff) { const key = s.state === 'walk' ? s.dest : s.loc; (groups[key] = groups[key] || []).push(s); }
  for (const key in groups) {
    const el = $('r-' + key); if (!el) continue;
    const r = el.getBoundingClientRect(), edge = atEdge(key);
    const cx = r.left - br.left + r.width / 2, cy = edge ? r.bottom - br.top - 3 : r.top - br.top + r.height / 2 + 6;
    groups[key].forEach((s, i) => {
      const o = edge ? EOFFS[i % EOFFS.length] : OFFS[i % OFFS.length];
      const x = Math.round(cx + o[0]), y = Math.round(cy + o[1]);
      const t = $('t-' + s.id);
      setCls(t, 'tok ' + s.role + (s.state === 'rest' ? ' rest' : '') + (s.state === 'away' ? ' away' : '') + (s.energy < 30 ? ' tired' : ''));
      const prev = UI.tokPos[s.id];
      if (prev && prev.x === x && prev.y === y && !instant) return;
      const dur = (instant || !prev || UI.speed === 0) ? 0 : s.state === 'walk' ? Math.max(0.2, Math.min(6, (s.eta - S.t) * UI.msPerMin / UI.speed / 1000)) : 0.3;
      t.style.transitionDuration = dur + 's';
      t.style.transform = `translate(${x}px, ${y}px)`;
      UI.tokPos[s.id] = { x, y };
    });
  }
}
function renderTicker() {
  const n = S.log[S.log.length - 1], el = $('ticker');
  if (!n) { setHTML(el, '<i></i><span>Смену принял. Лампы горят — бригады бегут.</span>'); return; }
  if (n.id === UI.seenNote) return;
  UI.seenNote = n.id;
  setCls(el, 'ticker ' + n.kind);
  setHTML(el, `<i></i><span>${clock(n.t)} ${esc(n.text)}</span><b>журнал</b>`);
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
function render() {
  if (!UI.built) buildBoard();
  renderHUD();
  for (const id of BOX_IDS) renderBox(id);
  for (const id of RASPRED_IDS) renderBed(id);
  for (const id of DOP_IDS) renderBed(id);
  renderOR('or1'); renderOR('or2'); renderOR('orP');
  renderPriem(); renderMisc(); renderZones(); renderTray(); renderStaff();
  placeTokens(false);
  renderTicker();
  refreshSheet();
}
