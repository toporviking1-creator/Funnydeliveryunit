/* ===== РОДБЛОК · боссы: наплывы ===== */
const WAVES = [
  { k: 'opb', name: 'ОПБ спускает всех', at: [130, 170], warn: 20, src: 'opb', spread: 0, limit: 120, reward: 45, size: [5, 7],
    text: 'После обхода ОПБ переводит в родблок сразу всех: индукции, излитие вод, кто-то уже в родах. Освободи распред, вызови клининг, подними отдохнувших.',
    mix: ['latent', 'prom', 'active', 'latent', 'prom', 'pe', 'active'] },
  { k: 'oblast', name: 'Переводы из области', at: [400, 460], warn: 15, src: 'obl', spread: 20, limit: 90, reward: 50, size: [3, 3],
    text: 'Реанимобили везут троих тяжёлых: тяжёлая преэклампсия, преждевременные роды, кровотечение при предлежании. Реаниматологи и операционная понадобятся одновременно.',
    mix: ['pe', 'preterm', 'previa'] },
  { k: 'evening', name: 'Вечерний вал скорых', at: [690, 750], warn: 15, src: 'amb', spread: 40, limit: 120, reward: 50, size: [6, 7],
    text: 'Пробки рассосались — скорые везут всех разом. Шесть-семь пациенток за 40 минут, среди них кто-то уже тужится.',
    mix: ['active', 'push', 'latent', 'active', 'false', 'prom', 'active'] },
  { k: 'moon', name: 'Ночь полнолуния', at: [960, 1020], warn: 20, src: 'amb', spread: 60, limit: 150, reward: 70, size: [7, 8],
    text: 'Финальный босс. Полнолуние, все устали, а поступления только начинаются: восемь пациенток за час, и поток не стихает ещё три часа.',
    mix: ['active', 'push', 'latent', 'pe', 'active', 'prom', 'preterm', 'active', 'false'] },
];
function diurnal() { const h = hourOf(S.t); return h >= 8 && h < 14 ? 0.85 : h >= 14 && h < 20 ? 1 : h >= 20 ? 1.2 : 1.25; }
function waveDef(w) { return WAVES.find(x => x.k === w.k); }
function setupWaves() {
  S.waves = WAVES.map((w, i) => {
    const mix = w.mix.slice();
    if (w.k !== 'oblast') for (let j = mix.length - 1; j > 0; j--) { const r = rint(0, j); [mix[j], mix[r]] = [mix[r], mix[j]]; }
    return { id: i, k: w.k, t: rint(w.at[0], w.at[1]), state: 'pending', pids: [], size: rint(w.size[0], w.size[1]), spawned: 0, startT: null, endT: null, left: null, mix };
  });
  S.st.bossWon = 0; S.st.bossLost = 0;
}
const wavePlaced = p => p.phase === 'gone' || p.bornT != null || ['placed', 'pp', 'or', 'dyst'].includes(p.phase);
function spawnWave(w, D) {
  const kind = w.mix[w.spawned % w.mix.length];
  const p = makePatient(kind);
  p.wave = w.id; p.src = D.src;
  if (kind === 'preterm' && D.k === 'oblast') p.ga = rint(30, 33);
  w.pids.push(p.id); w.spawned++;
}
function wavesTick() {
  if (!S.waves) return;
  for (const w of S.waves) {
    const D = waveDef(w);
    if (w.state === 'pending' && S.t >= w.t - D.warn) {
      w.state = 'warned';
      card('Босс: ' + D.name, 'Через ' + D.warn + ' минут, пациенток: ' + w.size + '. ' + D.text + ' Разместить всех — за ' + D.limit + ' минут.', null, 'boss');
    }
    if (w.state === 'warned' && S.t >= w.t) {
      w.state = 'active'; w.startT = S.t; w.endT = S.t + D.limit;
      if (D.k === 'moon') { S.mod.arrival = 1.7; S.mod.arrivalUntil = S.t + 180; }
      note('Босс пошёл: ' + D.name.toLowerCase(), 'bad');
    }
    if (w.state !== 'active') continue;
    const due = D.spread ? Math.min(w.size, 1 + Math.floor((S.t - w.startT) * w.size / D.spread)) : w.size;
    while (w.spawned < due) spawnWave(w, D);
    const waiting = w.pids.map(pat).filter(p => p && !wavePlaced(p)).length;
    w.left = (w.size - w.spawned) + waiting;
    if (w.spawned >= w.size && waiting === 0) winWave(w, D);
    else if (S.t >= w.endT) loseWave(w, D);
  }
}
function winWave(w, D) {
  w.state = 'won'; S.st.bossWon++;
  const outside = w.pids.map(pat).filter(p => p && p.flags.outside).length;
  const pts = Math.max(10, D.reward - outside * 15);
  addScore(pts, 'Босс повержен: ' + D.name);
  card('Босс повержен', D.name + ': все ' + w.size + ' размещены за ' + (S.t - w.startT) + ' мин.' + (outside ? ' Правда, родов вне бокса: ' + outside + '.' : '') + ' +' + pts + ' очков.', null, 'bosswin');
}
function loseWave(w, D) {
  w.state = 'lost'; S.st.bossLost++;
  addScore(-30, 'Босс победил: ' + D.name);
  blame(20, 'провален наплыв');
  complaint(null, D.k === 'opb' ? 'заведующая ОПБ написала главврачу' : 'пациентки часами ждали места');
  card('Босс победил', D.name + ': за ' + D.limit + ' минут не разместили ещё ' + w.left + '. −30 и жалоба.', null, 'bosslose');
}
