const Journey = (() => {
  const data =
    typeof JourneyData !== "undefined" ? JourneyData : require("./data.js");
  const arena =
    typeof JourneyArena !== "undefined"
      ? JourneyArena
      : require("./arena-sim.js");
  const { species, moves, regions, availableMoves, stones, captureRates } =
    data;
  const xpNeeded = (level) => level * 16;
  const tick = 30000,
    cap = 12 * 60 * 60 * 1000;
  const effectiveness = {
    一般: [[], ["岩石", "钢"], ["幽灵"]],
    火: [
      ["草", "虫", "冰", "钢"],
      ["火", "水", "岩石", "龙"],
    ],
    水: [
      ["火", "地面", "岩石"],
      ["水", "草", "龙"],
    ],
    草: [
      ["水", "地面", "岩石"],
      ["火", "草", "毒", "飞行", "虫", "钢", "龙"],
    ],
    电: [["水", "飞行"], ["电", "草", "龙"], ["地面"]],
    格斗: [
      ["一般", "岩石", "冰", "钢", "恶"],
      ["毒", "飞行", "超能力", "虫", "妖精"],
      ["幽灵"],
    ],
    地面: [["火", "电", "毒", "岩石", "钢"], ["草", "虫"], ["飞行"]],
    虫: [
      ["草", "超能力", "恶"],
      ["火", "格斗", "毒", "飞行", "幽灵", "钢", "妖精"],
    ],
    岩石: [
      ["火", "虫", "飞行", "冰"],
      ["格斗", "地面", "钢"],
    ],
    毒: [["草", "妖精"], ["毒", "地面", "岩石", "幽灵"], ["钢"]],
    飞行: [
      ["虫", "草", "格斗"],
      ["电", "岩石", "钢"],
    ],
    妖精: [
      ["格斗", "龙", "恶"],
      ["火", "毒", "钢"],
    ],
    超能力: [["格斗", "毒"], ["超能力", "钢"], ["恶"]],
    恶: [
      ["超能力", "幽灵"],
      ["格斗", "恶", "妖精"],
    ],
    龙: [["龙"], ["钢"], ["妖精"]],
    冰: [
      ["草", "地面", "飞行", "龙"],
      ["火", "水", "冰", "钢"],
    ],
  };
  const region = (s) => regions[s.region],
    route = (s) => region(s).stops[s.stop];
  const name = (id) => species[id].name;
  const record = (s, kind, message, time) => {
    s.logs.unshift({ kind, message, time });
    s.logs.length = Math.min(s.logs.length, 160);
    if (
      ["收服", "徽章", "进化", "抵达", "伙伴", "联盟", "冠军"].includes(kind)
    ) {
      s.keyLogs.unshift({ kind, message, time });
      s.keyLogs.length = Math.min(90, s.keyLogs.length);
    }
  };
  function random(s) {
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function add(s, id, level) {
    s.caught[id] = true;
    s.seen[id] ??= s.stop;
    if (!s.box[id])
      s.box[id] = {
        level,
        xp: 0,
        moves: availableMoves(id, level).slice(0, 2),
      };
    if (s.team.length < 3 && !s.team.includes(id)) s.team.push(id);
  }
  function start(
    id,
    now = Date.now(),
    seed = Math.floor(Math.random() * 0xffffffff),
  ) {
    const s = {
      version: 3,
      research: 0,
      routeProgress: {},
      leagueWins: 0,
      hall: null,
      region: "kanto",
      stop: 0,
      furthest: 0,
      progress: 0,
      steps: 0,
      badges: [],
      mode: "travel",
      target: 0,
      only: false,
      reserve: 3,
      balls: 12,
      stones: {},
      box: {},
      team: [],
      seen: {},
      caught: {},
      logs: [],
      keyLogs: [],
      last: now - 22000,
      seed,
      tutorial: true,
      history: [],
      retry: "",
      recent: null,
      starter: id,
    };
    add(s, id, 5);
    record(s, "出发", "和" + name(id) + "一起从真新镇出发。", now);
    return s;
  }
  function migrate(s) {
    if (s.version === 1) {
      s.version = 2;
      s.routeProgress = Object.fromEntries(
        region(s)
          .stops.slice(0, s.furthest)
          .map((stop, index) => [index, stop.steps]),
      );
      s.leagueWins = 0;
      s.hall = null;
      delete s.stones.undefined;
    }
    if (s.version === 2) {
      s.version = 3;
      s.research = Math.floor(s.steps / 30);
    }
    return s;
  }
  function canVisit(s, index) {
    const stop = region(s).stops[index];
    return Boolean(stop && (stop.survey ? s.hall : index <= s.furthest));
  }
  function visit(s, stop) {
    if (
      !Number.isInteger(stop) ||
      stop < 0 ||
      !canVisit(s, stop) ||
      stop === s.stop
    )
      return false;
    s.routeProgress[s.stop] = s.progress;
    s.stop = stop;
    s.progress = s.routeProgress[stop] ?? 0;
    s.mode = "stay";
    s.retry = "";
    return true;
  }
  function placeInParty(s, id, slot = s.team.length) {
    if (
      !s.box[id] ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= 3 ||
      slot > s.team.length
    )
      return false;
    const current = s.team.indexOf(id);
    if (current === slot) return false;
    if (current >= 0) {
      if (slot >= s.team.length) return false;
      [s.team[slot], s.team[current]] = [id, s.team[slot]];
    } else if (slot === s.team.length) s.team.push(id);
    else s.team[slot] = id;
    return true;
  }
  function storePartner(s, id) {
    const index = s.team.indexOf(id);
    if (index < 0 || s.team.length <= 1) return false;
    s.team.splice(index, 1);
    return true;
  }
  function leagueRound(s) {
    const league = region(s).league;
    return s.stop === league.stop ? league.rounds[s.leagueWins] : undefined;
  }
  function rematch(s) {
    const league = region(s).league;
    if (!s.hall || s.leagueWins < league.rounds.length) return false;
    visit(s, league.stop);
    s.leagueWins = 0;
    s.retry = "";
    s.mode = "travel";
    return true;
  }
  function effect(type, types) {
    const [up = [], down = [], zero = []] = effectiveness[type] || [];
    return types.reduce(
      (n, t) =>
        n *
        (zero.includes(t)
          ? 0
          : up.includes(t)
            ? 2
            : down.includes(t)
              ? 0.5
              : 1),
      1,
    );
  }
  function hit(level, move, own, enemy) {
    const [type, power] = moves[move];
    return power
      ? Math.max(
          0,
          Math.round(
            (3 + (power * level) / 100) *
              effect(type, enemy) *
              (own.includes(type) ? 1.35 : 1),
          ),
        )
      : 0;
  }
  function battle(s, foes) {
    const team = s.team.map((id) => {
      const mon = s.box[id];
      return {
        id,
        name: name(id),
        level: mon.level,
        moves: mon.moves,
        stage: species[id].stage,
        types: species[id].types,
        hp: 18 + mon.level * 3 + species[id].stage * 9,
      };
    });
    const opponents = foes.map(([id, name, types, level, move]) => ({
      id,
      name,
      types,
      level,
      moves: [move],
      stage: 0,
      hp: 16 + level * 2,
    }));
    return arena.simulate(team, opponents, moves, hit);
  }
  function challenge(s, now) {
    const gym = region(s).gyms[s.stop];
    const inLeague = !gym;
    const next = gym || leagueRound(s);
    if (!next || (gym && s.badges.includes(s.stop))) return;
    if (inLeague && s.badges.length < Object.keys(region(s).gyms).length)
      return;
    const signature = [
      s.stop,
      inLeague ? s.leagueWins : "gym",
      ...s.team.map((id) =>
        [id, s.box[id].level, s.box[id].moves.join(".")].join("/"),
      ),
    ].join(",");
    if (signature === s.retry) return;
    s.retry = signature;
    const levelBonus = inLeague && s.hall ? Math.min(12, s.hall.count * 4) : 0;
    const foes = levelBonus
      ? next.foes.map(([id, label, types, level, move]) => [
          id,
          label,
          types,
          level + levelBonus,
          move,
        ])
      : next.foes;
    const { win, lines, replay } = battle(s, foes);
    const history = {
      leader: next.leader,
      win,
      lines,
      time: now,
      league: inLeague,
      stop: s.stop,
      replay,
    };
    s.history = [
      history,
      ...s.history.filter((entry) => entry.leader !== next.leader),
    ].slice(0, 20);
    if (!win) {
      record(
        s,
        inLeague ? "挑战" : "道馆",
        "挑战" + next.leader + "失利。调整阵容或升级后，队伍会自动再战。",
        now,
      );
      return;
    }
    if (inLeague) {
      s.leagueWins++;
      s.retry = "";
      if (s.leagueWins < region(s).league.rounds.length) {
        record(
          s,
          "联盟",
          "在石英高原战胜了" + next.leader + "。下一轮即将开始。",
          now,
        );
        return;
      }
      s.hall = {
        time: s.hall?.time ?? now,
        count: (s.hall?.count ?? 0) + 1,
        team: s.team.map((id) => ({ id, level: s.box[id].level })),
      };
      s.mode = "stay";
      record(s, "冠军", "战胜" + next.leader + "，队伍已进入关都名人堂！", now);
      return;
    }
    s.badges.push(s.stop);
    s.retry = "";
    record(s, "徽章", "战胜" + gym.leader + "，获得" + gym.badge + "！", now);
    const gift = [1, 4, 7].find((x) => !s.caught[x]);
    if (gift) {
      add(s, gift, Math.max(8, route(s).level));
      record(s, "伙伴", "博士托人送来了" + name(gift) + "。", now);
    }
    const stone = ["雷之石", "月之石", "叶之石"][s.badges.length - 1];
    if (stone) s.stones[stone] = (s.stones[stone] || 0) + 1;
  }
  function exchangeStone(s, stone) {
    if (!stones.includes(stone) || s.badges.length < 3 || s.research < 1)
      return false;
    s.research--;
    s.stones[stone] = (s.stones[stone] || 0) + 1;
    return true;
  }
  function wildId(s, r) {
    if (s.tutorial) return 16;
    if (
      s.target &&
      !s.box[s.target] &&
      r.encounters.includes(s.target) &&
      random(s) < 0.42
    )
      return s.target;
    const pool = r.expanded?.length && random(s) < 0.48 ? r.expanded : r.pool;
    const id = pool[Math.floor(random(s) * pool.length)];
    if (!species[id].rare || random(s) < 0.16) return id;
    const common = r.encounters.filter((id) => !species[id].rare);
    return common.length ? common[Math.floor(random(s) * common.length)] : id;
  }
  function encounter(s, now) {
    const r = route(s);
    if (!r.pool.length) return;
    const id = wildId(s, r);
    s.seen[id] ??= s.stop;
    const target = id === s.target;
    let reason = "",
      kind = "目击";
    if (target && s.box[id]) reason = "目标伙伴已在队伍或寄存处";
    else if (!target && (s.only || s.caught[id])) reason = "按捕捉偏好跳过";
    else if (s.balls <= 0 || (!target && s.target && s.balls <= s.reserve))
      reason = "可用精灵球不足";
    else {
      s.balls--;
      const chance = species[id].rare
        ? target
          ? 0.44
          : 0.22
        : target
          ? 0.83
          : 0.53 + (0.2 * captureRates[id]) / 255;
      if (s.tutorial || random(s) < chance) {
        add(s, id, r.level);
        reason = "成功收服";
        kind = "收服";
      } else reason = "投球后逃走";
    }
    s.tutorial = false;
    s.recent = { id, time: now, reason };
    record(s, kind, r.name + "遇见" + name(id) + "，" + reason + "。", now);
  }
  function step(s, now) {
    s.steps++;
    if (s.steps % 30 === 0) s.research++;
    if (s.tutorial && s.stop === 0 && s.mode === "travel") {
      s.stop = 1;
      s.furthest = 1;
      s.progress = 0;
      record(s, "抵达", "抵达1号道路。" + route(s).note, now);
    }
    const terrainLevel = route(s).level;
    const lateTraining = terrainLevel >= 29 ? 2 : 1;
    for (const id of s.team) {
      const mon = s.box[id];
      if (mon.level >= 100) continue;
      mon.xp += Math.min(
        8,
        Math.max(
          lateTraining,
          Math.ceil((terrainLevel - mon.level) / 3) + lateTraining,
        ),
      );
      if (mon.xp >= xpNeeded(mon.level)) {
        mon.xp -= xpNeeded(mon.level);
        mon.level++;
      }
    }
    if (s.steps % 6 === 0) s.balls = Math.min(99, s.balls + 2);
    if (s.tutorial || s.steps % 3 === 0) encounter(s, now);
    if (s.mode === "stay" || route(s).survey) return;
    s.progress = Math.min(route(s).steps, s.progress + 1);
    if (s.progress < route(s).steps) return;
    const gym = region(s).gyms[s.stop];
    if (gym && !s.badges.includes(s.stop)) {
      challenge(s, now);
      if (!s.badges.includes(s.stop)) return;
    }
    if (s.stop === region(s).league.stop) {
      if (leagueRound(s)) challenge(s, now);
      else s.mode = "stay";
      return;
    }
    if (s.stop + 1 >= region(s).storyLength) {
      s.mode = "stay";
      return;
    }
    s.routeProgress[s.stop] = route(s).steps;
    s.stop++;
    s.furthest = Math.max(s.furthest, s.stop);
    s.progress = s.routeProgress[s.stop] ?? 0;
    s.retry = "";
    record(s, "抵达", "抵达" + route(s).name + "。" + route(s).note, now);
  }
  function advance(s, now) {
    migrate(s);
    if (now < s.last) return 0;
    const elapsed = Math.min(cap, now - s.last),
      n = Math.floor(elapsed / tick);
    const from = now - elapsed;
    for (let k = 1; k <= n; k++) step(s, from + k * tick);
    s.last = from + n * tick;
    return n;
  }
  function canEvolve(s, id, next) {
    const mon = s?.box[id];
    const edge = species[id]?.evolutions.find((choice) => choice.id === next);
    if (!mon || !edge) return false;
    const rule = edge.rule;
    if (typeof rule === "string") return s.stones[rule] > 0;
    return mon.level >= (typeof rule === "number" ? rule : rule.bond);
  }
  function evolve(s, id, now, next = species[id]?.evolutions[0]?.id) {
    if (!canEvolve(s, id, next)) return false;
    const m = s.box[id];
    const rule = species[id].evolutions.find(
      (choice) => choice.id === next,
    ).rule;
    if (typeof rule === "string") s.stones[rule]--;
    const other = s.box[next];
    if (!other || other.level < m.level) {
      const learned = availableMoves(next, m.level);
      const equipped = m.moves.filter((move) => learned.includes(move));
      s.box[next] = {
        level: m.level,
        xp: m.xp,
        moves: [...new Set([...equipped, ...learned])].slice(0, 2),
      };
    }
    delete s.box[id];
    s.team = [...new Set(s.team.map((i) => (i === id ? next : i)))];
    s.caught[next] = true;
    s.seen[next] ??= s.stop;
    record(s, "进化", name(id) + "进化成了" + name(next) + "！", now);
    return true;
  }
  return {
    start,
    migrate,
    visit,
    placeInParty,
    storePartner,
    canVisit,
    exchangeStone,
    canEvolve,
    leagueRound,
    rematch,
    advance,
    evolve,
    region,
    route,
    challenge,
    tick,
    cap,
    xpNeeded,
  };
})();
if (typeof module !== "undefined") module.exports = Journey;
