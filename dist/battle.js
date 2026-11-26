const JourneyBattle = (() => {
  const dialog = $("battle-dialog");
  let timer = null;
  let current = null;
  let observed = "";
  const pace = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 110
    : 320;

  function fighter(mon, hp, side) {
    const life = Math.round((hp * 100) / mon.hp);
    return (
      '<div class="battle-fighter ' +
      side +
      '"><div class="battle-hud"><div class="rowline"><b>' +
      name(mon.id) +
      "</b><small>Lv. " +
      mon.level +
      '</small></div><div role="progressbar" aria-label="' +
      name(mon.id) +
      '体力" aria-valuenow="' +
      hp +
      '" aria-valuemax="' +
      mon.hp +
      '" class="battle-hp" data-low="' +
      (life <= 30) +
      '"><span style="width:' +
      life +
      '%"></span></div><small class="battle-hp-text">' +
      hp +
      " / " +
      mon.hp +
      '</small></div><div class="battle-mon">' +
      icon(mon.id) +
      "</div></div>"
    );
  }
  function finish() {
    clearTimeout(timer);
    if (!current || !dialog.open) return;
    $("battle-skip").textContent = "返回旅行";
    $("battle-skip").onclick = () => dialog.close();
    $("battle-status").innerHTML =
      "<strong>" +
      (current.win ? "挑战胜利" : "挑战未通过") +
      "</strong><span>" +
      (current.win
        ? "胜利结果已计入旅行进度。"
        : "调整阵容或提升等级后，队伍将自动再战。") +
      "</span>";
    $("battle-stage").removeAttribute("data-hit");
  }
  function replay(record) {
    if (!record?.replay?.turns.length) return;
    clearTimeout(timer);
    closeModal();
    current = record;
    const { roster, opponents, turns } = record.replay;
    const stride = Math.ceil(turns.length / 30);
    const frames = turns.filter(
      (turn, index) =>
        index % stride === 0 ||
        index === turns.length - 1 ||
        turn[2] === 0 ||
        turn[3] === 0,
    );
    const stop = record.stop !== undefined ? area().stops[record.stop] : null;
    $("battle-title").textContent = stop
      ? stop.name + " · " + record.leader
      : record.leader;
    $("battle-kind").textContent = record.league
      ? "联盟自动对战"
      : "道馆自动对战";
    $("battle-skip").textContent = "跳过演出";
    $("battle-skip").onclick = finish;
    $("battle-body").innerHTML =
      '<div class="battle-stage" id="battle-stage"><div class="battle-platform away"></div><div class="battle-platform home"></div><div id="battle-fighters"></div></div><div class="battle-status" id="battle-status" aria-live="polite"></div>';
    $("battle-stage").style.setProperty(
      "--arena",
      "url(assets/scenes/" + (stop?.scene || "pewter") + ".png)",
    );
    if (!dialog.open) dialog.showModal();
    let index = 0;
    function show() {
      if (!dialog.open) return;
      const [ally, foe, allyHP, foeHP, side, move, damage] = frames[index];
      $("battle-fighters").innerHTML =
        fighter(roster[ally], allyHP, "ally") +
        fighter(opponents[foe], foeHP, "foe");
      $("battle-stage").dataset.hit = side;
      $("battle-status").textContent =
        side === "start"
          ? "双方派出伙伴，自动对战开始。"
          : name((side === "ally" ? roster[ally] : opponents[foe]).id) +
            "使用" +
            move +
            (damage
              ? "，造成 " + damage + " 点伤害。"
              : "，这次没有造成伤害。");
      index++;
      timer = setTimeout(index < frames.length ? show : finish, pace);
    }
    show();
  }
  dialog.addEventListener("close", () => {
    clearTimeout(timer);
    current = null;
  });
  function observe(s, first) {
    const latest = s?.history[0];
    if (!latest?.replay) return;
    const key = latest.leader + ":" + latest.time;
    if (key === observed) return;
    observed = key;
    if (
      !first &&
      !document.hidden &&
      page === "field" &&
      !$("dialog").open &&
      !dialog.open &&
      Date.now() - latest.time < 4500
    )
      replay(latest);
  }
  return { replay, observe };
})();
