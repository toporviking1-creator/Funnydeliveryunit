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
