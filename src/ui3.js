/* ===== РОДБЛОК · интерфейс: полоса босса ===== */
function renderBoss() {
  const el = $('boss');
  if (!S.waves) { el.hidden = true; return; }
  const act = S.waves.find(w => w.state === 'active'), warn = S.waves.find(w => w.state === 'warned');
  if (act) {
    const D = waveDef(act), left = act.left != null ? act.left : act.size;
    el.hidden = false; setCls(el, 'boss');
    setHTML(el, `<b>БОСС</b><span class="bn">${esc(D.name)}</span><span class="bt">${left}/${act.size} · ${Math.max(0, act.endT - S.t)} мин</span><span class="hp" aria-label="Осталось разместить ${left} из ${act.size}"><i style="width:${Math.round(100 * left / act.size)}%"></i></span>`);
  } else if (warn) {
    const D = waveDef(warn);
    el.hidden = false; setCls(el, 'boss warn');
    setHTML(el, `<b>СКОРО</b><span class="bn">${esc(D.name)} · ${warn.size}</span><span class="bt">через ${Math.max(0, warn.t - S.t)} мин</span>`);
  } else el.hidden = true;
}
function pmuSheet(s) {
  const mine = pmuPatients(s.id);
  let h = `<div class="eyebrow">Врач ПМУ · ${esc(s.title)}</div><h2>${esc(s.name)}</h2><div class="who">${esc(s.quirk)} · ${esc(staffState(s))}</div>`;
  h += mine.length ? `<div class="who">Ведёт: ${mine.map(p => esc(p.name) + ' (' + esc(shortLoc(p.loc || 'priem')) + ')').join(', ')}</div><button type="button" class="btn o" data-act="pmuoff" data-id="${s.id}">Забрать ${he(s, 'его', 'её')} пациенток дежурным</button>` : '<p class="who">Своих пациенток сейчас нет.</p>';
  return h + closeBtn();
}
function zavAngerHTML() {
  const a = Math.round(S.atata || 0), last = S.blameLog.slice(-4).reverse();
  return `<div class="who">Гнев руководства: ${a} из 100${a >= 70 ? ' — главврач уже спрашивал' : ''}</div>` + (last.length ? `<div class="who">${last.map(b => clock(b.t) + ' · ' + esc(b.reason) + ' +' + b.pts).join('<br>')}</div>` : '');
}
