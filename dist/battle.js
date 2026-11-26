const JourneyBattle = (() => {
  const dialog = $("battle-dialog");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tint = {
    火: "#ff7846",
    水: "#5bdcff",
    草: "#a5ef78",
    电: "#ffe26d",
    冰: "#b6f7ff",
    妖精: "#ffc4eb",
    幽灵: "#c7a5ff",
    毒: "#dc8bed",
    岩石: "#f3c78a",
    一般: "#fff0c2",
  };
  let raf = 0;
  let current = null;
  let observed = "";

  function drawMon(ctx, mon, actor, time, side) {
    const [, x, y, hp, pose, heading] = actor;
    const px = Math.round(x * 4.8),
      py = Math.round(y * 2.7);
    const walk = Math.floor(time / 120) % 4;
    const size = pose === 2 ? 1.4 : 1.3;
    ctx.save();
    ctx.globalAlpha = hp ? 1 : 0.37;
    ctx.fillStyle = "#34433275";
    ctx.fillRect(px - 14, py - 2, 28, 3);
    ctx.fillRect(px - 10, py + 1, 20, 2);
    if (pose === 1 && hp) {
      ctx.fillStyle = side ? "#f6bd706d" : "#95de867d";
      ctx.fillRect(px - 16, py - 5, 32, 2);
    }
    if (!JourneySpriteArt.draw(ctx, mon.id, px, py, heading, walk, size)) {
      const [color, secondary] = colors(mon.id);
      ctx.fillStyle = "#1e332a";
      ctx.fillRect(px - 11, py - 24, 22, 22);
      ctx.fillStyle = color;
      ctx.fillRect(px - 9, py - 22, 18, 18);
      ctx.fillStyle = secondary;
      ctx.fillRect(px - 9, py - 8, 18, 4);
      ctx.fillStyle = "#fff9eb";
      ctx.font = 'bold 11px "Microsoft YaHei",sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(D.species[mon.id].types[0].slice(0, 1), px, py - 11);
    }
    ctx.restore();
  }
  function drawEffect(ctx, event, time) {
    const [when, side, action] = event;
    const age = time - when;
    if (age < 0 || age > 550) return;
    ctx.save();
    if (action === "cast") {
      const [, , , , type, kind, x, y, aimX, aimY, flight] = event;
      const color = tint[type] || "#eddbb5";
      const ox = x * 4.8,
        oy = y * 2.7 - 13;
      const tx = aimX * 4.8,
        ty = aimY * 2.7 - 13;
      const f = Math.min(1, age / flight);
      ctx.globalAlpha = Math.max(0, 1 - age / 570);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      if (kind === "beam") {
        ctx.lineWidth = 13 * (1 - age / 600);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.strokeStyle = "#fffde0";
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (kind === "shot") {
        const px = ox + (tx - ox) * f,
          py = oy + (ty - oy) * f;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px - (tx - ox) * 0.11, py - (ty - oy) * 0.11);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.fillRect(Math.round(px - 4), Math.round(py - 4), 8, 8);
        ctx.fillStyle = "#fffed2";
        ctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
      } else {
        const centerX =
          kind === "guard" ? ox : kind === "dash" ? ox + (tx - ox) * 0.4 : tx;
        const centerY =
          kind === "guard" ? oy : kind === "dash" ? oy + (ty - oy) * 0.4 : ty;
        const span = 6 + age * 0.067;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, span, span * 0.56, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
    } else {
      const [, , , amount, x, y] = event;
      const px = x * 4.8,
        py = y * 2.7 - 23 - age * 0.039;
      ctx.globalAlpha = 1 - age / 580;
      ctx.font = 'bold 12px "Microsoft YaHei",sans-serif';
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#263238";
      ctx.fillStyle =
        action === "miss" ? "#f5ffff" : side ? "#fff0a5" : "#ffd0ad";
      const label = action === "miss" ? "闪避" : amount ? "−" + amount : "0";
      ctx.strokeText(label, px, py);
      ctx.fillText(label, px, py);
    }
    ctx.restore();
  }
  const pct = (hp, mon) => Math.round((hp / mon.hp) * 100);
  function hud(mon, actor, side) {
    const hp = actor[3];
    return (
      '<div class="rowline"><b>' +
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
      (pct(hp, mon) <= 30) +
      '"><span style="width:' +
      pct(hp, mon) +
      '%"></span></div><small class="battle-hp-text">' +
      hp +
      " / " +
      mon.hp +
      " · " +
      (side ? "对手" : "同行伙伴") +
      "</small>"
    );
  }
  function blended(a, b, f) {
    if (a[0] !== b[0]) return a;
    return [
      a[0],
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
      a[3],
      a[4],
      a[5],
    ];
  }
  function clock(time) {
    const seconds = Math.floor(time / 1000);
    return (
      "0" +
      Math.floor(seconds / 60) +
      ":" +
      String(seconds % 60).padStart(2, "0")
    );
  }
  function canReplay(record) {
    return record?.replay?.format === 2 && record.replay.frames?.length > 1;
  }
  function replay(record) {
    if (!canReplay(record)) return;
    cancelAnimationFrame(raf);
    closeModal();
    current = record;
    const { roster, opponents, frames, events } = record.replay;
    const squads = [roster, opponents];
    const stop = area().stops[record.stop];
    $("battle-title").textContent =
      (stop ? stop.name + " · " : "") + record.leader;
    $("battle-kind").textContent = record.league
      ? "联盟 · 实时自动对战"
      : "道馆 · 实时自动对战";
    const skip = $("battle-skip");
    skip.textContent = "跳到结果";
    $("battle-body").innerHTML =
      '<div class="arena-scoreboard"><div class="arena-hud" id="arena-ally"></div><div class="arena-clock" id="arena-clock"></div><div class="arena-hud" id="arena-foe"></div></div><div class="arena-field"><canvas id="arena-canvas" width="480" height="270" aria-label="宝可梦在赛场上自主移动和施放招式"></canvas></div><div class="battle-status arena-status"><span id="arena-move" aria-live="polite">双方入场，自动对战开始。</span><strong id="arena-result" role="status"></strong></div>';
    const ctx = $("arena-canvas").getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (!dialog.open) dialog.showModal();
    const duration = frames[frames.length - 1][0];
    let index = 0,
      next = 0,
      tail = 0,
      lastCast = null;
    const hudKeys = [null, null];
    const paint = (time, instant = false) => {
      while (index + 1 < frames.length && frames[index + 1][0] <= time) index++;
      const left = frames[index],
        right = frames[Math.min(frames.length - 1, index + 1)];
      const f = (time - left[0]) / Math.max(1, right[0] - left[0]);
      const pair = [
        blended(left[1], right[1], reduced.matches ? 0 : f),
        blended(left[2], right[2], reduced.matches ? 0 : f),
      ];
      ctx.clearRect(0, 0, 480, 270);
      pair
        .map((actor, side) => {
          const mon = squads[side][actor[0]],
            key = actor[0] + "/" + actor[3];
          if (hudKeys[side] !== key) {
            hudKeys[side] = key;
            $(side ? "arena-foe" : "arena-ally").innerHTML = hud(
              mon,
              actor,
              side,
            );
          }
          return { mon, actor, side };
        })
        .sort((a, b) => a.actor[2] - b.actor[2])
        .forEach(({ mon, actor, side }) =>
          drawMon(ctx, mon, actor, time, side),
        );
      $("arena-clock").textContent = clock(time);
      if (instant) return;
      while (next < events.length && events[next][0] <= time) {
        const event = events[next++];
        if (event[2] === "cast") lastCast = event;
      }
      while (tail < next && events[tail][0] < time - 550) tail++;
      for (let i = tail; i < next; i++) drawEffect(ctx, events[i], time);
      if (lastCast) {
        const label =
          name(lastCast[11]) + " · " + lastCast[3] + " · " + lastCast[4];
        if ($("arena-move").textContent !== label)
          $("arena-move").textContent = label;
      }
    };
    const finish = () => {
      cancelAnimationFrame(raf);
      paint(duration, true);
      $("arena-move").textContent = record.win
        ? "胜利已计入旅行进度。"
        : "调整阵容或提升等级后，队伍将自动再战。";
      $("arena-result").textContent = record.win ? "挑战胜利" : "挑战未通过";
      skip.textContent = "返回旅行";
      skip.onclick = () => dialog.close();
    };
    skip.onclick = finish;
    paint(0);
    const start = performance.now();
    function frame(now) {
      if (!dialog.open || current !== record) return;
      const progress = Math.min(
        duration,
        (now - start) * (reduced.matches ? 1.7 : 1),
      );
      if (progress === duration) finish();
      else {
        paint(progress);
        raf = requestAnimationFrame(frame);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  dialog.addEventListener("close", () => {
    cancelAnimationFrame(raf);
    current = null;
  });
  function observe(s, first) {
    const latest = s?.history[0];
    if (!canReplay(latest)) return;
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
  return { replay, observe, canReplay };
})();
