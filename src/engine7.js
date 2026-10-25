/* ===== РОДБЛОК · атата у руководства ===== */
const ATATA_TALKS = [
  'Главврач полчаса читал вслух жалобу и спрашивал: «Как такое возможно?»',
  'Устный выговор: «Чтобы больше такого не было».',
  'Объяснительная в трёх экземплярах, один — в ДЗМ.',
  'Главврач показал график доли КС и долго молчал.',
  '«Вы заведующий или кто?» — прозвучало четыре раза.',
];
function blame(pts, reason) {
  if (!S) return;
  S.atata = Math.min(150, (S.atata || 0) + pts);
  S.atataPeak = Math.max(S.atataPeak || 0, S.atata);
  S.blameLog.push({ t: S.t, reason, pts });
  if (S.blameLog.length > 30) S.blameLog.shift();
}
function zavAway(min, kind) {
  const z = staffBy('zav');
  if (z.taskId) unassign(z);
  z.state = 'away'; z.awayUntil = S.t + min; z.rest = false; z.forced = false; z.dest = null; z.loc = 'priem';
  S.zavOut = kind;
  if (kind === 'atata') S.st.atataMin += min;
}
function zavReturned() {
  const kind = S.zavOut; S.zavOut = null;
  if (kind === 'atata') {
    const pen = (S.summon && S.summon.pen) || 15;
    addScore(-pen, 'Атата у главврача');
    card('Атата окончено', pick(ATATA_TALKS) + ' Минус ' + pen + ' очков, гнев остыл до 30.', null, 'atataend');
    S.atata = 30; S.summon = null;
  } else if (kind === 'meeting') {
    addScore(5, 'Планёрка');
    note('Зав вернулся с планёрки: «Снижаем долю КС, коллеги»', 'good');
  }
}
function atataTick() {
  if (S.atata > 0) S.atata = Math.max(0, S.atata - 0.02);
  const z = staffBy('zav');
  if (S.atata >= 100 && !S.summon && z.state !== 'away' && S.t < SHIFT - 30) {
    S.st.atata++;
    const rs = [];
    for (let i = S.blameLog.length - 1; i >= 0 && rs.length < 3; i--) { const r = S.blameLog[i].reason; if (!rs.includes(r)) rs.push(r); }
    S.summon = { t: S.t, pen: 15 };
    card('Зава вызывают на ковёр', 'Главврач ждёт у себя. Накопилось: ' + rs.join(', ') + '. Это 25–45 минут вне родблока.', ['Идти сразу', 'Сначала закончить дела — через 15 минут', 'Отправить старшую акушерку'], 'atata');
  }
}
function atataChoice(idx) {
  if (!S.summon) return;
  if (idx === 0) { S.summon.pen = 15; zavAway(rint(25, 45), 'atata'); note('Зав ушёл на ковёр к главврачу', 'warn'); }
  else if (idx === 1) { S.summon.pen = 25; S.later.push({ t: S.t + 15, k: 'atataGo' }); note('«Через 15 минут буду» — главврач засёк время', 'warn'); }
  else if (chance(0.5)) { addScore(-5, 'Старшая акушерка на ковре'); note('Главврач принял объяснения старшей акушерки. Пронесло', 'good'); S.atata = 50; S.summon = null; }
  else { S.summon.pen = 30; zavAway(rint(40, 55), 'atata'); note('Главврач в ярости: «Где заведующий?!» Зав бежит на ковёр', 'bad'); }
}
LATER.atataGo = () => { if (S.summon && staffBy('zav').state !== 'away') zavAway(rint(30, 50), 'atata'); };
LATER.meetCard = () => card('Планёрка у главврача', 'В 09:00 планёрка, заведующие обязаны быть. Это 20 минут вне родблока.', ['Пойти на планёрку', 'Сказаться занятым'], 'meeting');
LATER.meetGo = () => { if (staffBy('zav').state !== 'away') zavAway(20, 'meeting'); };
function meetingChoice(idx) {
  if (idx === 0) S.later.push({ t: Math.max(S.t + 1, 60), k: 'meetGo' });
  else { blame(25, 'пропуск планёрки'); note('Главврач отметил ваше отсутствие на планёрке', 'warn'); }
}
