/* One fixed clock advances movement, skills, and collisions for both sides. */
const JourneyArena = (() => {
  const step = 100;
  const ceiling = 64_000;
  const boundary = { left: 14, right: 86, top: 28, bottom: 83 };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  function segmentGap(point, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const fraction = clamp(
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
    return Math.hypot(
      point.x - a.x - fraction * dx,
      point.y - a.y - fraction * dy,
    );
  }
  const lerp = (a, b, f) => ({
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
  });
  const styles = {
    dash: { range: 15, windup: 200, flight: 100, cooldown: 900, spread: 8 },
    shot: { range: 45, windup: 300, flight: 400, cooldown: 1400, spread: 12 },
    beam: { range: 54, windup: 500, flight: 200, cooldown: 1800, spread: 9 },
    wave: { range: 29, windup: 400, flight: 200, cooldown: 1500, spread: 14 },
    guard: { range: 90, windup: 200, flight: 100, cooldown: 3300, spread: 0 },
  };
  const dashes = new Set([
    "撞击",
    "抓",
    "拍击",
    "电光一闪",
    "火焰牙",
    "劈开",
    "空手劈",
    "踢倒",
    "二连踢",
    "翅膀攻击",
    "挖洞",
    "虫咬",
    "咬住",
    "吸血",
    "电光",
  ]);
  const beams = new Set([
    "十万伏特",
    "冰冻光束",
    "水炮",
    "精神强念",
    "龙之波动",
    "阳光烈焰",
    "暗影球",
  ]);
  function shape(name, type, power) {
    if (!power && name !== "吐丝") return "guard";
    if (dashes.has(name)) return "dash";
    if (beams.has(name)) return "beam";
    if (
      ["念力", "龙卷风", "起风", "魅惑之声"].includes(name) ||
      type === "岩石"
    )
      return "wave";
    return "shot";
  }
  function outgoing(mon, target, move, moves, hit) {
    const [type, power] = moves[move];
    const kind = shape(move, type, power);
    return {
      name: move,
      type,
      kind,
      damage: Math.round(
        hit(mon.level, move, mon.types, target.types) * (1 + mon.stage * 0.13),
      ),
      slow: move === "吐丝",
      ...styles[kind],
    };
  }
  function useful(attacker, defender, moves, hit) {
    const gap = distance(attacker, defender);
    const options = attacker.moves.map((move) =>
      outgoing(attacker, defender, move, moves, hit),
    );
    const score = (skill) =>
      skill.damage / (skill.cooldown / 1000) +
      (skill.kind === "guard" ? -6 : skill.slow ? 2 : 0) +
      (gap <= skill.range ? 3 : 0);
    const positive = options.some((skill) => skill.damage > 0);
    const chosen = (
      positive ? options.filter((skill) => skill.damage > 0) : options
    ).sort((a, b) => score(b) - score(a))[0];
    const support = options.find(
      (skill) => skill.kind === "guard" || skill.slow,
    );
    const canSupport = support && positive && (attacker.casts + 1) % 4 === 0;
    return { chosen, planned: canSupport ? support : chosen };
  }
  function spawn(mon, index, seat, now) {
    return {
      ...mon,
      index,
      side: seat,
      life: mon.hp,
      x: seat ? 73 : 27,
      y: seat ? 43 : 65,
      ready: now + 500 + seat * 200,
      dashAfter: now + 1200 + seat * 900,
      dashing: 0,
      guardUntil: 0,
      slowUntil: 0,
      casts: 0,
      pending: null,
      flash: 0,
      pose: 0,
      facing: seat ? 2 : 6,
    };
  }
  function heading(dx, dy) {
    const octant = Math.round(Math.atan2(dx, dy) / (Math.PI / 4));
    return (8 - octant) % 8;
  }
  function moveToward(mon, foe, skill, threats, now) {
    const dx = foe.x - mon.x,
      dy = foe.y - mon.y,
      gap = Math.max(0.1, Math.hypot(dx, dy));
    const sign =
      Math.sin((now + mon.id * 113 + mon.side * 989) / 1490) > 0 ? 1 : -1;
    let strike = false;
    for (const attack of threats) {
      if (
        attack.target === mon &&
        attack.kind !== "guard" &&
        attack.due - now <= 240 &&
        now >= mon.dashAfter
      ) {
        strike = (Math.floor(now / 100) + mon.id + mon.casts) % 3 !== 0;
        if (strike) break;
      }
    }
    if (strike) {
      mon.dashing = now + 300;
      mon.dashAfter = now + 2800;
    }
    const dash = mon.dashing > now;
    const intent = Math.min(47, skill.range * 0.8);
    const radial =
      gap > intent + 2
        ? 1
        : gap < intent - 5 && skill.kind !== "dash"
          ? -0.6
          : 0.14;
    const lateral = dash ? sign * 2.4 : sign * 0.48;
    const prepare = mon.pending && !dash ? 0.2 : 1;
    const slowed = mon.slowUntil > now ? 0.53 : 1;
    const speed = (1.25 + (mon.id % 11) * 0.055) * prepare * slowed;
    mon.x = clamp(
      mon.x + (((dash ? 0 : radial) * dx - lateral * dy) / gap) * speed,
      boundary.left,
      boundary.right,
    );
    mon.y = clamp(
      mon.y + (((dash ? 0 : radial) * dy + lateral * dx) / gap) * speed,
      boundary.top,
      boundary.bottom,
    );
    mon.facing = heading(dx, dy);
    mon.pose = mon.flash > now ? 3 : dash ? 2 : mon.pending ? 1 : 0;
  }
  const actorFrame = (mon) => [
    mon.index,
    Math.round(mon.x),
    Math.round(mon.y),
    mon.life,
    mon.pose,
    mon.facing,
  ];
  function simulate(team, opponents, moves, hit) {
    const squads = [team, opponents];
    const slots = [0, 0];
    const actors = squads.map((group, side) => spawn(group[0], 0, side, 0));
    const frames = [],
      events = [],
      lines = [];
    let active = [];
    const snapshot = (time) => frames.push([time, ...actors.map(actorFrame)]);
    snapshot(0);
    let time = 0;
    for (time = step; time <= ceiling; time += step) {
      const decisions = actors.map((mon, side) =>
        useful(mon, actors[1 - side], moves, hit),
      );
      const threats = active.concat(
        actors.flatMap((mon) => (mon.pending ? [mon.pending] : [])),
      );
      actors.forEach((mon, side) =>
        moveToward(
          mon,
          actors[1 - side],
          decisions[side].chosen,
          threats,
          time,
        ),
      );
      actors.forEach((mon, side) => {
        const foe = actors[1 - side],
          { planned } = decisions[side];
        if (mon.pending?.due <= time) {
          const skill = mon.pending;
          mon.pending = null;
          mon.ready =
            time +
            (mon.side ? skill.cooldown : Math.round(skill.cooldown * 0.9));
          if (skill.kind === "dash") {
            const gap = Math.max(0.1, distance(mon, foe));
            const lunge = Math.min(7, Math.max(0, gap - 5));
            mon.x = clamp(
              mon.x + ((foe.x - mon.x) / gap) * lunge,
              boundary.left,
              boundary.right,
            );
            mon.y = clamp(
              mon.y + ((foe.y - mon.y) / gap) * lunge,
              boundary.top,
              boundary.bottom,
            );
          }
          active.push({
            ...skill,
            due: time + skill.flight,
            launched: time,
            origin: { x: mon.x, y: mon.y },
          });
          events.push([
            time,
            side,
            "cast",
            skill.name,
            skill.type,
            skill.kind,
            Math.round(mon.x),
            Math.round(mon.y),
            Math.round(skill.x),
            Math.round(skill.y),
            skill.flight,
            mon.id,
          ]);
        }
        if (
          !mon.pending &&
          time >= mon.ready &&
          distance(mon, foe) <= planned.range + 1
        ) {
          mon.pending = {
            ...planned,
            target: foe,
            source: mon,
            due: time + planned.windup,
            x: foe.x,
            y: foe.y,
          };
          mon.casts++;
        }
      });
      const damage = [0, 0];
      const decisive = [null, null];
      for (const skill of active) {
        const { source, target } = skill;
        const remaining = skill.due - time;
        if (remaining > 0 && skill.kind !== "shot") continue;
        if (source !== actors[source.side] || target !== actors[target.side])
          continue;
        if (skill.kind === "guard") {
          source.guardUntil = time + 1600;
          skill.resolved = true;
          continue;
        }
        const fraction = clamp((time - skill.launched) / skill.flight, 0, 1);
        const near =
          skill.kind === "dash"
            ? distance(source, target) <= skill.range + skill.spread
            : skill.kind === "beam"
              ? segmentGap(target, skill.origin, skill) <= skill.spread
              : skill.kind === "shot"
                ? fraction > 0 &&
                  segmentGap(
                    target,
                    lerp(
                      skill.origin,
                      skill,
                      Math.max(0, fraction - step / skill.flight),
                    ),
                    lerp(skill.origin, skill, fraction),
                  ) <= 6.5
                : distance(skill, target) <= skill.spread;
        if (remaining > 0 && !near) continue;
        skill.resolved = true;
        if (near) {
          if (skill.slow) target.slowUntil = time + 1250;
          const actual =
            target.guardUntil > time
              ? Math.round(skill.damage * 0.58)
              : skill.damage;
          damage[target.side] += actual;
          decisive[target.side] = skill;
          if (actual) target.flash = time + 300;
          events.push([
            time,
            target.side,
            "hit",
            actual,
            Math.round(target.x),
            Math.round(target.y),
          ]);
        } else {
          events.push([
            time,
            target.side,
            "miss",
            0,
            Math.round(skill.x),
            Math.round(skill.y),
          ]);
        }
      }
      active = active.filter((skill) => !skill.resolved && skill.due > time);
      for (const mon of actors) {
        mon.life = Math.max(0, mon.life - damage[mon.side]);
        if (!mon.life) {
          const by = decisive[mon.side];
          if (by)
            lines.push(
              by.source.name + "使用" + by.name + "击败了" + mon.name + "。",
            );
          slots[mon.side]++;
        }
      }
      const switched = actors.some((mon) => !mon.life);
      if (time % 200 === 0 || switched) snapshot(time);
      if (slots.some((slot, side) => slot >= squads[side].length)) break;
      if (switched) {
        actors.forEach((mon, side) => {
          if (!mon.life)
            actors[side] = spawn(
              squads[side][slots[side]],
              slots[side],
              side,
              time,
            );
          else mon.pending = null;
        });
        active = [];
        snapshot(time + 1);
      }
    }
    const finished =
      slots[1] >= squads[1].length && slots[0] < squads[0].length;
    if (time > ceiling) lines.push("达到对战时限，本场挑战未通过。");
    return {
      win: finished,
      lines,
      replay: {
        format: 2,
        roster: team.map(({ id, level, hp }) => ({ id, level, hp })),
        opponents: opponents.map(({ id, level, hp }) => ({ id, level, hp })),
        frames,
        events,
      },
    };
  }
  return { simulate };
})();
if (typeof module !== "undefined") module.exports = JourneyArena;
