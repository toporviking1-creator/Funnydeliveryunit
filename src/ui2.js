/* ===== РОДБЛОК · интерфейс: шторки, решения, цикл ===== */
const closeBtn = () => '<button type="button" class="btn o" data-act="close">Закрыть</button>';
function showSheet(h) { $('scrim').hidden = false; const sh = $('sheet'); sh.hidden = false; setHTML(sh, h); }
function closeSheet() { UI.open = null; $('sheet').hidden = true; if (!UI.modal) $('scrim').hidden = true; }
function refreshSheet(force) {
  if (!UI.open || UI.down) return;
  const now = performance.now();
  if (!force && now - UI.lastSheet < 700) return;
  UI.lastSheet = now;
  const o = UI.open;
  setHTML($('sheet'), o.kind === 'room' ? roomSheet(o.loc) : o.kind === 'staff' ? staffSheet(o.id) : o.kind === 'post' ? postSheet() : o.kind === 'log' ? logSheet() : settingsSheet());
}
function openSheet(o) { UI.open = o; UI.lastSheet = 0; showSheet(''); refreshSheet(true); $('sheet').scrollTop = 0; }

function phaseText(p) {
  const d = Math.floor(p.dil);
  if (p.phase === 'dyst') return 'дистоция плечиков';
  if (p.phase === 'or') return 'в операционной';
  if (p.phase === 'pp') return 'ранний послеродовый, ещё ' + Math.max(0, p.ppEnd - S.t) + ' мин';
  if (p.lab === 'second') return 'потужной период, роды через ~' + Math.max(0, p.secondEnd - S.t) + ' мин';
  if (p.lab === 'active') return 'активная фаза, раскрытие ' + d + ' см';
  if (p.lab === 'latent') return 'латентная фаза, раскрытие ' + d + ' см';
  return p.planned ? 'плановое КС: ' + p.planned : 'не в родах, раскрытие ' + d + ' см';
}
function ctgText(p) {
  if (p.bornT != null) return (p.girl ? 'девочка ' : 'мальчик ') + p.weight + ' г, Апгар ' + p.apgar;
  return { N: 'норма', S: 'сомнительная', P: 'патологическая', B: 'брадикардия!', T: 'тахикардия' }[p.ctg] || 'норма';
}
function patientBlock(p) {
  const f = [];
  if (p.flags.pe) f.push('ПЭ' + (p.flags.mg ? ', магнезия идёт' : ', магнезии нет'));
  if (p.flags.epid) f.push('ЭА стоит'); else if (hasOpen(p, 'epid')) f.push('просит ЭА');
  if (p.flags.prom) f.push('ДИВ');
  if (p.flags.oxy && p.bornT == null) f.push('окситоцин');
  if (p.flags.chorio) f.push('хориоамнионит' + (p.flags.abx ? ', антибиотики' : ''));
  if (p.flags.dirtyBox) f.push('лежит в неубранном боксе');
  if (p.flags.blogger) f.push('блогерша');
  if (p.ga < 37 && p.bornT == null) f.push('недоношенная — на роды нужен реаниматолог');
  return `<h2>${esc(p.name)}</h2><div class="who">${p.age} л., ${p.multip ? 'повторнородящая' : 'первородящая'}, ${p.ga} нед</div><dl class="kv"><dt>Сейчас</dt><dd>${esc(phaseText(p))}</dd><dt>${p.bornT != null ? 'Малыш' : 'КТГ'}</dt><dd>${esc(ctgText(p))}</dd>${f.length ? `<dt>Важно</dt><dd>${esc(f.join(' · '))}</dd>` : ''}</dl>`;
}
function candidatesFor(n, tk) {
  return S.staff.filter(s => s.role !== 'zav' && fits(s.role, n) && s.state !== 'away' && s.taskId !== tk.id)
    .map(s => ({ s, c: travelTime(s.state === 'walk' ? s.dest : s.loc, tk.loc) + (s.taskId ? 20 : 0) + (s.state === 'rest' ? 5 : 0) + (n === 'neo' && s.role === 'reanim' ? 6 : 0) }))
    .sort((a, b) => a.c - b.c).slice(0, 3).map(x => x.s);
}
function taskBlock(tk) {
  const m = missing(tk), team = teamOf(tk);
  let h = `<div class="tk${tk.pri >= 3 ? ' red' : ''}"><div class="tk-h"><span>${esc(tk.label)}</span><span>${tk.started ? 'идёт' : S.t < tk.callAt ? 'скоро вызов' : 'ждёт'}</span></div>`;
  if (team.length) h += `<div class="need">${team.map(s => esc(s.short + ' ' + s.name) + ' — ' + (s.state === 'work' && s.loc === tk.loc ? 'на месте' : 'идёт, ' + Math.max(1, s.eta - S.t) + ' мин')).join('<br>')}</div>`;
  for (const n in m) {
    h += `<div class="need">Нужен: ${NEED_LABEL[n]}${m[n] > 1 ? ' × ' + m[n] : ''}</div><div class="row">`;
    if (n !== 'zav') h += candidatesFor(n, tk).map(s => `<button type="button" class="btn sm o" data-act="send" data-staff="${s.id}" data-task="${tk.id}">${esc(s.short + ' ' + s.name)} · ${travelTime(s.state === 'walk' ? s.dest : s.loc, tk.loc)} мин${s.state === 'rest' ? ' · разбудить' : s.taskId ? ' · снять' : ''}</button>`).join('');
    if (n === 'obst' || n === 'zav' || n === 'any') h += `<button type="button" class="btn sm" data-act="send" data-staff="zav" data-task="${tk.id}">Зав идёт сам</button>`;
    h += '</div>';
  }
  return h + '</div>';
}
function roomSheet(loc) {
  if (loc === 'priem') return priemSheet();
  if (loc === 'ord' || loc === 'oritn') return miscSheet(loc);
  const r = S.rooms[loc], p = r && r.pid && pat(r.pid);
  let h = `<div class="eyebrow">${esc(locName(loc))}${isBox(loc) ? ' · зона ' + ZONES[zoneOf(loc)] + ', акушерка ' + MIDWIVES[zoneOf(loc)] : loc.startsWith('raspred') || loc.startsWith('dop') ? ' · акушерка ' + MIDWIVES.rd : ''}</div>`;
  h += p ? patientBlock(p) : `<h2>${r && r.dirty ? 'Не убрано' : 'Свободно'}</h2>`;
  const dec = p && S.decisions.find(d => !d.done && d.pid === p.id);
  if (dec) h += `<button type="button" class="btn" data-act="dec" data-id="${dec.id}">Принять решение</button>`;
  const tks = openTasks().filter(t => t.loc === loc);
  if (tks.length) h += `<div class="tasklist">${tks.map(taskBlock).join('')}</div>`;
  if (r && r.dirty && !r.pid) h += r.cleanTask && task(r.cleanTask) ? '<p class="who">Клининг уже вызван.</p>' : `<button type="button" class="btn" data-act="clean" data-loc="${loc}">Вызвать клининг</button>`;
  return h + closeBtn();
}
function priemSheet() {
  const q = S.queue.map(pat).filter(Boolean);
  let h = `<div class="eyebrow">Приёмное отделение</div><h2>${q.length ? 'В очереди ' + q.length : 'Очереди нет'}</h2>`;
  if (q.length) h += `<div class="who">${q.map(p => esc(p.name) + ' — ждёт ' + (S.t - p.arrived) + ' мин' + (p.lab === 'second' ? ' · тужится!' : '')).join('<br>')}</div><p class="who">Распред на 2 места: пока его не разгрузить, очередь не двинется.</p>`;
  const tks = openTasks().filter(t => t.loc === 'priem' || t.loc === 'orP');
  if (tks.length) h += `<div class="tasklist">${tks.map(taskBlock).join('')}</div>`;
  return h + closeBtn();
}
function miscSheet(loc) {
  let h = `<div class="eyebrow">${esc(locName(loc))}</div>`;
  if (loc === 'ord') {
    const rs = S.staff.filter(s => s.loc === 'ord' && s.state !== 'walk' && s.state !== 'away');
    h += `<h2>${rs.length ? 'Здесь ' + rs.length : 'Никого'}</h2>` + rs.map(s => `<div class="row"><span class="need">${esc(s.short + ' ' + s.name)} — ${esc(staffState(s))}, ${Math.round(s.energy)}%</span>${s.state === 'rest' ? `<button type="button" class="btn sm o" data-act="wake" data-id="${s.id}">Поднять</button>` : ''}</div>`).join('');
    h += `<p class="who">Отдых восстанавливает бодрость${S.mod.rest < 1 ? ' (кофемашина сломана — вдвое медленнее)' : ''}. Уставшие ходят медленнее и работают дольше.</p>`;
  } else {
    h += `<h2>Малышей за смену: ${S.st.oritn}</h2><p class="who">Сюда реаниматологи уносят детей после реанимации, недоношенных и с риском сепсиса. Пока несут — их нет в родблоке.</p>`;
    const tks = openTasks().filter(t => t.loc === 'oritn');
    if (tks.length) h += `<div class="tasklist">${tks.map(taskBlock).join('')}</div>`;
  }
  return h + closeBtn();
}
function staffSheet(id) {
  const s = staffBy(id); if (!s) return closeBtn();
  if (s.role === 'pmu') return pmuSheet(s);
  let h = `<div class="eyebrow">${esc(ROLES[s.role])}</div><h2>${esc(s.short + ' · ' + s.name)}</h2><div class="who">${esc(staffState(s))} · бодрость ${Math.round(s.energy)}%</div><div class="row">`;
  if (s.taskId) h += `<button type="button" class="btn sm o" data-act="free" data-id="${s.id}">Снять с задачи</button>`;
  if (s.state === 'rest' || s.rest) h += `<button type="button" class="btn sm o" data-act="wake" data-id="${s.id}">Поднять</button>`;
  else if (s.state !== 'away') h += `<button type="button" class="btn sm o" data-act="rest" data-id="${s.id}">Отправить поспать</button>`;
  h += '</div>';
  const list = s.state === 'away' ? [] : openTasks().filter(tk => tk.id !== s.taskId && needFor(s, tk)).sort((a, b) => b.pri - a.pri || travelTime(s.loc, a.loc) - travelTime(s.loc, b.loc)).slice(0, 8);
  h += list.length ? '<h3>Куда отправить</h3><div class="opts">' + list.map(tk => `<button type="button" class="opt" data-act="send" data-staff="${s.id}" data-task="${tk.id}">${tk.pri >= 3 ? '<span class="bad-t">СРОЧНО · </span>' : ''}${esc(shortLoc(tk.loc) + ' · ' + tk.label)} · ${travelTime(s.state === 'walk' ? s.dest : s.loc, tk.loc)} мин</button>`).join('') + '</div>' : '<p class="who">Сейчас некуда отправить.</p>';
  return h + closeBtn();
}
function postSheet() {
  const d = dirtyRooms(), cl = S.staff.filter(s => s.role === 'clean');
  let h = `<div class="eyebrow">Пост · кнопка вызова клининга</div><h2>Не убрано: ${d.length}</h2><div class="who">${cl.map(s => esc(s.name + ': ' + staffState(s))).join('<br>')}</div><p class="who">Грязный бокс нельзя занять, а ВБИ растёт, пока хоть что-то не убрано. Чем выше ВБИ, тем чаще хориоамниониты.</p>`;
  if (d.length) h += `<button type="button" class="btn" data-act="cleanall">Убрать всё по очереди</button><div class="opts">` + d.map(id => { const r = S.rooms[id]; const st = r.pid ? 'занято' : r.cleanTask && task(r.cleanTask) ? 'в очереди' : ''; return `<button type="button" class="opt" data-act="clean" data-loc="${id}"${st ? ' disabled' : ''}>${esc(locName(id))}${st ? ' — ' + st : ''}</button>`; }).join('') + '</div>';
  return h + closeBtn();
}
function logSheet() {
  const L = S.log.slice(-40).reverse();
  return `<div class="eyebrow">Журнал смены</div><h2>Что происходило</h2><div class="revl">${L.map(n => `<div><span class="${n.kind === 'bad' ? 'bad-t' : n.kind === 'good' ? 'ok-t' : ''}">${clock(n.t)}</span> ${esc(n.text)}</div>`).join('') || '<div>Пока тихо.</div>'}</div>` + closeBtn();
}
function settingsSheet() {
  return `<div class="eyebrow">Правила и настройки</div><h2>Как играть</h2>${rulesHTML()}<label class="switch"><input type="checkbox" id="optAuto" data-act="toggle" data-k="auto"${S.auto ? ' checked' : ''}> Дежурные сами бегут на кнопки</label><label class="switch"><input type="checkbox" id="optPause" data-act="toggle" data-k="autoPause"${S.autoPause ? ' checked' : ''}> Пауза на красных вызовах и событиях</label><div class="row"><button type="button" class="btn o" data-act="restart">Сдать смену и начать новую</button>${closeBtn()}</div>`;
}
function rulesHTML() {
  return `<div class="legend"><div><span class="lamps"><i class="lamp g on"></i></span> зелёная — плановый вызов акушера</div><div><span class="lamps"><i class="lamp y on"></i></span> жёлтая — вызов неонатолога</div><div><span class="lamps"><i class="lamp r on"></i></span> красная — экстренный вызов</div><div>Мигает — никто не идёт. Горит — врач в пути.</div><div>Тапни бокс — пациентка и кого послать. Тапни сотрудника — куда отправить или уложить спать.</div><div>Пост — кнопка клининга. Неубранный бокс занять нельзя, ВБИ растёт.</div><div>Врачи ПМУ ведут своих контрактных — разгружают дежурных, но иногда чудят. Разрешить или запретить — решаешь ты.</div><div>Ты — зав: решения в лотке внизу, а в крайнем случае идёшь к столу сам.</div></div>`;
}

/* ---------- КТГ ---------- */
function ctgSVG(kind, seed) {
  let s = (seed * 7919) % 233280 || 17;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const W = 320, top = 8, fh = 100, tTop = 120, th = 34, N = 300;
  const y = v => (top + (210 - v) / 150 * fh).toFixed(1);
  const ty = v => (tTop + th - v / 100 * th).toFixed(1);
  const per = 150 + Math.floor(r() * 30), off = Math.floor(r() * 60), cdur = 70;
  const base = kind === 'T' ? 172 : kind === 'P' ? 150 : 140, amp = kind === 'P' ? 2.2 : kind === 'T' ? 3.5 : 6.5;
  let drift = 0; const f = [], c = [];
  for (let i = 0; i < N; i++) {
    const tc = (i * 2 + off) % per;
    drift = (drift + (r() - 0.5) * amp) * 0.82;
    let v = base + drift + Math.sin(i / 2.6) * amp * 0.55;
    if (kind === 'N') for (const [a, b] of [[55, 80], [182, 206]]) if (i >= a && i <= b) v += 18 * Math.sin(Math.PI * (i - a) / (b - a));
    if (kind === 'S' && tc > 20 && tc < 60) { const k = (tc - 20) / 40; v -= 48 * (k < 0.25 ? k / 0.25 : k > 0.7 ? (1 - k) / 0.3 : 1); }
    if (kind === 'P') { const lag = (tc - 30 + per) % per; if (lag < 84) v -= 26 * Math.sin(Math.PI * lag / 84); }
    if (kind === 'B' && i > 180) v = (i < 192 ? v - (i - 180) * 5.5 : 76) + (r() - 0.5) * 3;
    f.push(i * (W / N) + ',' + y(Math.max(60, Math.min(210, v))));
    c.push(i * (W / N) + ',' + ty(8 + (tc < cdur ? Math.sin(Math.PI * tc / cdur) : 0) * 62 + (r() - 0.5) * 2));
  }
  let g = `<rect class="band" x="0" y="${y(160)}" width="${W}" height="${(y(110) - y(160)).toFixed(1)}"/>`;
  for (let m = 1; m < 10; m++) g += `<line class="gl" x1="${m * 32}" y1="${top}" x2="${m * 32}" y2="${tTop + th}"/>`;
  for (const v of [60, 90, 120, 150, 180, 210]) g += `<line class="gm" x1="0" y1="${y(v)}" x2="${W}" y2="${y(v)}"/><text x="2" y="${(+y(v) - 2).toFixed(1)}">${v}</text>`;
  g += `<line class="gm" x1="0" y1="${tTop}" x2="${W}" y2="${tTop}"/><text x="2" y="${tTop + 10}">схватки</text>`;
  return `<svg class="ctg" viewBox="0 0 ${W} ${tTop + th + 4}" role="img" aria-label="Фрагмент КТГ, 10 минут">${g}<polyline class="fhr" points="${f.join(' ')}"/><polyline class="toco" points="${c.join(' ')}"/></svg>`;
}

/* ---------- модалки ---------- */
function showModal(h) { $('scrim').hidden = false; const m = $('modal'); m.hidden = false; m.innerHTML = h; const b = m.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
function closeModal() {
  UI.modal = null; $('modal').hidden = true; $('modal').innerHTML = '';
  if (!UI.open) $('scrim').hidden = true;
  if (!nextModal(false) && UI.autoPaused) { UI.autoPaused = false; setSpeed(UI.prevSpeed || 1); }
}
function openDecision(id) {
  const d = S.decisions.find(x => x.id === id); if (!d || d.done) return;
  const v = decisionView(d); if (!v) return;
  UI.modal = { kind: 'dec', id };
  showModal(`<div class="card${v.red ? ' red' : v.pop ? ' gold' : ''}"><div class="eyebrow">${esc(v.where)}${v.red ? ' · красная кнопка' : v.pop ? ' · врач ПМУ' : ''} · ${clock(S.t)}</div><h2>${esc(v.title)}</h2><div class="who">${esc(v.who)}</div>${v.ctg ? ctgSVG(v.ctg, d.id) : ''}<p class="clue">${esc(v.clue)}</p>${v.fact ? `<p class="who">${esc(v.fact)}</p>` : ''}<div class="opts">${v.options.map((o, i) => `<button type="button" class="opt" data-act="choose" data-id="${d.id}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div><button type="button" class="btn o sm" data-act="later" data-id="${d.id}">Решу позже</button></div>`);
}
function showFeedback(res) {
  const m = $('modal').querySelector('.card'); if (!m) return closeModal();
  m.querySelector('.opts').outerHTML = `<div class="fb ${res.ok ? 'ok' : 'bad'}"><b>${res.ok ? 'Верно' : 'Не лучший выбор'}</b><span>${esc(res.why)}</span>${res.best ? `<span><b>Правильнее:</b> ${esc(res.best)}</span>` : ''}</div>`;
  const later = m.querySelector('[data-act="later"]');
  later.outerHTML = '<button type="button" class="btn" data-act="closeModal">Дальше</button>';
  m.querySelector('[data-act="closeModal"]').focus({ preventScroll: true });
}
function openEvent(c) {
  UI.modal = { kind: 'ev', id: c.id }; UI.shownModals[c.id] = true;
  const btns = c.choices ? c.choices.map((t, i) => `<button type="button" class="opt" data-act="evch" data-id="${c.id}" data-i="${i}">${esc(t)}</button>`).join('') : '<button type="button" class="btn" data-act="closeModal">Понятно</button>';
  showModal(`<div class="card${c.k && c.k.startsWith('boss') ? ' red' : ''}"><div class="eyebrow">${c.k && c.k.startsWith('boss') ? 'Босс' : 'Событие'} · ${clock(S.t)}</div><h2>${esc(c.title)}</h2><p class="clue">${esc(c.text)}</p><div class="opts">${btns}</div></div>`);
}
function nextModal(auto) {
  if (UI.modal) return true;
  const red = S.decisions.find(d => !d.done && (d.red || d.pop) && !UI.deferred[d.id]);
  if (red) { openDecision(red.id); return true; }
  const ev = S.modals.find(m => !UI.shownModals[m.id]);
  if (ev) { if (ev.type === 'report') { UI.shownModals[ev.id] = true; openReport(); } else openEvent(ev); return true; }
  return false;
}
function openReport() {
  UI.modal = { kind: 'rep' }; setSpeed(0);
  const st = S.st, F = S.final;
  let best = 0; try { best = +localStorage.getItem('rodblok-best') || 0; if (S.score > best) localStorage.setItem('rodblok-best', String(Math.round(S.score))); } catch (e) { }
  const cell = (b, s) => `<div><b>${b}</b><span>${s}</span></div>`;
  const rev = S.review.filter(x => x.byZav && !x.ok).slice(-8);
  showModal(`<div class="card"><div class="eyebrow">Сдача смены · 08:00</div><p class="big">${Math.round(S.score)}</p><div class="stars" aria-label="${F.stars} из 3">${'★'.repeat(F.stars)}${'☆'.repeat(3 - F.stars)}</div><h2>${esc(F.title)}</h2>${best ? `<div class="who">Прошлый рекорд: ${best}</div>` : ''}
  <div class="rep">${cell(st.births, 'родов')}${cell(Math.round(F.csRate * 100) + '%', 'доля КС')}${cell(st.vep, 'ВЭП')}${cell(st.csEm, 'экстренных КС')}${cell(st.csNeedless, 'КС без показаний')}${cell(st.pph, 'ПРК')}${cell(st.kas, 'КАС')}${cell(st.asph, 'асфиксий')}${cell(st.oritn, 'в ОРИТН')}${cell(st.chorio, 'хориоамнионитов')}${cell(Math.round(S.vbiPeak), 'пик ВБИ')}${cell(st.palata, 'родов вне бокса')}${cell(st.noDoc, 'родов без врача')}${cell(st.complaints, 'жалоб')}${cell(st.decOk + '/' + st.decAll, 'верных решений')}${cell((st.bossWon || 0) + '/' + (S.waves ? S.waves.length : 0), 'боссов повержено')}${cell(st.arrivals, 'поступило')}${cell(st.maxQueue, 'макс. очередь')}${cell(st.pmuBirths || 0, 'контрактных родов')}${cell(st.pmuStopped || 0, 'абсурда остановлено')}${cell(st.pmuMissed || 0, 'абсурда пропущено')}</div>
  ${F.bonus.length ? `<div class="who"><b>Бонусы:</b> ${esc(F.bonus.join(' · '))}</div>` : ''}
  ${rev.length ? `<h3>Разбор ошибок</h3><div class="revl">${rev.map(x => `<div><span class="bad-t">${clock(x.t)} ${esc(x.where)} · ${esc(x.title)}</span><br>Выбрано: ${esc(x.choice)}<br>Правильнее: ${esc(x.best || '')}<br>${esc(x.why)}</div>`).join('')}</div>` : '<div class="who">Ошибок в решениях нет.</div>'}
  <button type="button" class="btn" data-act="restart">Новая смена</button></div>`);
}
function showStart() {
  UI.modal = { kind: 'start' };
  showModal(`<div class="card"><div class="eyebrow">Сутки дежурства · 19 боксов</div><p class="big">РОДБЛОК</p><div class="who">Ты — заведующий. С 08:00 до 08:00: три акушера, три анестезиолога, два неонатолога, два реаниматолога, пять акушерок и клининг.</div>${rulesHTML()}<label class="switch"><input type="checkbox" id="optAuto0" data-act="toggle" data-k="auto"${S.auto ? ' checked' : ''}> Дежурные сами бегут на кнопки</label><button type="button" class="btn" data-act="start">Принять смену</button></div>`);
}

/* ---------- скорость и цикл ---------- */
function setSpeed(v) { UI.speed = v; if (v > 0) UI.prevSpeed = v; UI.dirty = true; }
let lastTs = 0, acc = 0;
function frame(ts) {
  const dt = lastTs ? Math.min(250, ts - lastTs) : 0; lastTs = ts;
  if (UI.speed > 0 && !S.over && UI.started) {
    acc += dt * UI.speed;
    let n = 0;
    while (acc >= UI.msPerMin && n < 8) { acc -= UI.msPerMin; tick(); n++; UI.dirty = true; if (S.pauseReq) break; }
    if (S.pauseReq) {
      S.pauseReq = false; acc = 0;
      const auto = S.autoPause || S.over;
      if (auto && !UI.modal && (S.decisions.some(d => !d.done && (d.red || d.pop) && !UI.deferred[d.id]) || S.modals.some(m => !UI.shownModals[m.id]))) { UI.prevSpeed = UI.speed; UI.autoPaused = true; setSpeed(0); nextModal(true); }
    }
  }
  if (!UI.modal && UI.started && (S.over || UI.speed === 0 || !S.autoPause)) {
    if (S.modals.some(m => !UI.shownModals[m.id] && (m.type === 'report' || !S.autoPause))) nextModal(false);
  }
  if (UI.dirty) { render(); UI.dirty = false; }
  requestAnimationFrame(frame);
}
function startGame() { UI.started = true; closeModal(); setSpeed(1); }
function restart() {
  newGame(); UI.built = false; UI.deferred = {}; UI.shownModals = {}; UI.seenNote = 0; UI.open = null; UI.modal = null;
  $('sheet').hidden = true; $('modal').hidden = true; $('scrim').hidden = true;
  buildBoard(); setSpeed(0); UI.started = false; render(); showStart();
}

/* ---------- ввод ---------- */
document.addEventListener('pointerdown', () => { UI.down = true; });
document.addEventListener('pointerup', () => { UI.down = false; });
document.addEventListener('pointercancel', () => { UI.down = false; });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (a === 'toggle') { S[el.dataset.k] = el.checked; UI.dirty = true; return; }
  switch (a) {
    case 'speed': setSpeed(+el.dataset.v); UI.autoPaused = false; break;
    case 'settings': openSheet({ kind: 'settings' }); break;
    case 'room': openSheet({ kind: 'room', loc: el.dataset.loc }); break;
    case 'post': openSheet({ kind: 'post' }); break;
    case 'log': openSheet({ kind: 'log' }); break;
    case 'staff': openSheet({ kind: 'staff', id }); break;
    case 'send': { const ok = manualAssign(el.dataset.staff, +el.dataset.task); if (!ok) note('Этот сотрудник туда не подходит', 'warn'); else if (UI.open && UI.open.kind === 'staff') closeSheet(); refreshSheet(true); break; }
    case 'zavgo': manualAssign('zav', +el.dataset.task); break;
    case 'rest': sendRest(id); refreshSheet(true); break;
    case 'wake': wake(id); refreshSheet(true); break;
    case 'free': release(id); refreshSheet(true); break;
    case 'pmuoff': pmuDismiss(id); refreshSheet(true); break;
    case 'clean': callCleaning([el.dataset.loc]); refreshSheet(true); break;
    case 'cleanall': { const n = callCleaning(dirtyRooms()); note(n ? 'Клининг вызван: ' + n : 'Всё уже в очереди', 'good'); refreshSheet(true); break; }
    case 'dec': closeSheet(); if (!UI.modal) openDecision(+id); break;
    case 'choose': { const res = decide(+id, +el.dataset.i); if (res) showFeedback(res); else closeModal(); break; }
    case 'later': UI.deferred[+id] = true; closeModal(); break;
    case 'evch': eventChoice(+id, +el.dataset.i); closeModal(); break;
    case 'closeModal': closeModal(); break;
    case 'close': if (UI.open) closeSheet(); else if (UI.modal && UI.modal.kind !== 'start' && UI.modal.kind !== 'rep') closeModal(); break;
    case 'start': startGame(); break;
    case 'restart': restart(); break;
  }
  UI.dirty = true;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('[tabindex="0"][data-act]')) { e.target.click(); return; }
  if (UI.modal || e.target.closest && e.target.closest('input')) return;
  if (e.key === ' ') { e.preventDefault(); setSpeed(UI.speed ? 0 : UI.prevSpeed || 1); }
  else if (e.key === '1' || e.key === '2' || e.key === '4') setSpeed(+e.key);
  else if (e.key === 'Escape' && UI.open) closeSheet();
});
window.addEventListener('resize', () => { UI.tokPos = {}; placeTokens(true); });

/* ---------- запуск ---------- */
function boot(data) {
  if (data && data.S && data.S.v === 2) { S = data.S; SEED = S.rng; UI.started = !!data.started; }
  else newGame();
  buildBoard(); render(); placeTokens(true);
  if (!UI.started) showStart(); else setSpeed(0);
  requestAnimationFrame(frame);
}
try { window.claude?.hot?.snapshot?.(() => ({ S, started: UI.started })); } catch (e) { }
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot(window.claude?.hot?.data ?? {});
