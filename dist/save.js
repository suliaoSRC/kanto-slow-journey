const JourneySave = (() => {
  const data =
    typeof JourneyData !== "undefined" ? JourneyData : require("./data.js");
  const engine =
    typeof Journey !== "undefined" ? Journey : require("./engine.js");
  const isId = (id) => Number.isInteger(id) && Object.hasOwn(data.species, id);
  const int = (value, min, max) =>
    Number.isSafeInteger(value) && value >= min && value <= max;
  const object = (value) =>
    value && typeof value === "object" && !Array.isArray(value);
  const timestamp = (value) => int(value, 0, 8_640_000_000_000_000);
  const str = (value, cap) => typeof value === "string" && value.length <= cap;
  const rosterEntry = (entry) =>
    object(entry) &&
    isId(entry.id) &&
    int(entry.level, 1, 100) &&
    int(entry.hp, 1, 600);
  function arenaReplay(raw) {
    const groups = [raw.roster, raw.opponents],
      coord = (value) => int(value, 0, 100);
    if (
      !groups.every(
        (group, side) =>
          Array.isArray(group) &&
          group.length &&
          group.length <= (side ? 6 : 3) &&
          group.every(rosterEntry),
      )
    )
      return undefined;
    const actor = (frame, side) => {
      if (!Array.isArray(frame) || frame.length !== 6) return false;
      const [slot, x, y, hp, pose, direction] = frame;
      return (
        int(slot, 0, groups[side].length - 1) &&
        coord(x) &&
        coord(y) &&
        int(hp, 0, groups[side][slot].hp) &&
        int(pose, 0, 3) &&
        int(direction, 0, 7)
      );
    };
    const time = (value) => int(value, 0, 64_001);
    if (
      !Array.isArray(raw.frames) ||
      raw.frames.length < 2 ||
      raw.frames.length > 335 ||
      !raw.frames.every(
        (frame, index) =>
          Array.isArray(frame) &&
          frame.length === 3 &&
          time(frame[0]) &&
          (index ? frame[0] > raw.frames[index - 1][0] : frame[0] === 0) &&
          actor(frame[1], 0) &&
          actor(frame[2], 1),
      ) ||
      !Array.isArray(raw.events) ||
      raw.events.length > 600 ||
      !raw.events.every((event, index) => {
        if (
          !Array.isArray(event) ||
          !time(event[0]) ||
          (index && event[0] < raw.events[index - 1][0]) ||
          !int(event[1], 0, 1)
        )
          return false;
        if (event[2] === "cast")
          return (
            event.length === 12 &&
            Object.hasOwn(data.moves, event[3]) &&
            data.moves[event[3]][0] === event[4] &&
            ["dash", "shot", "beam", "wave", "guard"].includes(event[5]) &&
            event.slice(6, 10).every(coord) &&
            int(event[10], 100, 600) &&
            isId(event[11])
          );
        return (
          event.length === 6 &&
          ["hit", "miss"].includes(event[2]) &&
          int(event[3], 0, 2000) &&
          coord(event[4]) &&
          coord(event[5])
        );
      })
    )
      return undefined;
    const clean = (group) =>
      group.map(({ id, level, hp }) => ({ id, level, hp }));
    return {
      format: 2,
      roster: clean(groups[0]),
      opponents: clean(groups[1]),
      frames: raw.frames,
      events: raw.events,
    };
  }
  function replay(raw) {
    if (raw?.format === 2) return arenaReplay(raw);
    if (
      !object(raw) ||
      !Array.isArray(raw.roster) ||
      !raw.roster.length ||
      raw.roster.length > 3 ||
      !raw.roster.every(rosterEntry) ||
      !Array.isArray(raw.opponents) ||
      !raw.opponents.length ||
      raw.opponents.length > 6 ||
      !raw.opponents.every(rosterEntry) ||
      !Array.isArray(raw.turns) ||
      !raw.turns.length ||
      raw.turns.length > 320 ||
      !raw.turns.every(
        (turn) =>
          Array.isArray(turn) &&
          turn.length === 7 &&
          int(turn[0], 0, raw.roster.length - 1) &&
          int(turn[1], 0, raw.opponents.length - 1) &&
          int(turn[2], 0, raw.roster[turn[0]].hp) &&
          int(turn[3], 0, raw.opponents[turn[1]].hp) &&
          ["start", "ally", "foe"].includes(turn[4]) &&
          (turn[4] === "start" || Object.hasOwn(data.moves, turn[5])) &&
          int(turn[6], 0, 2000),
      )
    )
      return undefined;
    return {
      roster: raw.roster.map(({ id, level, hp }) => ({ id, level, hp })),
      opponents: raw.opponents.map(({ id, level, hp }) => ({
        id,
        level,
        hp,
        name: data.species[id].name,
      })),
      turns: raw.turns,
    };
  }
  function parse(text) {
    const s = JSON.parse(text);
    const region = data.regions.kanto;
    const lastStop = region.stops.length - 1;
    if (
      !object(s) ||
      s.region !== "kanto" ||
      ![1, 2, 3].includes(s.version) ||
      ![1, 4, 7].includes(s.starter) ||
      !int(s.stop, 0, lastStop) ||
      !int(s.furthest, 0, region.storyLength - 1) ||
      !int(s.progress, 0, region.stops[s.stop].steps) ||
      !int(s.steps, 0, 100_000_000) ||
      !int(s.seed, 0, 0xffffffff) ||
      !int(s.balls, 0, 99) ||
      !int(s.reserve, 0, 99) ||
      !["travel", "stay"].includes(s.mode) ||
      !timestamp(s.last) ||
      s.last > Date.now() + 86_400_000 ||
      !Array.isArray(s.team) ||
      s.team.length < 1 ||
      s.team.length > 3 ||
      new Set(s.team).size !== s.team.length ||
      !s.team.every(isId) ||
      !Array.isArray(s.badges) ||
      s.badges.length > Object.keys(region.gyms).length ||
      new Set(s.badges).size !== s.badges.length ||
      !s.badges.every(
        (id) => Number.isInteger(id) && Object.hasOwn(region.gyms, id),
      ) ||
      !object(s.box) ||
      !object(s.seen) ||
      !object(s.caught) ||
      !object(s.stones)
    )
      throw Error("invalid save");
    const box = {};
    for (const [id, mon] of Object.entries(s.box)) {
      if (
        !isId(+id) ||
        !object(mon) ||
        !int(mon.level, 1, 100) ||
        !int(mon.xp, 0, engine.xpNeeded(mon.level)) ||
        !Array.isArray(mon.moves) ||
        !mon.moves.length ||
        mon.moves.length > 2 ||
        !mon.moves.every(
          (move) => typeof move === "string" && Object.hasOwn(data.moves, move),
        )
      )
        throw Error("invalid partner");
      box[id] = { level: mon.level, xp: mon.xp, moves: mon.moves };
    }
    if (!s.team.every((id) => Object.hasOwn(box, id)))
      throw Error("invalid team");
    const hall = s.hall;
    const champion =
      hall == null
        ? null
        : object(hall) &&
            timestamp(hall.time) &&
            int(hall.count, 1, 1_000_000) &&
            Array.isArray(hall.team) &&
            hall.team.length &&
            hall.team.length <= 3 &&
            hall.team.every((mon) => isId(mon?.id) && int(mon?.level, 1, 100))
          ? {
              time: hall.time,
              count: hall.count,
              team: hall.team.map(({ id, level }) => ({ id, level })),
            }
          : undefined;
    if (
      champion === undefined ||
      (region.stops[s.stop].survey ? !champion : s.stop > s.furthest)
    )
      throw Error("invalid location");
    const getLog = (rows, cap) =>
      (Array.isArray(rows) ? rows : [])
        .slice(0, cap)
        .filter(
          (row) =>
            object(row) &&
            str(row.kind, 30) &&
            str(row.message, 300) &&
            timestamp(row.time),
        )
        .map(({ kind, message, time }) => ({ kind, message, time }));
    const history = (Array.isArray(s.history) ? s.history : [])
      .slice(0, 20)
      .filter(
        (row) =>
          object(row) &&
          str(row.leader, 40) &&
          typeof row.win === "boolean" &&
          timestamp(row.time) &&
          Array.isArray(row.lines),
      )
      .map((row) => ({
        leader: row.leader,
        win: row.win,
        time: row.time,
        league: Boolean(row.league),
        stop: int(row.stop, 0, lastStop) ? row.stop : undefined,
        lines: row.lines.filter((line) => str(line, 300)).slice(0, 20),
        replay: replay(row.replay),
      }));
    return engine.migrate({
      version: s.version,
      region: s.region,
      starter: s.starter,
      stop: s.stop,
      furthest: s.furthest,
      progress: s.progress,
      steps: s.steps,
      last: s.last,
      seed: s.seed,
      mode: region.stops[s.stop].survey ? "stay" : s.mode,
      balls: s.balls,
      reserve: s.reserve,
      box,
      team: s.team,
      badges: s.badges,
      target: isId(s.target) ? s.target : 0,
      only: isId(s.target) && Boolean(s.only),
      tutorial: Boolean(s.tutorial),
      seen: Object.fromEntries(
        Object.entries(s.seen).filter(
          ([id, value]) => isId(+id) && int(value, 0, lastStop),
        ),
      ),
      caught: Object.fromEntries(
        Object.entries(s.caught).filter(
          ([id, value]) => isId(+id) && value === true,
        ),
      ),
      stones: Object.fromEntries(
        Object.entries(s.stones).filter(
          ([stone, value]) =>
            data.stones.includes(stone) && int(value, 0, 1_000_000),
        ),
      ),
      research: int(s.research, 0, 100_000_000) ? s.research : 0,
      hall: champion,
      leagueWins: int(s.leagueWins, 0, region.league.rounds.length)
        ? s.leagueWins
        : 0,
      routeProgress: Object.fromEntries(
        Object.entries(s.routeProgress || {}).filter(
          ([i, v]) => int(+i, 0, lastStop) && int(v, 0, region.stops[+i].steps),
        ),
      ),
      history,
      logs: getLog(s.logs, 160),
      keyLogs: getLog(s.keyLogs, 90),
      retry: str(s.retry, 500) ? s.retry : "",
      recent: null,
    });
  }
  return { parse };
})();
if (typeof module !== "undefined") module.exports = JourneySave;
