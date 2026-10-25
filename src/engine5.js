/* ===== РОДБЛОК · врачи ПМУ ===== */
const PMU_DOCS = [
  { id: 'p1', name: 'Звездин', short: 'Зв', title: 'профессор', quirk: 'любит кесарево и театр', absurd: 0.8, delay: [5, 20] },
  { id: 'p2', name: 'Глянцева', short: 'Гл', title: 'врач-блогер', quirk: 'снимает сторис, против «химии»', absurd: 0.8, delay: [10, 25], f: 1 },
  { id: 'p3', name: 'Пупкин', short: 'Пу', title: 'доктор', quirk: 'вечно в пробке, командует по телефону', absurd: 0.75, delay: [30, 60] },
  { id: 'p4', name: 'Рыбкина', short: 'Ры', title: 'к.м.н.', quirk: 'почти всегда права', absurd: 0.15, delay: [5, 15], f: 1 },
];
ROLES.pmu = 'Врач ПМУ (контракт)';
const PMU_KINDS = ['active', 'latent', 'prom', 'pe', 'planned'];
const PMU_VAR = {
  csTheatre: { absurd: true, docs: ['p1'], cond: p => (p.lab === 'active' || p.lab === 'latent') && p.dil < 8 && p.ctg === 'N',
    quote: p => `Кесарим. Раскрытие ${Math.floor(p.dil)} см, КТГ — норма, но у меня в 19:00 театр.`,
    allow: p => { p.flags.needlessCS = true; requestCS(p, 2); },
    why: 'Желание врача успеть в театр — не показание к КС: КТГ в норме, роды идут.' },
  oxyMax: { absurd: true, docs: ['p1'], cond: p => p.lab === 'active' && !p.flags.oxy && p.ctg === 'N',
    quote: () => 'Окситоцин на максимум — пусть родит до обеда.',
    allow: p => { p.flags.oxy = true; p.flags.oxyMax = true; },
    why: 'Родостимуляция без показаний при нормальной динамике ведёт к гиперстимуляции и дистрессу плода.' },
  noCtg: { absurd: true, docs: ['p2'], cond: p => (p.lab === 'active' || p.lab === 'second') && isBox(p.loc) && !p.flags.noCtg,
    quote: () => 'Снимаем датчики КТГ — мешают снимать сторис.',
    allow: p => { p.flags.noCtg = true; },
    why: 'В родах нужен контроль состояния плода — без КТГ ухудшение пропустят.' },
  tea: { absurd: true, docs: ['p2'], cond: p => p.flags.chorio && !p.flags.abx,
    quote: () => 'Антибиотики — это химия. Даём травяной чай.',
    allow: p => { p.flags.tea = true; },
    veto: p => { p.flags.abx = true; },
    why: 'При хориоамнионите нужны антибиотики широкого спектра, чай их не заменит.' },
  shop: { absurd: true, docs: ['p3'], cond: p => p.lab === 'active' && p.dil >= 5 && p.dil < 8,
    quote: p => `Отпустите её прогуляться до магазина, раскрытие всего ${Math.floor(p.dil)} см. Я подъеду.`,
    allow: p => { p.shopUntil = S.t + 45; },
    why: 'В активной фазе родов пациентка остаётся в боксе под наблюдением.' },
  wait: { absurd: true, docs: ['p3'], phone: true, cond: (p, d) => p.lab === 'second' && d.state === 'away',
    quote: () => 'Я в пробке. Скажите ей пока не тужиться — рожаем только при мне.',
    allow: p => { p.flags.waitDoc = true; },
    why: 'Потужной период не откладывают до приезда врача: роды ведёт дежурная бригада.' },
  kristeller: { absurd: true, docs: ['p1', 'p3'], cond: p => p.lab === 'second',
    quote: () => 'Давите на дно матки — ускорим потуги.',
    allow: p => { p.flags.kristeller = true; },
    why: 'Давление на дно матки (приём Кристеллера) не рекомендуется: риск травмы матери и плода.' },
  epid: { absurd: false, cond: p => p.lab === 'active' && p.dil >= 4 && p.dil < 8 && !p.flags.epid && !hasOpen(p, 'epid') && isBox(p.loc),
    quote: p => `Пациентка просит обезболивание, раскрытие ${Math.floor(p.dil)} см. Зову анестезиолога на ЭА.`,
    allow: p => { addTask({ type: 'epid', loc: p.loc, pid: p.id, label: 'Эпидуральная анальгезия', need: { anest: 1 }, dur: 15, pri: 1, deadline: S.t + 40 }); },
    why: 'Просьба пациентки — достаточное основание для ЭА, если нет противопоказаний.' },
  amnio: { absurd: false, cond: p => p.lab === 'active' && p.dil >= 6 && p.dil < 9 && !p.flags.prom && !p.flags.amnio,
    quote: p => `Раскрытие ${Math.floor(p.dil)} см, плодный пузырь цел, схватки ослабли. Делаю амниотомию.`,
    allow: p => { p.flags.amnio = true; p.actRate *= 1.25; },
    why: 'Амниотомия в активной фазе при ослаблении схваток — разумный шаг.' },
  oxyOk: { absurd: false, cond: p => p.lab === 'active' && !p.flags.oxy && p.ctg === 'N',
    quote: p => `Два часа без динамики на ${Math.floor(p.dil)} см, КТГ — норма. Начинаю окситоцин.`,
    allow: p => { p.flags.oxy = true; p.actRate *= 1.4; },
    why: 'Вторичная слабость родовой деятельности при нормальной КТГ — показание к родоусилению окситоцином.' },
  vepOk: { absurd: false, cond: p => p.lab === 'second' && p.lowHead && isBox(p.loc) && S.t - p.secondStart > 15,
    quote: () => 'Полное раскрытие, головка на тазовом дне, потуги неэффективны. Накладываю вакуум.',
    allow: p => { startVEP(p, 2); },
    why: 'Неэффективные потуги при головке на тазовом дне — показание к ВЭП.' },
};
function pmuDocs() { return S.staff.filter(s => s.role === 'pmu'); }
function pmuPatients(id) { return Object.values(S.P).filter(p => p.pmu === id && p.phase !== 'gone'); }
function assignPMU(p) {
  if (!PMU_KINDS.includes(p.kind) || !chance(0.24)) return;
  const cand = pmuDocs().filter(d => pmuPatients(d.id).length < 2);
  if (!cand.length) return;
  const d = pick(cand);
  p.pmu = d.id; p.flags.contract = true;
  if (d.out) {
    d.out = false; d.state = 'away'; d.awayUntil = S.t + rint(d.delay[0], d.delay[1]); d.loc = 'priem'; d.energy = 100;
    note('Врач ПМУ ' + d.name + ' едет к своей контрактной: ' + p.name);
  }
}
function pmuFill(tk, p) {
  const doc = staffBy(p.pmu);
  if (!doc || doc.out || doc.state === 'away' || doc.taskId || !tk.need.obst) return;
  if (missing(tk).obst) { assign(doc, tk, 'obst'); return; }
  if (tk.started) return;
  const duty = (tk.slots.obst || []).map(staffBy).find(s => s && s.role === 'obst' && !(s.state === 'work' && s.loc === tk.loc));
  if (duty) { unassign(duty); assign(doc, tk, 'obst'); }
}
function pmuDismiss(id) {
  const d = staffBy(id); if (!d) return;
  for (const p of pmuPatients(id)) p.pmu = null;
  if (d.taskId) unassign(d);
  note('Пациенток врача ПМУ ' + d.name + ' ведёт дежурная бригада', 'warn');
}
function pmuTick() {
  for (const d of pmuDocs()) {
    if (d.out) continue;
    const mine = pmuPatients(d.id);
    if (!mine.length && !d.taskId && d.state !== 'away') {
      d.out = true; d.state = 'away'; d.awayUntil = 1e9; d.rest = false;
      note('Врач ПМУ ' + d.name + ' ' + he(d, 'уехал', 'уехала') + ', оставив коробку конфет', 'good');
      continue;
    }
    for (const p of mine) {
      if (p.bornT != null || (p.pmuN || 0) >= 2 || (p.pmuNext && S.t < p.pmuNext)) continue;
      if (S.decisions.some(x => !x.done && x.pid === p.id && x.kind === 'pmu')) continue;
      if (!chance(0.0045)) continue;
      const absurd = chance(d.absurd);
      const pool = Object.keys(PMU_VAR).filter(k => {
        const V = PMU_VAR[k];
        if (V.absurd !== absurd) return false;
        if (V.docs && !V.docs.includes(d.id) && d.id !== 'p4') return false;
        if (!V.phone && d.state === 'away') return false;
        return V.cond(p, d);
      });
      if (!pool.length) continue;
      p.pmuN = (p.pmuN || 0) + 1; p.pmuNext = S.t + 90;
      addDecision({ kind: 'pmu', pid: p.id, v: pick(pool), doc: d.id, pop: true });
      S.pauseReq = true;
    }
  }
}
const ctgWord = p => ({ N: 'норма', S: 'сомнительная', P: 'патологическая', B: 'брадикардия', T: 'тахикардия' }[p.ctg] || 'норма');
function pmuView(d, p, base) {
  const V = PMU_VAR[d.v], doc = staffBy(d.doc);
  if (!V) return null;
  return Object.assign(base, {
    title: 'Решение врача ПМУ',
    clue: (doc ? cap(doc.title) + ' ' + doc.name : 'Врач ПМУ') + (doc && doc.state === 'away' ? ' по телефону' : '') + ': «' + V.quote(p) + '»',
    fact: 'Объективно: ' + dilText(p) + ', КТГ — ' + ctgWord(p) + '.',
    ctg: ['N', 'S', 'P'].includes(p.ctg) ? p.ctg : null,
    options: [
      { k: 'allow', label: 'Разрешить', ok: !V.absurd },
      { k: 'veto', label: 'Запретить — ведём по протоколу', ok: V.absurd },
      { k: 'take', label: 'Забрать пациентку дежурной бригаде', ok: V.absurd },
    ],
    why: V.why,
  });
}
APPLY.pmu = (d, k) => {
  const p = pat(d.pid); if (!p || p.phase === 'gone') return;
  const V = PMU_VAR[d.v], doc = staffBy(d.doc); if (!V) return;
  if (V.absurd) { if (k === 'allow') S.st.pmuMissed++; else S.st.pmuStopped++; }
  if (k === 'allow') { if (p.bornT == null) V.allow(p); return; }
  if (V.veto && p.bornT == null) V.veto(p);
  if (!V.absurd) complaint(p, 'контрактной пациентке отказали без причины');
  const sulk = k === 'veto' && V.absurd && chance(0.25);
  if (k === 'take' || sulk) {
    if (sulk && doc) note('Врач ПМУ ' + doc.name + ' ' + he(doc, 'обиделся', 'обиделась') + ' — пациентку ведут дежурные', 'warn');
    p.pmu = null;
    if (doc && doc.taskId && task(doc.taskId) && task(doc.taskId).pid === p.id) unassign(doc);
  }
};
