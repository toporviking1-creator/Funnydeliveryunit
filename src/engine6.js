/* ===== РОДБЛОК · пациентки от руководства ===== */
const VIP_FROM = { 1: 'от начмеда', 2: 'от главврача', 3: 'из ДЗМ' };
const VIP_WHO = { 1: 'Начмед', 2: 'Главврач', 3: 'ДЗМ' };
const VIP_KINDS = ['active', 'latent', 'prom', 'pe', 'preterm'];
const stars = n => '★'.repeat(n);
function assignVIP(p) {
  if (S.t === 0 || p.flags.contract || !VIP_KINDS.includes(p.kind) || !chance(0.09)) return;
  const r = rnd();
  p.vip = r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
  S.st.vipTotal++;
  const q = S.queue, i = q.indexOf(p.id);
  if (i >= 0) { q.splice(i, 1); let j = 0; while (j < q.length && pat(q[j]) && (pat(q[j]).vip || 0) >= p.vip) j++; q.splice(j, 0, p.id); }
  const lim = [0, 60, 40, 25][p.vip];
  addTask({ type: 'vipvisit', loc: p.loc || 'priem', pid: p.id, label: 'Осмотреть лично: ' + p.name + ' ' + stars(p.vip), need: { zav: 1 }, dur: 6, pri: 2, deadline: S.t + lim, failAt: S.t + 240 });
  if (p.vip >= 2) {
    card('Пациентка ' + VIP_FROM[p.vip] + ' ' + stars(p.vip), VIP_WHO[p.vip] + ' звонит: «Поступает наша девочка, ' + p.name + '. Посмотрите лично». Она идёт без очереди, а зав должен осмотреть её за ' + lim + ' минут.');
    S.later.push({ t: S.t + rint(40, 120), k: 'vipcall', pid: p.id });
  } else note('Пациентка ' + VIP_FROM[1] + ': ' + p.name + ' — без очереди, зав смотрит лично', 'warn');
  if (p.vip === 3) S.later.push({ t: S.t + rint(25, 70), k: 'vipcs', pid: p.id });
}
function vipHit(p, why) {
  if (!p || !p.vip) return;
  addScore(-10 * p.vip, 'Руководство: ' + why);
  p.flags.vipBad = true; S.st.vipBad++;
  note(VIP_WHO[p.vip] + ' звонит заву: ' + why + ' у «нашей девочки»', 'bad');
}
function vipResolve(p) {
  if (!p || !p.vip || p.vipDone) return;
  p.vipDone = true;
  if (!p.flags.vipBad) { addScore(10 * p.vip, 'Руководство благодарит'); S.st.vipOk++; note(VIP_WHO[p.vip] + ': «Спасибо, всё прекрасно!»', 'good'); }
}
HANDLERS.vipvisit = tk => { const p = pat(tk.pid); if (p) { p.flags.vipSeen = true; addScore(5 * (p.vip || 1), 'Зав осмотрел лично'); } };
LATE.vipvisit = tk => vipHit(pat(tk.pid), 'зав так и не зашёл');
LATER.vipcall = e => {
  const p = pat(e.pid);
  if (!p || p.phase === 'gone' || p.vipDone) return;
  const c = card('Звонок: ' + VIP_WHO[p.vip], '«Как там ' + p.name + '?» — ' + VIP_WHO[p.vip].toLowerCase() + ' на линии и ждёт доклада.', ['Доложить лично', 'Пусть доложит дежурный врач'], 'vipcall');
  c.pid = p.id;
};
function vipCallChoice(c, idx) {
  const p = pat(c.pid); if (!p) return;
  if (idx === 0) { const tk = addTask({ type: 'vipreport', loc: staffBy('zav').loc, pid: p.id, label: 'Доклад руководству', need: { zav: 1 }, dur: 5, pri: 2, failAt: S.t + 60 }); manualAssign('zav', tk.id); }
  else if (chance(0.5)) vipHit(p, 'доложили не лично');
  else note('На том конце выслушали дежурного и успокоились');
}
HANDLERS.vipreport = tk => { const p = pat(tk.pid); addScore(3 * ((p && p.vip) || 1), 'Доклад руководству'); note('Зав доложил лично — на том конце довольны', 'good'); };
LATER.vipcs = e => {
  const p = pat(e.pid);
  if (!p || p.phase === 'gone' || p.bornT != null || p.want === 'or' || p.phase === 'or' || !(p.lab === 'active' || p.lab === 'latent')) return;
  addDecision({ kind: 'vipcs', pid: p.id, pop: true });
  S.pauseReq = true;
};
function vipView(d, p, base) {
  return Object.assign(base, {
    title: 'Звонок из ДЗМ',
    clue: '«Пациентка боится, сделайте ей кесарево. Мы на контроле».',
    fact: 'Объективно: ' + dilText(p) + ', КТГ — ' + ctgWord(p) + '. Медицинских показаний к КС нет.',
    ctg: ['N', 'S', 'P'].includes(p.ctg) ? p.ctg : null,
    options: [
      { k: 'yes', label: 'Пойти навстречу — КС', ok: false },
      { k: 'talk', label: 'Объяснить риски, вести роды по показаниям', ok: true },
      { k: 'kons', label: 'Собрать консилиум', ok: true },
    ],
    why: 'Звонок руководства — не показание к КС. Без медицинских показаний кесарево повышает риски для матери и ребёнка; спорное решение оформляют консилиумом.',
  });
}
APPLY.vipcs = (d, k) => {
  const p = pat(d.pid); if (!p || p.bornT != null || p.phase === 'gone') return;
  if (k === 'yes') { p.flags.needlessCS = true; requestCS(p, 2); return; }
  if (k === 'talk') { if (chance(0.3)) vipHit(p, 'отказали в «просьбе»'); return; }
  const tk = addTask({ type: 'konsilium', loc: p.loc || 'priem', pid: p.id, label: 'Консилиум: ' + p.name, need: { zav: 1, obst: 1 }, dur: 10, pri: 2, failAt: S.t + 120 });
  manualAssign('zav', tk.id);
};
HANDLERS.konsilium = () => { addScore(10, 'Консилиум по VIP'); note('Консилиум: показаний к КС нет, ведём роды. В ДЗМ довольны протоколом', 'good'); };
