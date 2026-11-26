const catalog =
  typeof JourneyCatalog !== "undefined"
    ? JourneyCatalog
    : require("./catalog.js");
const expeditions =
  typeof JourneyExpeditions !== "undefined"
    ? JourneyExpeditions
    : require("./expeditions.js");
/* Regional content is independent of the travel engine. */
const JourneyData = (() => {
  const families = [
    [
      [1, "妙蛙种子", "草毒"],
      [2, "妙蛙草", "草毒", 16],
      [3, "妙蛙花", "草毒", 32],
    ],
    [
      [4, "小火龙", "火"],
      [5, "火恐龙", "火", 16],
      [6, "喷火龙", "火飞行", 36],
    ],
    [
      [7, "杰尼龟", "水"],
      [8, "卡咪龟", "水", 16],
      [9, "水箭龟", "水", 36],
    ],
    [
      [10, "绿毛虫", "虫"],
      [11, "铁甲蛹", "虫", 7],
      [12, "巴大蝶", "虫飞行", 10],
    ],
    [
      [13, "独角虫", "虫毒"],
      [14, "铁壳蛹", "虫毒", 7],
      [15, "大针蜂", "虫毒", 10],
    ],
    [
      [16, "波波", "一般飞行"],
      [17, "比比鸟", "一般飞行", 18],
      [18, "大比鸟", "一般飞行", 36],
    ],
    [
      [19, "小拉达", "一般"],
      [20, "拉达", "一般", 20],
    ],
    [
      [25, "皮卡丘", "电"],
      [26, "雷丘", "电", "雷之石"],
    ],
    [
      [27, "穿山鼠", "地面"],
      [28, "穿山王", "地面", 22],
    ],
    [
      [35, "皮皮", "妖精"],
      [36, "皮可西", "妖精", "月之石"],
    ],
    [
      [41, "超音蝠", "毒飞行"],
      [42, "大嘴蝠", "毒飞行", 22],
    ],
    [
      [43, "走路草", "草毒"],
      [44, "臭臭花", "草毒", 21],
      [45, "霸王花", "草毒", "叶之石"],
    ],
    [
      [46, "派拉斯", "虫草"],
      [47, "派拉斯特", "虫草", 24],
    ],
    [
      [52, "喵喵", "一般"],
      [53, "猫老大", "一般", 28],
    ],
    [
      [54, "可达鸭", "水"],
      [55, "哥达鸭", "水", 33],
    ],
    [
      [56, "猴怪", "格斗"],
      [57, "火暴猴", "格斗", 28],
    ],
    [
      [129, "鲤鱼王", "水"],
      [130, "暴鲤龙", "水飞行", 20],
    ],
  ];
  const species = {};
  for (const family of families)
    family.forEach(([id, name, types], i) => {
      const next = family[i + 1];
      species[id] = {
        id,
        name,
        types: types.match(/一般|飞行|地面|妖精|格斗|超能力|./g),
        base: family[0][0],
        stage: i,
        next: next?.[0],
        requirement: next?.[3],
      };
    });
  const geography = [
    ["kanto", "关都", "KANTO"],
    ["johto", "城都", "JOHTO"],
    ["hoenn", "丰缘", "HOENN"],
    ["sinnoh", "神奥", "SINNOH"],
    ["unova", "合众", "UNOVA"],
    ["kalos", "卡洛斯", "KALOS"],
    ["alola", "阿罗拉", "ALOLA"],
    ["galar", "伽勒尔", "GALAR"],
    ["paldea", "帕底亚", "PALDEA"],
    ["hisui", "洗翠", "HISUI"],
  ];
  const fieldRegions = Object.fromEntries(
    geography.map(([key, name, english]) => [
      key,
      { key, name, english, ids: [] },
    ]),
  );
  const catalogMoves = {};
  const captureRates = {};
  for (const [
    id,
    name,
    types,
    gen,
    parent,
    evolution,
    rate,
    rare,
    learnset,
  ] of catalog.species) {
    const key = (id >= 899 && id <= 905 ? geography[9] : geography[gen - 1])[0];
    const old = species[id];
    species[id] = {
      ...old,
      id,
      name,
      types: types.map((type) => catalog.types[type]),
      parent,
      rule: evolution,
      region: key,
      rare,
      evolutions: [],
    };
    fieldRegions[key].ids.push(id);
    catalogMoves[id] = learnset;
    captureRates[id] = rate;
  }
  for (const family of families) {
    for (const [id] of family.slice(1)) {
      // Retain the original campaign's evolution thresholds for existing saves.
      const parent = species[species[id].parent];
      if (parent?.next === id) species[id].rule = parent.requirement;
    }
  }
  for (const entry of Object.values(species)) {
    if (entry.parent)
      species[entry.parent].evolutions.push({ id: entry.id, rule: entry.rule });
    let root = entry,
      stage = 0;
    while (root.parent) {
      root = species[root.parent];
      stage++;
    }
    entry.stage = stage;
    entry.base = root.id;
  }
  const moves = {
    ...catalog.moves,
    撞击: ["一般", 40],
    藤鞭: ["草", 45],
    飞叶快刀: ["草", 55],
    火花: ["火", 40],
    火焰牙: ["火", 65],
    抓: ["一般", 40],
    水枪: ["水", 40],
    水之波动: ["水", 60],
    吐丝: ["虫", 0],
    虫咬: ["虫", 60],
    变硬: ["一般", 0],
    念力: ["超能力", 50],
    毒针: ["毒", 15],
    双针: ["虫", 50],
    起风: ["飞行", 40],
    翅膀攻击: ["飞行", 60],
    电击: ["电", 40],
    电光: ["电", 65],
    电光一闪: ["一般", 40],
    挖洞: ["地面", 80],
    泼沙: ["地面", 0],
    二连踢: ["格斗", 60],
    拍击: ["一般", 40],
    溶解液: ["毒", 40],
    魅惑之声: ["妖精", 40],
    吸取: ["草", 20],
    咬住: ["恶", 60],
    吸血: ["虫", 80],
    劈开: ["一般", 70],
    踢倒: ["格斗", 50],
    空手劈: ["格斗", 50],
    跃起: ["一般", 0],
    龙卷风: ["龙", 40],
    落石: ["岩石", 50],
    高速星星: ["一般", 60],
    十万伏特: ["电", 90],
    冰冻光束: ["冰", 90],
    精神强念: ["超能力", 90],
    污泥炸弹: ["毒", 90],
    龙之波动: ["龙", 85],
  };
  const moveSets = {
    1: ["撞击", "藤鞭", "飞叶快刀"],
    4: ["抓", "火花", "火焰牙"],
    7: ["撞击", "水枪", "水之波动"],
    10: ["撞击", "吐丝", "虫咬"],
    11: ["变硬", "撞击", "虫咬"],
    12: ["念力", "起风", "虫咬"],
    13: ["毒针", "吐丝", "虫咬"],
    14: ["变硬", "毒针", "虫咬"],
    15: ["双针", "毒针", "劈开"],
    16: ["撞击", "起风", "翅膀攻击"],
    19: ["撞击", "电光一闪", "咬住"],
    25: ["电击", "电光一闪", "电光"],
    27: ["抓", "泼沙", "挖洞"],
    35: ["拍击", "魅惑之声", "高速星星"],
    41: ["吸取", "咬住", "吸血"],
    43: ["吸取", "溶解液", "飞叶快刀"],
    46: ["抓", "吸取", "劈开"],
    52: ["抓", "咬住", "劈开"],
    54: ["水枪", "抓", "水之波动"],
    56: ["踢倒", "抓", "空手劈"],
    129: ["跃起", "撞击"],
    130: ["咬住", "龙卷风", "水之波动"],
  };
  function availableMoves(id, level) {
    const entry = species[id];
    const inherited = moveSets[entry.base];
    const own = catalogMoves[id];
    const list =
      moveSets[id] ||
      (id <= 151 && inherited) ||
      (own.length
        ? own
        : catalogMoves[entry.base].length
          ? catalogMoves[entry.base]
          : ["撞击"]);
    if (id === 129) return level >= 15 ? list : list.slice(0, 1);
    return list.slice(0, level >= 10 ? 3 : 2);
  }
  // Each stop stores travel duration in half-minute steps, distinct from its habitat.
  const make = (name, scene, steps, pool, level, note) => ({
    name,
    scene,
    steps,
    pool,
    level,
    note,
  });
  const stops = [
    make("真新镇", "town", 2, [16, 19], 3, "从大木博士的研究所出发。"),
    make("1号道路", "road", 12, [16, 16, 19, 19], 3, "波波在草地上寻找食物。"),
    make("常青市", "town", 36, [16, 19, 56], 5, "沿城市西侧的小径寻找猴怪。"),
    make(
      "2号道路",
      "road",
      100,
      [10, 13, 16, 19],
      5,
      "林间的路标指向常青森林。",
    ),
    make(
      "常青森林",
      "forest",
      540,
      [10, 13, 10, 16, 13, 25],
      7,
      "留意草丛深处闪过的黄色尾巴。",
    ),
    make(
      "深灰市",
      "pewter",
      1,
      [56, 10, 19, 16],
      9,
      "山脚下的深灰道馆等待挑战。",
    ),
    make(
      "3号道路",
      "road",
      760,
      [16, 27, 56, 19],
      12,
      "山径上的脚印通往月见山。",
    ),
    make(
      "月见山",
      "cave",
      1260,
      [41, 41, 46, 27, 35],
      14,
      "洞壁深处传来翅膀拍动的回声。",
    ),
    make(
      "4号道路",
      "road",
      650,
      [27, 43, 19, 16],
      17,
      "沿着山坡向华蓝市前进。",
    ),
    make(
      "华蓝市",
      "cerulean",
      1,
      [54, 43, 129],
      18,
      "水边的华蓝道馆已经开门。",
    ),
    make(
      "5号道路",
      "road",
      1180,
      [52, 43, 16, 54],
      21,
      "田野间的小路一直向南延伸。",
    ),
    make(
      "地下通道",
      "cave",
      900,
      [41, 27, 19],
      22,
      "地下通道的另一端透进了阳光。",
    ),
    make(
      "6号道路",
      "road",
      1450,
      [54, 52, 129, 43],
      23,
      "空气里开始带着海风的味道。",
    ),
    make(
      "枯叶市",
      "port",
      1,
      [129, 54, 52, 27],
      25,
      "港口旁的道馆里传来电流声。",
    ),
    make(
      "地鼠洞穴",
      "cave",
      840,
      [27, 28, 41, 56],
      29,
      "岔路边的细沙上留着新鲜足迹。",
    ),
    make(
      "岩山隧道",
      "cave",
      960,
      [41, 42, 46, 27, 35],
      32,
      "留意岩石后面的翅膀。",
    ),
    make(
      "紫苑镇",
      "town",
      360,
      [35, 52, 41, 43],
      33,
      "在镇口稍作停留，就能继续前往玉虹市。",
    ),
    make(
      "8号道路",
      "road",
      420,
      [52, 53, 19, 43, 56],
      34,
      "花田和街巷间常有喵喵出没。",
    ),
    make(
      "玉虹市",
      "forest",
      1,
      [43, 44, 46, 10],
      35,
      "莉佳在玉虹道馆等候挑战。",
    ),
    make(
      "自行车道",
      "road",
      1080,
      [19, 20, 16, 17, 27],
      37,
      "沿着平缓的坡道向浅红市旅行。",
    ),
    make(
      "浅红市",
      "forest",
      1,
      [13, 46, 47, 56],
      38,
      "阿桔擅长用毒属性伙伴考验来访者。",
    ),
    make(
      "15号道路",
      "road",
      660,
      [16, 17, 43, 44, 52],
      40,
      "沿海草丛通向北面的城市。",
    ),
    make(
      "金黄市",
      "cerulean",
      1,
      [54, 52, 35, 56],
      42,
      "娜姿已开放金黄道馆的挑战。",
    ),
    make(
      "19号水路",
      "port",
      900,
      [129, 130, 54, 55],
      43,
      "沿海岸旅行，能见到不常上岸的伙伴。",
    ),
    make(
      "双子岛",
      "cave",
      660,
      [41, 42, 54, 55, 129],
      44,
      "阵阵冷风从相连的洞口吹来。",
    ),
    make(
      "红莲镇",
      "volcanic",
      1,
      [27, 28, 52, 54],
      46,
      "夏伯的道馆坐落在火山海岸。",
    ),
    make(
      "21号水路",
      "port",
      900,
      [129, 130, 54, 16],
      46,
      "顺着海风回到关都西部。",
    ),
    make(
      "常青道馆",
      "pewter",
      1,
      [27, 28, 56, 57],
      48,
      "最后一枚徽章在常青道馆等待你。",
    ),
    make(
      "冠军之路",
      "plateau",
      1020,
      [57, 28, 42, 18, 47],
      50,
      "走过这段山路就能见到联盟入口。",
    ),
    make(
      "石英高原",
      "plateau",
      1,
      [18, 42, 57, 55],
      52,
      "四天王与冠军将在这里迎接你的队伍。",
    ),
  ];
  const opponent = (id, level, move) => [
    id,
    species[id].name,
    species[id].types,
    level,
    move,
  ];
  const gyms = {
    5: {
      leader: "小刚",
      type: "岩石",
      badge: "灰色徽章",
      foes: [
        [74, "小拳石", ["岩石", "地面"], 10, "落石"],
        [95, "大岩蛇", ["岩石", "地面"], 12, "落石"],
      ],
    },
    9: {
      leader: "小霞",
      type: "水",
      badge: "蓝色徽章",
      foes: [
        [120, "海星星", ["水"], 19, "水枪"],
        [121, "宝石海星", ["水", "超能力"], 21, "水之波动"],
      ],
    },
    13: {
      leader: "马志士",
      type: "电",
      badge: "橙色徽章",
      foes: [
        [100, "霹雳电球", ["电"], 23, "电击"],
        [81, "小磁怪", ["电", "钢"], 24, "电光"],
        [26, "雷丘", ["电"], 26, "十万伏特"],
      ],
    },
    18: {
      leader: "莉佳",
      type: "草",
      badge: "彩虹徽章",
      foes: [
        opponent(44, 30, "吸取"),
        opponent(47, 31, "吸血"),
        opponent(45, 33, "飞叶快刀"),
      ],
    },
    20: {
      leader: "阿桔",
      type: "毒",
      badge: "粉红徽章",
      foes: [
        opponent(15, 34, "双针"),
        opponent(42, 36, "溶解液"),
        opponent(3, 37, "飞叶快刀"),
      ],
    },
    22: {
      leader: "娜姿",
      type: "超能力",
      badge: "金色徽章",
      foes: [
        opponent(12, 39, "念力"),
        [121, "宝石海星", ["水", "超能力"], 41, "精神强念"],
        opponent(36, 41, "念力"),
      ],
    },
    25: {
      leader: "夏伯",
      type: "火",
      badge: "深红徽章",
      foes: [
        opponent(5, 42, "火焰牙"),
        opponent(53, 44, "火花"),
        opponent(6, 45, "火焰牙"),
      ],
    },
    27: {
      leader: "坂木",
      type: "地面",
      badge: "绿色徽章",
      foes: [
        opponent(28, 46, "挖洞"),
        [95, "大岩蛇", ["岩石", "地面"], 47, "落石"],
        opponent(57, 48, "二连踢"),
      ],
    },
  };
  const league = {
    stop: 29,
    rounds: [
      {
        leader: "科拿",
        type: "冰",
        foes: [
          opponent(55, 49, "冰冻光束"),
          opponent(9, 50, "水之波动"),
          opponent(36, 51, "冰冻光束"),
        ],
      },
      {
        leader: "希巴",
        type: "格斗",
        foes: [
          [95, "大岩蛇", ["岩石", "地面"], 50, "落石"],
          opponent(57, 52, "空手劈"),
          opponent(28, 53, "挖洞"),
        ],
      },
      {
        leader: "菊子",
        type: "毒",
        foes: [
          opponent(15, 51, "双针"),
          opponent(42, 53, "溶解液"),
          opponent(3, 54, "污泥炸弹"),
        ],
      },
      {
        leader: "阿渡",
        type: "龙",
        foes: [
          opponent(18, 53, "翅膀攻击"),
          opponent(130, 54, "水之波动"),
          opponent(6, 55, "龙之波动"),
        ],
      },
      {
        leader: "青绿",
        type: "冠军",
        foes: [
          opponent(26, 55, "十万伏特"),
          opponent(18, 55, "翅膀攻击"),
          opponent(9, 56, "水之波动"),
          opponent(6, 57, "火焰牙"),
        ],
      },
    ],
  };
  const stopNamesEN = [
    "PALLET TOWN",
    "ROUTE 01",
    "VIRIDIAN CITY",
    "ROUTE 02",
    "VIRIDIAN FOREST",
    "PEWTER CITY",
    "ROUTE 03",
    "MT. MOON",
    "ROUTE 04",
    "CERULEAN CITY",
    "ROUTE 05",
    "UNDERGROUND PATH",
    "ROUTE 06",
    "VERMILION CITY",
    "DIGLETT’S CAVE",
    "ROCK TUNNEL",
    "LAVENDER TOWN",
    "ROUTE 08",
    "CELADON CITY",
    "CYCLING ROAD",
    "FUCHSIA CITY",
    "ROUTE 15",
    "SAFFRON CITY",
    "ROUTE 19",
    "SEAFOAM ISLANDS",
    "CINNABAR ISLAND",
    "ROUTE 21",
    "VIRIDIAN GYM",
    "VICTORY ROAD",
    "INDIGO PLATEAU",
  ];
  const surveyStops = Object.fromEntries(geography.map(([key]) => [key, []]));
  const habitats = [
    ["原野调查", "forest", "沿草地和林缘寻找新的踪迹。"],
    ["水岸调查", "port", "沿岸观察浅滩与深水区。"],
    ["山地调查", "plateau", "沿山路观察岩壁和开阔地。"],
  ];
  function appendSurvey(key, label, scene, note, pool = []) {
    const index = stops.length,
      district = fieldRegions[key];
    const stop = make(label, scene, 1, pool, 44, note);
    stop.survey = true;
    stop.fieldRegion = key;
    stops.push(stop);
    stopNamesEN.push(district.english + " FIELD SURVEY");
    surveyStops[key].push(index);
    return index;
  }
  const cave = appendSurvey(
    "kanto",
    "华蓝洞窟",
    "cave",
    "联盟通关后可在这里寻找罕见宝可梦。",
    [150, 113, 132],
  );
  const plants = appendSurvey(
    "kanto",
    "无人发电厂",
    "pewter",
    "检查旧设施附近的电属性活动。",
    [145, 81, 100, 125],
  );
  const islands = appendSurvey(
    "kanto",
    "关都海岛调查",
    "volcanic",
    "在海岛、洞口与海崖寻找罕见踪迹。",
    [144, 146, 151, 131],
  );
  const kantoHabitats = {
    21: 6,
    23: 3,
    29: 2,
    32: 2,
    37: 17,
    39: 6,
    48: 4,
    50: 14,
    58: 17,
    60: 9,
    63: 22,
    66: 15,
    69: 18,
    72: 23,
    74: 7,
    77: 25,
    79: 24,
    81: 13,
    83: 12,
    84: 19,
    86: 24,
    88: 20,
    90: 23,
    92: 16,
    95: 15,
    96: 22,
    98: 23,
    100: 13,
    102: 18,
    104: 16,
    106: 22,
    107: 22,
    108: 21,
    109: 20,
    111: 28,
    113: 20,
    114: 21,
    115: 20,
    116: 23,
    118: 9,
    120: 23,
    122: 22,
    123: 20,
    124: 24,
    125: plants,
    126: 25,
    127: 20,
    128: 21,
    131: 24,
    132: cave,
    133: 18,
    137: 22,
    138: 25,
    140: 25,
    142: 28,
    143: 19,
    144: islands,
    145: plants,
    146: islands,
    147: 28,
    150: cave,
    151: islands,
  };
  function makeNamedEntries(key) {
    return habitats.map(([suffix, scene, note]) =>
      appendSurvey(key, fieldRegions[key].name + suffix, scene, note),
    );
  }
  const otherHabitatStops = Object.fromEntries(
    geography.slice(1).map(([key]) => [key, makeNamedEntries(key)]),
  );
  for (const entry of Object.values(species)) {
    if (entry.region === "kanto") {
      if ((entry.parent && entry.parent <= 151) || [1, 4, 7].includes(entry.id))
        continue;
      if (!stops.some((stop) => stop.pool.includes(entry.id))) {
        const stop = stops[kantoHabitats[entry.id] ?? 21];
        (stop.expanded ??= []).push(entry.id);
      }
      continue;
    }
    if (entry.parent) continue;
    const group = entry.types.some((type) => ["水", "冰"].includes(type))
      ? 1
      : entry.types.some((type) =>
            ["草", "虫", "妖精", "一般", "飞行", "毒"].includes(type),
          ) && !entry.rare
        ? 0
        : 2;
    stops[otherHabitatStops[entry.region][group]].pool.push(entry.id);
  }
  for (const stop of stops) {
    if (stop.survey && !stop.pool.length && !stop.expanded?.length) {
      const natives = fieldRegions[stop.fieldRegion].ids;
      stop.pool.push(
        ...natives.filter((id) => !species[id].parent).slice(0, 3),
      );
      if (!stop.pool.length) stop.pool.push(natives[0]);
    }
    stop.encounters = [...new Set([...stop.pool, ...(stop.expanded || [])])];
  }
  const habitatNotes = {
    forest: "在林缘、落叶和树根间寻找野外踪迹。",
    cave: "检查石缝、洞口与幽暗的支路。",
    road: "沿草甸和开阔步道观察活动中的宝可梦。",
    plateau: "调查高地与岩壁，留意罕见目击。",
    port: "沿岸探索浅滩、礁石和深水区域。",
    volcanic: "在火山岩与温暖海湾之间调查。",
  };
  function addRoutes(key, routes) {
    for (const [label, scene, level, pool] of routes) {
      const index = appendSurvey(key, label, scene, habitatNotes[scene], pool);
      stops[index].level = level;
      stops[index].encounters = [...new Set(pool)];
    }
  }
  for (const [key, routes] of Object.entries(expeditions.regional))
    addRoutes(key, routes);
  for (const [key, name, english, routes] of expeditions.extensions) {
    fieldRegions[key] = {
      key,
      name,
      english,
      extension: true,
      ids: [...new Set(routes.flatMap((route) => route[3]))].sort(
        (a, b) => a - b,
      ),
    };
    surveyStops[key] = [];
    addRoutes(key, routes);
  }
  const sightings = Object.fromEntries(
    Object.keys(species).map((id) => [id, []]),
  );
  stops.forEach((stop, index) =>
    stop.encounters.forEach((id) => sightings[id].push(index)),
  );
  const stones = [
    ...new Set(
      Object.values(species)
        .map((spec) => spec.rule)
        .filter((rule) => typeof rule === "string"),
    ),
  ];
  const regions = {
    kanto: {
      name: "关都地区",
      stopNamesEN,
      storyLength: league.stop + 1,
      surveyStops,
      stops,
      gyms,
      league,
      ids: fieldRegions.kanto.ids,
    },
  };
  return {
    species,
    regions,
    moves,
    availableMoves,
    fieldRegions,
    sightings,
    stones,
    captureRates,
  };
})();
if (typeof module !== "undefined") module.exports = JourneyData;
