/* The trail follows the centre of the painted path in each habitat. */
(() => {
  const canvas = document.getElementById("world"),
    ctx = canvas.getContext("2d"),
    cache = new Map();
  ctx.imageSmoothingEnabled = false;
  function img(src) {
    if (!cache.has(src)) {
      const el = new Image();
      el.src = src;
      cache.set(src, el);
    }
    return cache.get(src);
  }
  function usable(el) {
    return el.complete && el.naturalWidth > 0;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const red = "#c94a36",
    hair = "#48382c",
    skin = "#edb787",
    shoe = "#473b36",
    blue = "#375c79";
  // A side-facing trainer with a cap, shoulder straps and a field pack.
  function trainer(x, y, dir, walk) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(dir, 1);
    ctx.fillStyle = "#32483145";
    ctx.fillRect(-7, -2, 14, 3);
    const bounce = walk % 2;
    ctx.translate(0, -bounce);
    function px(c, a, b, w, h) {
      ctx.fillStyle = c;
      ctx.fillRect(a, b, w, h);
    }
    px(shoe, -4, -9, 8, 7);
    px(blue, -4, -9, 7, 4);
    px(shoe, -5 - (walk % 2), -3, 5, 3);
    px(shoe, 1 + (walk % 2), -3, 5, 3);
    px("#e2d9b2", 2 + (walk % 2), -1, 4, 1);
    px("#344436", -6, -17, 11, 9);
    px("#466d89", -4, -16, 7, 7);
    px("#efdcbb", 0, -16, 3, 5);
    px("#dadac8", 3, -13, 2, 5);
    px(skin, 3, -11, 3, 4);
    px("#705530", -8, -16, 5, 9);
    px("#c39b54", -7, -16, 4, 7);
    px("#f2ca75", -6, -15, 2, 2);
    px(hair, -5, -23, 10, 8);
    px(skin, -1, -21, 7, 6);
    px(hair, 4, -20, 1, 2);
    px("#793e31", -6, -26, 11, 5);
    px(red, -5, -27, 9, 5);
    px("#eb7960", -3, -27, 5, 2);
    px("#ffebcb", 0, -25, 4, 3);
    px(hair, -5, -22, 14, 2);
    px(red, -5, -23, 14, 2);
    ctx.restore();
  }
  const directionVectors = [
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  function fieldMarker(id, x, y, direction, frame) {
    const [body, edge] = colors(id);
    const [dx, dy] = directionVectors[direction];
    const cx = Math.round(x),
      cy = Math.round(y - 12 - (frame % 2));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#22342b";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillRect(-5, -9, 10, 18);
    ctx.fillStyle = body;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillRect(-4, -8, 8, 16);
    ctx.fillStyle = edge;
    ctx.fillRect(-5, 4, 10, 3);
    ctx.fillStyle = "#fff4d3";
    ctx.fillRect(dx * 5 - 1, dy * 6 - 1, 3, 3);
    ctx.fillStyle = "#fff7dc";
    ctx.font = 'bold 8px "Microsoft YaHei",sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(D.species[id].types[0].slice(0, 1), 0, 0);
    ctx.restore();
  }
  function mon(id, x, y, d, t, scale = 1) {
    const frame = Math.floor(t / 170 + id * 0.3) % 4;
    ctx.fillStyle = "#31493745";
    ctx.fillRect(
      Math.round(x - 6 * scale),
      Math.round(y - scale),
      Math.round(12 * scale),
      Math.ceil(3 * scale),
    );
    if (!animatedMon.has(id)) {
      fieldMarker(id, x, y, d, frame);
      return;
    }
    const sheet = img("assets/mon/" + id + ".png");
    if (!usable(sheet)) return;
    ctx.drawImage(
      sheet,
      frame * 64,
      d * 64,
      64,
      64,
      Math.round(x - 32 * scale),
      Math.round(y - 60 * scale),
      64 * scale,
      64 * scale,
    );
  }
  const pathCenters = { plateau: 163, volcanic: 150 };
  function pos(t, center) {
    const ph = (((t % 28000) + 28000) % 28000) / 28000;
    const forward = ph < 0.5;
    const f = forward ? ph * 2 : (1 - ph) * 2;
    const x = 96 + f * 283,
      y = center + Math.sin(x / 30) * 2.3 + Math.cos(x / 61) * 2;
    return { x, y, forward };
  }
  function draw(t) {
    requestAnimationFrame(draw);
    if (document.hidden || page !== "field") return;
    if (reduced.matches) t = 5500;
    const s = state,
      r = s ? J.route(s) : demoRegion.stops[0];
    const bg = img("assets/scenes/" + r.scene + ".png");
    if (!usable(bg)) return;
    ctx.drawImage(bg, 0, 0, 480, 240);
    if (!s) {
      trainer(236, 156, 1, 0);
      [1, 4, 7].forEach((id, i) =>
        mon(
          id,
          263 + i * 17,
          151 + (i % 2) * 11,
          starter === id ? 2 : 1,
          t,
          0.94,
        ),
      );
      return;
    }
    const center = pathCenters[r.scene] ?? 156;
    const lead = pos(t, center);
    const actors = [
      { x: lead.x, y: lead.y, trainer: true, dir: lead.forward ? 1 : -1 },
    ];
    s.team.forEach((id, i) => {
      const p = pos(t - 950 * (i + 1), center);
      const old = pos(t - 950 * (i + 1) - 300, center);
      const dy = p.y - old.y,
        d = p.forward
          ? dy > 0.42
            ? 7
            : dy < -0.42
              ? 5
              : 6
          : dy > 0.42
            ? 1
            : dy < -0.42
              ? 3
              : 2;
      actors.push({ id, x: p.x, y: p.y + (i % 2 ? 3 : -1), d });
    });
    const recent = s.recent,
      age = recent ? Date.now() - recent.time : Infinity;
    const captured = recent?.reason === "成功收服";
    if (age >= 0 && age < (captured ? 2000 : 6000)) {
      actors.push({
        id: recent.id,
        x: lead.x + (lead.forward ? 30 : -30),
        y: lead.y - 5,
        d: lead.forward ? 2 : 6,
      });
    }
    actors
      .sort((a, b) => a.y - b.y)
      .forEach((p) =>
        p.trainer
          ? trainer(p.x, p.y, p.dir, Math.floor(t / 175) % 4)
          : mon(p.id, p.x, p.y, p.d, t, 0.98),
      );
    if (age >= 2000 && age < 6500 && recent) {
      const label = name(recent.id) + " · " + recent.reason;
      ctx.font = 'bold 9px "Microsoft YaHei",sans-serif';
      const width = Math.ceil(ctx.measureText(label).width) + 14;
      const x = Math.max(
        6,
        Math.min(474 - width, Math.round(lead.x - width / 2)),
      );
      const y = Math.round(lead.y - 46);
      ctx.fillStyle = "#213e32";
      ctx.fillRect(x, y, width, 16);
      ctx.fillStyle = captured ? "#ffdc78" : "#f5f5de";
      ctx.fillText(label, x + 7, y + 11);
    }
    if (
      age >= 1100 &&
      age < 2000 &&
      recent &&
      ["成功收服", "投球后逃走"].includes(recent.reason)
    ) {
      const f = (age - 1100) / 900,
        x = Math.round(lead.x + (lead.forward ? 1 : -1) * 30 * f),
        y = Math.round(lead.y - 15 - 12 * Math.sin(f * Math.PI));
      ctx.fillStyle = "#29382b";
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = "#e1654e";
      ctx.fillRect(x - 1, y - 1, 3, 1);
      ctx.fillStyle = "#f4f0cd";
      ctx.fillRect(x - 1, y + 1, 3, 1);
    }
  }
  requestAnimationFrame(draw);
})();
