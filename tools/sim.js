const fs = require('fs');
const vm = require('vm');
const dir = require('path').join(__dirname, '..', 'src') + '/';
const code = ['data.js', 'engine1.js', 'engine2.js', 'engine3.js', 'engine4.js', 'engine5.js', 'engine6.js', 'engine7.js'].map(f => fs.readFileSync(dir + f, 'utf8')).join('\n');

function run(seed, mode) {
  const ctx = { module: { exports: {} }, console, Math, Object, Array, String, Number, JSON, Date };
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'engine.js' });
  const E = ctx.module.exports;
  E.newGame(seed);
  let S = E.S;
  const seenModal = new Set();
  let minEnergy = 100, staffBusy = {}, maxOpen = 0, maxDirty = 0, maxWantBox = 0;
  for (let i = 0; i < 1440 && !S.over; i++) {
    E.tick();
    S = E.S;
    // bot
    for (const d of S.decisions) {
      if (d.done) continue;
      if (mode === 'good') {
        const v = E.decisionView(d);
        if (!v) continue;
        const good = v.options.findIndex(o => o.ok);
        const idx = Math.random() < 0.85 && good >= 0 ? good : Math.floor(Math.random() * v.options.length);
        E.decide(d.id, idx);
      }
    }
    for (const m of S.modals) if (!seenModal.has(m.id)) { seenModal.add(m.id); if (m.type === 'event' && m.choices) E.eventChoice(m.id, 0); }
    if (mode === 'good') {
      if (S.t % 15 === 0) E.callCleaning(E.dirtyRooms());
      for (const tk of E.openTasks()) if (tk.need.zav && !(tk.slots.zav || []).length) E.manualAssign('zav', tk.id);
      const zav = E.staffBy('zav');
      if (mode === 'good' && !process.env.NOZAV && !zav.taskId) { const tk = E.openTasks().filter(t => E.missing(t).obst).sort((a, b) => b.pri - a.pri)[0]; if (tk) E.manualAssign('zav', tk.id); }
    }
    S.pauseReq = false;
    for (const s of S.staff) { if (s.role !== 'zav') minEnergy = Math.min(minEnergy, s.energy); staffBusy[s.role] = (staffBusy[s.role] || 0) + (s.taskId ? 1 : 0); }
    maxOpen = Math.max(maxOpen, E.openTasks().length);
    maxDirty = Math.max(maxDirty, E.dirtyRooms().length);
    maxWantBox = Math.max(maxWantBox, E.livePatients().filter(p => p.want === 'box').length);
  }
  const st = S.st;
  const counts = { obst: 3, anest: 3, neo: 2, reanim: 2, clean: 2, zav: 1 };
  const util = Object.fromEntries(Object.entries(staffBusy).map(([r, n]) => [r, Math.round(100 * n / (1440 * counts[r]))]));
  return { seed, score: Math.round(S.score), title: S.final && S.final.title, arr: st.arrivals, births: st.births, vag: st.vag, vep: st.vep, cs: st.cs, csEm: st.csEm, needless: st.csNeedless, csRate: Math.round(100 * (S.final ? S.final.csRate : 0)), pph: st.pph, kas: st.kas, asph: st.asph, oritn: st.oritn, chorio: st.chorio, palata: st.palata, noDoc: st.noDoc, compl: st.complaints, maxQ: st.maxQueue, vbiPeak: Math.round(S.vbiPeak), dirtyUse: st.dirtyUse, dec: st.decOk + '/' + st.decAll, minE: Math.round(minEnergy), util, maxOpen, maxDirty, maxWantBox, left: S.final && S.final.left, boss: st.bossWon + '/' + (st.bossWon + st.bossLost), pmu: st.pmuBirths + ' стоп ' + st.pmuStopped + ' пропущ ' + st.pmuMissed, vip: st.vipOk + '/' + st.vipTotal + ' звонков ' + st.vipBad, atata: st.atata + ' раз, мин ' + st.atataMin + ', пик ' + Math.round(S.atataPeak), waves: S.waves.map(w => w.k + ':' + w.state + '@' + w.t).join(' ') };
}
const mode = process.argv[2] || 'good';
const n = +(process.argv[3] || 6);
for (let i = 1; i <= n; i++) {
  try { console.log(JSON.stringify(run(1000 + i * 77, mode))); }
  catch (e) { console.log('SEED', 1000 + i * 77, 'ERROR', e.stack); }
}
