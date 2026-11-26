const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const game = require("../dist/engine.js");
const saves = require("../dist/save.js");
const data = require("../dist/data.js");

const now = 100000000;
const { league, gyms, stops, stopNamesEN } = data.regions.kanto;
const badgeStops = Object.keys(gyms).map(Number);
assert.equal(Object.keys(data.species).length, 1025);
assert.equal(data.regions.kanto.ids.length, 151);
assert.equal(
  Object.values(data.fieldRegions)
    .filter((field) => !field.extension)
    .flatMap((field) => field.ids).length,
  1025,
);
const reachable = new Set([
  1,
  4,
  7,
  ...stops.flatMap((stop) => stop.encounters),
]);
for (const id of reachable) {
  for (const edge of data.species[id].evolutions) reachable.add(edge.id);
}
assert.equal(reachable.size, 1025);
for (const spec of Object.values(data.species)) {
  assert.ok(spec.name.length && spec.types.every(Boolean));
  if (spec.parent) assert.ok(spec.rule);
  for (const move of data.availableMoves(spec.id, 45))
    assert.ok(data.moves[move]);
}
assert.equal(stops.length, stopNamesEN.length);
assert.equal(stops.length, 105);
assert.equal(Object.keys(data.fieldRegions).length, 17);
assert.equal(stops[30].name, "华蓝洞窟");
assert.equal(stops[59].fieldRegion, "hisui");
assert.equal(badgeStops.length, 8);
for (const stop of stops) {
  assert.ok(
    existsSync(join(__dirname, "../dist/assets/scenes", stop.scene + ".png")),
  );
  for (const id of stop.pool) assert.ok(data.species[id]);
}
for (const battle of [...Object.values(gyms), ...league.rounds]) {
  for (const [id, , , , move] of battle.foes) {
    assert.ok(data.moves[move]);
    assert.ok(
      existsSync(join(__dirname, "../dist/assets/mon", id + "-icon.png")),
    );
  }
}

function runUntil(s, done, checkpoints = 26) {
  for (let i = 0; i < checkpoints && !done(s); i++) {
    game.advance(s, s.last + game.cap);
  }
  assert.ok(done(s), "Expected travel milestone");
}

for (const id of [1, 4, 7]) {
  const s = game.start(id, now, 23);
  game.advance(s, now + 8000);
  assert.equal(s.stop, 1);
  assert.ok(s.caught[16]);
  assert.equal(s.balls, 11);
  const resumed = structuredClone(s);
  for (let i = 1; i <= 960; i++) {
    game.advance(s, now + 8000 + i * game.tick);
  }
  game.advance(resumed, now + 8000 + 960 * game.tick);
  assert.deepEqual(resumed, s);
  const checkpoint = structuredClone(s);
  game.advance(s, s.last);
  assert.deepEqual(s, checkpoint);

  runUntil(s, (save) => Boolean(save.hall));
  assert.deepEqual(s.badges, badgeStops);
  assert.equal(s.stop, league.stop);
  assert.equal(s.leagueWins, league.rounds.length);
  assert.equal(s.mode, "stay");
  assert.equal(s.hall.count, 1);
  assert.ok([1, 4, 7].every((x) => s.caught[x]));
  assert.ok(s.box[id].level >= data.species[id].requirement);
  assert.ok(game.evolve(s, id, s.last));
  assert.ok(s.team.includes(data.species[id].next));
  assert.ok(!s.box[id]);
  console.log("Championship completed from starter", id);
}

const migrated = game.start(7, now, 51);
migrated.version = 1;
delete migrated.routeProgress;
delete migrated.leagueWins;
delete migrated.hall;
migrated.stop = migrated.furthest = 13;
migrated.progress = 1;
migrated.badges = [5, 9, 13];
migrated.stones.undefined = 1;
migrated.mode = "stay";
migrated.tutorial = false;
migrated.target = 16;
const initialTeam = [...migrated.team];
game.advance(migrated, migrated.last);
assert.equal(migrated.version, 3);
assert.ok(migrated.research >= 0);
assert.deepEqual(migrated.badges, [5, 9, 13]);
assert.deepEqual(migrated.team, initialTeam);
assert.equal(migrated.target, 16);
assert.equal(migrated.mode, "stay");
assert.equal(migrated.stones.undefined, undefined);
migrated.mode = "travel";
game.advance(migrated, migrated.last + 10 * game.tick);
assert.equal(migrated.stop, 14);
const savedProgress = migrated.progress;
assert.ok(game.visit(migrated, 4));
assert.equal(migrated.progress, stops[4].steps);
assert.ok(game.visit(migrated, 14));
assert.equal(migrated.progress, savedProgress);
assert.equal(game.visit(migrated, 15), false);

const s = game.start(7, now, 1);
game.advance(s, now + 36 * 3600000);
assert.equal(s.steps, game.cap / game.tick);
const oldStep = s.steps;
game.advance(s, now + 36 * 3600000);
assert.equal(s.steps, oldStep);
s.stop = 4;
s.mode = "stay";
s.only = true;
s.target = 25;
s.balls = 3;
s.reserve = 3;
game.advance(s, s.last + game.cap);
assert.equal(s.stop, 4);
assert.ok(s.box[25]);
assert.equal(s.target, 25);
assert.equal(s.only, true);
s.stones["雷之石"] = 1;
assert.ok(game.evolve(s, 25, s.last));
assert.equal(s.stones["雷之石"], 0);
assert.ok(s.box[26]);

const f = game.start(4, now, 23);
f.stop = 5;
f.progress = 1;
f.box[4].level = 1;
game.advance(f, now + game.tick);
assert.ok(!f.history[0].win);
f.box[4].level = 60;
game.advance(f, f.last + game.tick);
assert.ok(f.badges.includes(5));

const q = game.start(1, now, 5);
q.tutorial = false;
q.mode = "stay";
q.steps = 2;
q.balls = 3;
q.target = 25;
q.reserve = 3;
game.advance(q, now + 8000);
assert.equal(q.balls, 3);
assert.equal(q.recent.reason, "可用精灵球不足");

const finals = game.start(1, now, 23);
finals.stop = finals.furthest = league.stop;
finals.tutorial = false;
game.advance(finals, finals.last + game.tick);
assert.equal(finals.leagueWins, 0);
assert.equal(finals.history.length, 0);
finals.badges = [...badgeStops];
finals.leagueWins = 2;
game.advance(finals, finals.last + game.tick);
assert.equal(finals.leagueWins, 2);
assert.equal(finals.history[0].leader, league.rounds[2].leader);
assert.equal(finals.history[0].win, false);
finals.box[1] = { level: 100, xp: 0, moves: ["飞叶快刀", "撞击"] };
finals.box[6] = { level: 100, xp: 0, moves: ["火焰牙", "抓"] };
finals.box[9] = { level: 100, xp: 0, moves: ["水之波动", "撞击"] };
finals.team = [6, 9, 1];
game.advance(finals, finals.last + 15 * game.tick);
assert.equal(finals.hall.count, 1);
const firstWin = finals.hall.time;
assert.ok(game.visit(finals, 0));
assert.ok(game.rematch(finals));
assert.equal(finals.stop, league.stop);
assert.equal(game.rematch(finals), false);
game.advance(finals, finals.last + 15 * game.tick);
assert.equal(finals.hall.count, 2);
assert.equal(finals.hall.time, firstWin);
game.advance(finals, finals.last + game.tick);
assert.equal(finals.hall.count, 2);
console.log(
  "Migration, route checkpoints, capture policy, battle resume, Hall of Fame and rematch passed.",
);

const survey = game.start(7, now, 123);
const { surveyStops, storyLength } = data.regions.kanto;
const target = 906;
const field = data.sightings[target][0];
assert.ok(surveyStops.paldea.includes(field));
assert.ok(field >= storyLength);
assert.equal(game.canVisit(survey, field), false);
assert.equal(game.visit(survey, field), false);
survey.hall = finals.hall;
survey.badges = [...badgeStops];
survey.stop = survey.furthest = league.stop;
survey.tutorial = false;
assert.ok(game.visit(survey, field));
survey.target = target;
survey.only = true;
game.advance(survey, survey.last + game.cap);
assert.equal(survey.stop, field);
assert.equal(survey.furthest, league.stop);
assert.ok(survey.caught[target] && survey.box[target]);
assert.equal(survey.seen[target], field);
assert.ok(survey.research > 0);
const points = survey.research;
assert.ok(game.exchangeStone(survey, "火之石"));
assert.equal(survey.research, points - 1);
assert.ok(!game.exchangeStone(survey, "无效"));
const eevee = 133;
const habitat = data.sightings[eevee][0];
assert.ok(game.visit(survey, habitat));
survey.target = eevee;
game.advance(survey, survey.last + game.cap);
assert.ok(survey.box[eevee]);
assert.ok(!game.evolve(survey, eevee, survey.last, 150));
assert.ok(game.canEvolve(survey, eevee, 136));
assert.ok(game.evolve(survey, eevee, survey.last, 136));
assert.equal(survey.stones["火之石"], 0);
assert.ok(survey.caught[136]);
game.advance(survey, survey.last + game.cap);
assert.ok(survey.box[eevee]);
assert.ok(game.exchangeStone(survey, "水之石"));
assert.ok(game.evolve(survey, eevee, survey.last, 134));
assert.ok(survey.caught[134] && survey.caught[136]);
console.log(
  "All 1025 entries reachable, survey gates, targeted recapture, stone exchange and branching passed.",
);

const proposed = game.start(1, now, 151);
assert.ok(!game.storePartner(proposed, 1));
const finish = data.regions.kanto.storyLength - 1;
proposed.stop = proposed.furthest = finish;
proposed.badges = [...badgeStops];
proposed.hall = { time: now, count: 1, team: [{ id: 1, level: 5 }] };
for (const field of Object.values(data.fieldRegions)) {
  for (const stop of surveyStops[field.key]) {
    assert.ok(game.canVisit(proposed, stop));
    assert.equal(stops[stop].fieldRegion, field.key);
    assert.ok(stops[stop].encounters.length);
  }
}
for (const id of [4, 7, 25])
  proposed.box[id] = { level: 5, xp: 0, moves: data.availableMoves(id, 5) };
assert.ok(game.placeInParty(proposed, 4));
assert.ok(game.placeInParty(proposed, 7));
assert.ok(!game.placeInParty(proposed, 25));
assert.ok(game.placeInParty(proposed, 25, 1));
assert.deepEqual(proposed.team, [1, 25, 7]);
assert.ok(proposed.box[4]);
assert.ok(game.placeInParty(proposed, 7, 0));
assert.deepEqual(proposed.team, [7, 25, 1]);
assert.ok(game.storePartner(proposed, 25));
assert.deepEqual(proposed.team, [7, 1]);

const history = JSON.parse(JSON.stringify(finals));
const imported = saves.parse(JSON.stringify(history));
assert.deepEqual(imported.team, finals.team);
assert.equal(imported.hall.count, 2);
assert.deepEqual(imported.history[0].replay, finals.history[0].replay);
const lastBattle = imported.history[0].replay;
assert.equal(lastBattle.format, 2);
assert.ok(lastBattle.frames.length > 20);
assert.equal(lastBattle.frames[0][0], 0);
assert.ok(
  lastBattle.events.some((event) => event[2] === "hit" && event[3] > 0),
);
assert.ok(lastBattle.events.some((event) => event[2] === "miss"));
for (const side of [0, 1]) {
  assert.ok(
    lastBattle.events.some((event) => event[1] === side && event[2] === "cast"),
  );
  assert.ok(
    new Set(
      lastBattle.frames.map(
        (frame) => frame[side + 1][1] + "/" + frame[side + 1][2],
      ),
    ).size > 5,
  );
}
assert.ok(
  lastBattle.events
    .filter((event) => event[2] === "cast")
    .some(
      (event, index, casts) => index > 0 && event[1] === casts[index - 1][1],
    ),
);
assert.throws(() =>
  saves.parse(JSON.stringify({ ...proposed, team: [65535] })),
);
assert.throws(() => saves.parse(JSON.stringify({ ...proposed, stop: 1000 })));
assert.throws(() => saves.parse(JSON.stringify({ ...proposed, balls: -1 })));
console.log(
  "17 survey destinations, warehouse slot operations, battle replay and save transfer passed.",
);
