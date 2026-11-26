"""Build the default-form National Pokédex for the browser game."""
from concurrent.futures import ThreadPoolExecutor
import csv
import json
from pathlib import Path
import sys
import time
from urllib.request import urlopen

REVISION = "de6760be38b60a3024f1d9054330ff265f0dc619"
ROOT = f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{REVISION}/data/v2/csv"
MAX_SPECIES = 1025
FILES = ("pokemon_species", "pokemon_species_names", "pokemon_types", "pokemon_evolution",
         "item_names", "moves", "move_names", "pokemon_moves", "version_groups")
TYPES = ("", "一般", "格斗", "飞行", "毒", "地面", "岩石", "虫", "幽灵", "钢",
         "火", "水", "草", "电", "超能力", "冰", "龙", "恶", "妖精")
SIMPLE_STONES = {"日之石", "月之石", "火之石", "雷之石", "水之石", "叶之石",
                 "光之石", "暗之石", "觉醒之石", "冰之石"}


def fetch(folder, table):
    path = folder / f"{table}.csv"
    if not path.exists():
        for attempt in range(5):
            try:
                with urlopen(f"{ROOT}/{table}.csv", timeout=35) as response:
                    contents = response.read()
                path.write_bytes(contents)
                break
            except OSError:
                if attempt == 4:
                    raise
                time.sleep(attempt + 1)
    return path


def rows(files, table):
    with files[table].open(encoding="utf-8", newline="") as handle:
        yield from csv.DictReader(handle)


def translations(files, table, key):
    return {int(row[key]): row["name"] for row in rows(files, table)
            if row["local_language_id"] == "12" and row["name"]}


def evolution_rules(files, parents):
    item_names = translations(files, "item_names", "item_id")
    groups = {row["id"]: int(row["order"]) for row in rows(files, "version_groups")}
    records = {}
    for row in rows(files, "pokemon_evolution"):
        species = int(row["evolved_species_id"])
        if species not in parents or row["is_default"] != "1":
            continue
        latest = groups.get(row["version_group_id"], 0)
        if latest < records.get(species, (-1,))[0]:
            continue
        item = item_names.get(int(row["trigger_item_id"] or 0))
        level = int(row["minimum_level"] or 0)
        # The standalone idle game uses training in place of link, held-item,
        # story-gated and other conditions tied to features of the mainline games.
        if item in SIMPLE_STONES:
            rule = item
        elif level:
            rule = max(2, level)
        else:
            rule = {"bond": 24 if row["minimum_happiness"] else 32}
        records[species] = (latest, rule)
    return {species: records.get(species, (0, {"bond": 32}))[1] for species in parents}


def learnsets(files, type_ids):
    names = translations(files, "move_names", "move_id")
    legal = {}
    for row in rows(files, "moves"):
        move, power, kind = int(row["id"]), int(row["power"] or 0), int(row["type_id"])
        if move in names and 20 <= power <= 100 and 0 < kind < len(TYPES):
            legal[move] = (names[move], kind, power)
    candidates = {}
    for row in rows(files, "pokemon_moves"):
        species, move = int(row["pokemon_id"]), int(row["move_id"])
        if not 1 <= species <= MAX_SPECIES or move not in legal:
            continue
        method, level = row["pokemon_move_method_id"], int(row["level"] or 0)
        if method not in ("1", "4"):
            continue
        catalog = candidates.setdefault(species, {})
        learned_at = level if method == "1" else 65
        catalog[move] = min(catalog.get(move, 100), learned_at)

    sets, used = {}, {}
    for species, kinds in type_ids.items():
        learned = candidates.get(species, {})
        same_type = [move for move in learned if legal[move][1] in kinds]
        early = [move for move in learned if learned[move] <= 18 and legal[move][2] <= 65]
        if not early and learned:
            early = sorted(learned, key=lambda move: (legal[move][2], learned[move], move))[:4]
        primary = max(early, key=lambda move: (legal[move][1] in kinds, legal[move][2] <= 65, -abs(45-legal[move][2]), -move), default=None)
        remaining = [move for move in early if move != primary]
        secondary = max(remaining, key=lambda move: (
            legal[move][1] != legal[primary][1], -abs(50-legal[move][2]), -move
        ), default=None)
        late = [move for move in same_type if move not in (primary, secondary)]
        finisher = max(late, key=lambda move: (legal[move][2] <= 95, legal[move][2], -learned[move], -move), default=None)
        chosen = [move for move in (primary, secondary, finisher) if move]
        if not chosen:
            continue
        sets[species] = [legal[move][0] for move in chosen]
        for move in chosen:
            name, kind, power = legal[move]
            used[name] = [TYPES[kind], power]
    return sets, used


def build(folder):
    with ThreadPoolExecutor(max_workers=6) as executor:
        files = dict(zip(FILES, executor.map(lambda table: fetch(folder, table), FILES)))
    species = {int(r["id"]): r for r in rows(files, "pokemon_species") if int(r["id"]) <= MAX_SPECIES}
    parents = {i: int(r["evolves_from_species_id"]) for i, r in species.items() if r["evolves_from_species_id"]}
    names = translations(files, "pokemon_species_names", "pokemon_species_id")
    type_ids = {i: [] for i in species}
    for row in rows(files, "pokemon_types"):
        i = int(row["pokemon_id"])
        if i in type_ids:
            type_ids[i].append(int(row["type_id"]))
    rules = evolution_rules(files, parents)
    sets, used = learnsets(files, type_ids)
    print(f"{len(species)} species, {len(sets)} with damaging learnsets, {len(used)} moves")
    assert set(species) == set(range(1, MAX_SPECIES + 1))
    data = [[i, names[i], type_ids[i], int(species[i]["generation_id"]), parents.get(i, 0),
             rules.get(i), int(species[i]["capture_rate"]),
             species[i]["is_legendary"] == "1" or species[i]["is_mythical"] == "1",
             sets.get(i, [])] for i in species]
    compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    output = (
        "// Generated by tools/build_catalog.py from PokeAPI data revision " + REVISION + ".\n"
        "const JourneyCatalog = {\n  types: " + compact(TYPES) + ",\n  moves: " + compact(used) +
        ",\n  species: [\n    " + ",\n    ".join(map(compact, data)) + "\n  ]\n};\n"
        'if (typeof module !== "undefined") module.exports = JourneyCatalog;\n'
    )
    (Path(__file__).resolve().parents[1] / "dist" / "catalog.js").write_text(output, encoding="utf-8")


if __name__ == "__main__":
    cache = Path(sys.argv[1])
    cache.mkdir(parents=True, exist_ok=True)
    build(cache)

