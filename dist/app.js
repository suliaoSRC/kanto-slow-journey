"use strict";
const $ = (id) => document.getElementById(id),
  D = JourneyData,
  J = Journey,
  all = Object.keys(D.species).map(Number),
  demoRegion = D.regions.kanto;
const icons = {
  field: "M3 17l6-12 4 8 3-5 5 9H3z M6 18h12",
  map: "M2 5l6-2 7 3 7-2v15l-7 2-7-3-6 2z M8 3v15 M15 6v15",
  dex: "M4 3h16v18H4z M8 3v18 M11 8h6 M11 12h5",
  pin: "M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z M12 7a2 2 0 110 4 2 2 0 010-4z",
  team: "M12 7c-2-5-6-3-5 1s4 4 5 6c1-2 4-3 5-6s-3-6-5-1z M4 14l3 5h10l3-5",
  bag: "M5 8h14l1 13H4z M8 8V5a4 4 0 018 0v3 M7 14h10v4H7z",
  log: "M5 3h14v18H5z M3 7h4 M3 12h4 M3 17h4 M10 8h6 M10 12h6",
  badge: "M12 2l8 4v6c0 5-8 10-8 10s-8-5-8-10V6z M8 11l3 3 5-6",
  sliders: "M3 7h7m5 0h6 M3 17h12m4 0h2 M10 4h4v6h-4z M15 14h4v6h-4z",
  close: "M6 6l12 12 M18 6L6 18",
  chevron: "M9 5l7 7-7 7",
  save: "M4 4h13l3 3v13H4z M8 4v5h7V4 M8 20v-7h8v7",
  expand: "M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6",
};
document
  .querySelectorAll("[data-symbol]")
  .forEach(
    (el) =>
      (el.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
        icons[el.dataset.symbol] +
        '"/></svg>'),
  );
const KEY = "kanto-slow-journey-v1",
  clock = (t) =>
    new Date(t).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
const typePalette = {
  一般: "#817769",
  格斗: "#884839",
  飞行: "#71609f",
  毒: "#79498b",
  地面: "#855722",
  岩石: "#6f663e",
  虫: "#596c2f",
  幽灵: "#555080",
  钢: "#5c6770",
  火: "#b2452b",
  水: "#2a6593",
  草: "#406d3e",
  电: "#7a601a",
  超能力: "#975373",
  冰: "#3f707b",
  龙: "#5e5296",
  恶: "#52443c",
  妖精: "#8b5271",
};
function colors(id) {
  const types = D.species[id]?.types || ["一般"];
  const first = typePalette[types[0]];
  return [first, typePalette[types[1]] || first];
}
function icon(id) {
  const image = JourneySpriteArt.iconUrl(+id);
  if (image) return '<img class="pokeicon" src="' + image + '" alt="">';
  const [color, secondary] = colors(id);
  return (
    '<span class="pokeicon type-icon" aria-hidden="true" style="--mon-color:' +
    color +
    ";--mon-secondary:" +
    secondary +
    '"><span>' +
    D.species[id].types[0].slice(0, 1) +
    "</span><small>" +
    fmt(id) +
    "</small></span>"
  );
}
const stoneColors = {
  火之石: "#d66b46",
  水之石: "#52a4cf",
  雷之石: "#e4bf3f",
  叶之石: "#83aa56",
  月之石: "#b69dc7",
  日之石: "#e8974b",
  光之石: "#f0c774",
  暗之石: "#805fb1",
  觉醒之石: "#7fbebb",
  冰之石: "#85cee5",
};
function stoneIcon(stone) {
  return (
    '<i class="pixel-crystal" style="--item-color:' +
    stoneColors[stone] +
    '" aria-hidden="true"></i>'
  );
}
const name = (id) => D.species[id].name;
const fieldTitle = (field) =>
  field.extension ? field.name : field.name + "地区";
const escapeText = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
let state = null,
  starter = 1,
  page = "field",
  filter = "全部",
  search = "",
  toastTimer,
  selectedRoute = null,
  mapFieldRegion = null,
  dexPage = 0,
  initialized = false,
  canSave = true;
const fmt = (n) => String(n).padStart(4, "0"),
  area = () => (state ? J.region(state) : demoRegion);
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return [1, 2, 3].includes(s.version) &&
      D.regions[s.region] &&
      Array.isArray(s.team) &&
      s.box
      ? s
      : null;
  } catch {
    canSave = false;
    return null;
  }
}
function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    canSave = true;
  } catch {
    canSave = false;
  }
}
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}
function summary(s, from) {
  const allLogs = s.keyLogs.filter((e) => e.time > from);
  return (
    '<p class="brief">队伍旅行了 ' +
    Math.floor(Math.min(Date.now() - from, J.cap) / 60000) +
    " 分钟，当前位于" +
    J.route(s).name +
    '。</p><div class="block">' +
    (allLogs.length
      ? rows(allLogs.slice(0, 12))
      : "队伍一路探索，沿途目击已记入旅行日志。") +
    "</div>"
  );
}
async function sync(edit, first = false) {
  const work = () => {
    let s = read() || state;
    const now = Date.now(),
      old = s?.last,
      oldVersion = s?.version;
    const steps = s ? J.advance(s, now) : 0;
    if (edit) s = edit(s, now) || s;
    if (s && (edit || steps || s.last !== old || s.version !== oldVersion))
      persist(s);
    const changed = JSON.stringify(s) !== JSON.stringify(state);
    state = s;
    if (!initialized || edit || changed || steps) {
      render();
      initialized = true;
    }
    if (first && s && now - old >= 600000)
      modal("离线旅行回顾", summary(s, old));
    JourneyBattle.observe(s, first);
  };
  if (navigator.locks?.request) await navigator.locks.request(KEY, work);
  else work();
}
function modal(title, html) {
  $("dtitle").textContent = title;
  $("dcontent").innerHTML = html;
  if (!$("dialog").open) $("dialog").showModal();
}
function closeModal() {
  if ($("dialog").open) $("dialog").close();
}
// Only replace a region when its content changes, and preserve keyboard focus
// on its controls when a travel tick updates their labels or progress.
function updateMarkup(id, markup) {
  const region = $(id);
  if (region.renderedMarkup === markup) return;
  const active = region.contains(document.activeElement)
    ? document.activeElement
    : null;
  const identity =
    active?.tagName === "BUTTON" ? Object.entries(active.dataset) : [];
  region.innerHTML = markup;
  region.renderedMarkup = markup;
  if (identity.length) {
    const match = Array.from(region.querySelectorAll("button")).find((button) =>
      identity.every(([key, value]) => button.dataset[key] === value),
    );
    match?.focus({ preventScroll: true });
  }
}
$("close").onclick = closeModal;
$("dialog").addEventListener("click", (e) => {
  if (e.target === $("dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeModal();
  }
});
function choosePage(p, moveFocus = false) {
  if (p === "art") JourneyStorage.select("art");
  const nextPage =
    p === "art"
      ? "storage"
      : ["field", "map", "dex", "storage"].includes(p)
        ? p
        : "field";
  page = nextPage;
  for (const key of ["field", "map", "dex", "storage"])
    $(key).hidden = key !== page;
  document.querySelectorAll("nav [data-page]").forEach((button) => {
    const current = button.dataset.page === page;
    button.classList.toggle("active", current);
    if (current) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("pagetitle").textContent = {
    field: "旅行现场",
    map: "地区地图",
    dex: "宝可梦图鉴",
    storage: "背包与仓库",
  }[page];
  $("region").hidden = page === "map";
  render();
  if (moveFocus) {
    window.scrollTo(0, 0);
    $("pagetitle").focus({ preventScroll: true });
  }
}
document.querySelectorAll("[data-page]").forEach((button) => {
  button.onclick = () => {
    if (button.dataset.page === "map") {
      mapFieldRegion = null;
      selectedRoute = null;
      if (page === "map") renderMap();
    }
    location.hash = button.dataset.page;
  };
});
$("region").onclick = () => {
  mapFieldRegion = null;
  selectedRoute = null;
  location.hash = "map";
};
window.addEventListener("hashchange", () =>
  choosePage(location.hash.slice(1), true),
);
function rows(logs) {
  return logs
    .map(
      (e) =>
        '<div class="logrow"><span class="timestamp">' +
        clock(e.time) +
        '</span><b class="event" data-kind="' +
        escapeText(e.kind) +
        '">' +
        escapeText(e.kind) +
        "</b><span>" +
        escapeText(e.message) +
        "</span></div>",
    )
    .join("");
}
function render() {
  const s = state,
    r = area().stops[s?.stop || 0];
  const fieldRegion = D.fieldRegions[r.fieldRegion || "kanto"];
  $("region-name").textContent = fieldTitle(fieldRegion);
  $("region").setAttribute(
    "aria-label",
    "查看" + fieldTitle(fieldRegion) + "地图",
  );
  $("save").toggleAttribute("data-warning", !canSave);
  $("save-label").textContent = !canSave
    ? "暂用内存存档"
    : s
      ? "本地已存档"
      : "本地存档";
  if (page === "map") {
    renderMap();
    return;
  }
  if (page === "dex") {
    renderDex();
    return;
  }
  if (page === "storage") {
    JourneyStorage.render();
    return;
  }
  $("sceneName").textContent = r.name;
  $("sceneEN").textContent = area().stopNamesEN[s?.stop || 0];
  const nextIndex = (s?.stop || 0) + 1;
  const dest = nextIndex < area().storyLength ? area().stops[nextIndex] : null;
  const pct = s ? Math.min(100, Math.floor((100 * s.progress) / r.steps)) : 0;
  const remaining = s ? Math.max(0, Math.ceil((r.steps - s.progress) / 2)) : 0;
  const estimate =
    remaining >= 60
      ? Math.floor(remaining / 60) +
        "小时" +
        (remaining % 60 ? (remaining % 60) + "分" : "")
      : remaining + "分钟";
  const gym =
    s && area().gyms[s.stop] && !s.badges.includes(s.stop)
      ? area().gyms[s.stop]
      : null;
  const challenger = gym || (s && J.leagueRound(s));
  const travelling = s?.mode === "travel";
  const mode = !s
    ? "ready"
    : !travelling
      ? "stay"
      : challenger
        ? "gym"
        : "travel";
  $("scenestate").parentElement.dataset.sceneMode = mode;
  $("scenestate").textContent = {
    ready: "等待出发",
    stay: "原地探索中",
    gym: gym ? "道馆挑战中" : "联盟挑战中",
    travel: "队伍旅行中",
  }[mode];
  const routeLabel =
    !travelling && s
      ? "正在探索"
      : challenger
        ? gym
          ? "道馆挑战"
          : "联盟挑战"
        : "下一站";
  const routeName =
    !travelling && s ? r.name : (challenger?.leader ?? dest?.name ?? r.name);
  const countdown =
    travelling && !challenger && remaining
      ? '<span class="eta"> · 约 ' + estimate + "</span>"
      : "";
  const atHall =
    s?.stop === area().league.stop &&
    s.leagueWins === area().league.rounds.length;
  const modeControls = r.survey
    ? '<button type="button" class="secondary" data-world="1">切换调查区</button>'
    : atHall
      ? '<div class="actions"><button type="button" class="secondary" data-league="1">关都名人堂</button><button type="button" class="primary" data-world="1">跨区调查</button></div>'
      : s
        ? '<div class="routebuttons" role="group" aria-label="旅行方式">' +
          [
            ["travel", s.stop === area().league.stop ? "挑战联盟" : "赶路"],
            ["stay", "原地探索"],
          ]
            .map(
              ([key, label]) =>
                '<button type="button" data-mode="' +
                key +
                '" class="' +
                (s.mode === key ? "on" : "") +
                '" aria-pressed="' +
                (s.mode === key) +
                '">' +
                label +
                "</button>",
            )
            .join("") +
          "</div>"
        : "";
  const track =
    travelling && !challenger && dest
      ? '<div class="track" role="progressbar" aria-label="当前路段进度" aria-valuenow="' +
        pct +
        '"><em style="width:' +
        pct +
        '%"></em></div>'
      : "";
  updateMarkup(
    "routefoot",
    '<div class="route-label"><div class="route-copy"><span>' +
      routeLabel +
      countdown +
      "</span><b>" +
      routeName +
      "</b></div>" +
      modeControls +
      "</div>" +
      track +
      (JourneyBattle.canReplay(s?.history[0])
        ? '<div class="route-replay"><button class="textbtn" data-replay="0">回看最近一场对战</button></div>'
        : ""),
  );
  $("teamsize").textContent = (s?.team.length || 0) + " / 3";
  if (!s)
    updateMarkup(
      "party",
      '<p class="brief">选一位初始伙伴，一起踏上关都之旅。</p><div class="starters">' +
        [1, 4, 7]
          .map(
            (id) =>
              '<button class="pokechoice ' +
              (starter === id ? "selected" : "") +
              '" data-startpick="' +
              id +
              '" aria-pressed="' +
              (starter === id) +
              '">' +
              icon(id) +
              name(id) +
              "</button>",
          )
          .join("") +
        '</div><button class="primary wide" data-start="1">开始旅行</button>',
    );
  else
    updateMarkup(
      "party",
      s.team
        .map((id) => {
          const m = s.box[id];
          return (
            '<button class="monrow" data-detail="' +
            id +
            '">' +
            icon(id) +
            '<span class="info"><span class="rowline"><b>' +
            name(id) +
            "</b><small>Lv. " +
            m.level +
            '</small></span><span class="xp" style="display:block"><em style="width:' +
            Math.floor((100 * m.xp) / J.xpNeeded(m.level)) +
            '%"></em></span></span></button>'
          );
        })
        .join("") +
        '<div class="actions"><button class="secondary wide" data-storage="warehouse">打开宝可梦仓库</button></div>',
    );
  updateMarkup(
    "bag",
    '<div class="bagline"><i class="ball-icon"></i>精灵球<strong>' +
      (s?.balls ?? 12) +
      '</strong></div><button class="textbtn supply-link" type="button" data-storage="bag">打开道具背包</button>',
  );
  $("capture-mode").textContent = s?.target
    ? (s.only ? "仅捕捉 " : "优先 ") + name(s.target)
    : "优先新种";
  $("badgecount").textContent =
    (s?.badges.length || 0) + " / " + Object.keys(area().gyms).length;
  $("league-progress").textContent = s?.hall
    ? "已入名人堂"
    : (s?.leagueWins || 0) + " / " + area().league.rounds.length;
  $("league-entry").classList.toggle("champion", Boolean(s?.hall));
  updateMarkup(
    "badgegrid",
    Object.keys(area().gyms)
      .map(Number)
      .map(
        (n, i) =>
          '<button class="medal ' +
          (s?.badges.includes(n) ? "won" : "") +
          '" data-gym="' +
          n +
          '" aria-label="' +
          gymName(n) +
          "，" +
          (s?.badges.includes(n) ? "徽章已取得" : "徽章未取得") +
          '"><span class="gem" aria-hidden="true">' +
          ["◆", "◇", "✦", "✿", "♥", "✧", "▲", "⬟"][i] +
          "</span>" +
          gymName(n) +
          "</button>",
      )
      .join(""),
  );
  updateMarkup(
    "logrows",
    s
      ? rows(s.logs.slice(0, 3))
      : '<p class="brief log-empty">出发后，沿途的相遇和收服记录会出现在这里。</p>',
  );
}
function world() {
  const s = state;
  const makeCard = (field) =>
    '<button class="tile world-tile" type="button" data-field-region="' +
    field.key +
    '"><b>' +
    fieldTitle(field) +
    "</b><small>" +
    area().surveyStops[field.key].length +
    " 处调查点 · " +
    field.ids.filter((id) => s?.caught[id]).length +
    " / " +
    field.ids.length +
    " 已收服</small><small>" +
    (field.key === "kanto"
      ? "关都主线与调查区"
      : s?.hall
        ? "可前往调查"
        : "联盟夺冠后开放") +
    "</small></button>";
  const fields = Object.values(D.fieldRegions);
  modal(
    "世界地图",
    '<h3>主线地区</h3><div class="world-grid block">' +
      fields
        .filter((field) => !field.extension)
        .map(makeCard)
        .join("") +
      '</div><h3>扩展调查目的地</h3><div class="world-grid block">' +
      fields
        .filter((field) => field.extension)
        .map(makeCard)
        .join("") +
      "</div>",
  );
}
function showRoute(index) {
  mapFieldRegion = area().stops[index].fieldRegion || "kanto";
  selectedRoute = index;
  closeModal();
  if (page === "map") renderMap();
  else location.hash = "map";
}
function renderMap() {
  const reg = area();
  const current = state?.stop || 0;
  const field =
    D.fieldRegions[mapFieldRegion || reg.stops[current].fieldRegion || "kanto"];
  const indices =
    field.key === "kanto"
      ? [
          ...Array.from({ length: reg.storyLength }, (_, index) => index),
          ...reg.surveyStops.kanto,
        ]
      : reg.surveyStops[field.key];
  const selected = indices.includes(selectedRoute)
    ? selectedRoute
    : indices.includes(current)
      ? current
      : indices[0];
  const stop = reg.stops[selected];
  const gym = reg.gyms[selected];
  const status = (index) => {
    if (index === current) return "当前位置";
    const open = state && J.canVisit(state, index);
    return reg.stops[index].survey
      ? open
        ? "可调查"
        : "通关后开放"
      : open
        ? "已到访"
        : "尚未抵达";
  };
  const list = indices
    .map(
      (index) =>
        '<li><button type="button" data-route="' +
        index +
        '" aria-pressed="' +
        (index === selected) +
        '"><span class="route-index">' +
        (reg.stops[index].survey ? "◇" : String(index + 1).padStart(2, "0")) +
        "</span><strong>" +
        reg.stops[index].name +
        "</strong><small>" +
        status(index) +
        "</small></button></li>",
    )
    .join("");
  let actions = "";
  if (selected === current)
    actions =
      '<button class="primary" type="button" data-field="1">回到旅行现场</button>';
  else if (state && J.canVisit(state, selected))
    actions =
      '<button class="primary" type="button" data-go="' +
      selected +
      '">' +
      (stop.survey ? "前往调查" : "返回探索") +
      "</button>";
  if (gym)
    actions +=
      '<button class="secondary" type="button" data-gym="' +
      selected +
      '">道馆详情</button>';
  if (selected === reg.league.stop)
    actions +=
      '<button class="secondary" type="button" data-league="1">联盟详情</button>';
  if (!$("route-list")) {
    $("map").innerHTML =
      '<div class="pagepanel"><div class="rowline"><h2 id="map-region"></h2><button class="secondary" type="button" data-world="1">世界地图</button></div><div class="map-layout"><ol class="route-list" id="route-list" aria-label="旅行路线"></ol><article class="route-inspector" id="route-inspector" aria-label="地点详情"></article></div></div>';
  }
  $("map-region").textContent = fieldTitle(field);
  updateMarkup("route-list", list);
  const candidates = stop.encounters
    .map(
      (id) =>
        '<button class="chip encounter-chip" data-detail="' +
        id +
        '">' +
        name(id) +
        "</button>",
    )
    .join("");
  updateMarkup(
    "route-inspector",
    '<img class="route-art" src="assets/scenes/' +
      stop.scene +
      '.png" alt=""><div class="route-detail"><span class="miniinfo">' +
      status(selected) +
      (gym ? " · 道馆挑战" : "") +
      "</span><h3>" +
      stop.name +
      '</h3><p class="brief">' +
      stop.note +
      "</p>" +
      (actions ? '<div class="actions">' + actions + "</div>" : "") +
      '<details class="encounter-list"><summary>可能遇见的宝可梦（' +
      stop.encounters.length +
      ' 种）</summary><div class="actions">' +
      candidates +
      "</div></details></div>",
  );
}
const dexPageSize = 48;
function dexCards() {
  const s = state;
  const key = $("dexregion").value;
  const scope = key === "all" ? all : D.fieldRegions[key].ids;
  const numericSearch = /^\d+$/.test(search);
  const ids = scope.filter(
    (id) =>
      (!$("dexart").checked || JourneySpriteArt.views(id) === 8) &&
      (!search ||
        (numericSearch
          ? fmt(id).startsWith(search) || String(id).startsWith(search)
          : name(id).includes(search))) &&
      (filter === "全部" ||
        (filter === "已收服" ? s?.caught[id] : s?.seen[id] !== undefined)),
  );
  const pages = Math.max(1, Math.ceil(ids.length / dexPageSize));
  dexPage = Math.min(dexPage, pages - 1);
  $("dexcount").textContent =
    "已收服 " +
    scope.filter((id) => s?.caught[id]).length +
    " / " +
    scope.length;
  updateMarkup(
    "dexpager",
    '<button class="secondary" type="button" data-dex-page="-1" ' +
      (dexPage === 0 ? "disabled" : "") +
      '>上一页</button><span class="miniinfo" role="status">' +
      (dexPage + 1) +
      " / " +
      pages +
      " 页 · " +
      ids.length +
      ' 种</span><button class="secondary" type="button" data-dex-page="1" ' +
      (dexPage + 1 === pages ? "disabled" : "") +
      ">下一页</button>",
  );
  $("dexpager").hidden = pages === 1;
  updateMarkup(
    "dexgrid",
    ids
      .slice(dexPage * dexPageSize, (dexPage + 1) * dexPageSize)
      .map((id) => {
        const caught = Boolean(s?.caught[id]);
        const status = caught
          ? "已收服"
          : s?.seen[id] !== undefined
            ? "已目击"
            : "尚未发现";
        return (
          '<button class="tile" type="button" data-detail="' +
          id +
          '"><small>No. ' +
          fmt(id) +
          "</small>" +
          icon(id) +
          "<b>" +
          name(id) +
          '</b><span class="dex-status ' +
          (caught ? "caught" : "") +
          '">' +
          status +
          "</span></button>"
        );
      })
      .join("") || '<p class="brief">当前条件下没有记录。</p>',
  );
}
function renderDex() {
  if (!$("dexgrid")) {
    const options = Object.values(D.fieldRegions)
      .map(
        (field) =>
          '<option value="' + field.key + '">' + field.name + "地区</option>",
      )
      .join("");
    $("dex").innerHTML =
      '<div class="pagepanel"><div class="rowline"><h2>图鉴记录</h2><span class="num" id="dexcount" aria-live="polite"></span></div><div class="filter"><select id="dexregion" aria-label="图鉴范围"><option value="all">全国图鉴</option>' +
      options +
      '</select><select id="dexfilter" aria-label="收集状态"><option>全部</option><option>已目击</option><option>已收服</option></select><input id="dexsearch" type="search" placeholder="搜索名称或编号" aria-label="搜索图鉴"><label class="dex-art-filter"><input type="checkbox" id="dexart">有八方向图</label></div><div class="dexgrid" id="dexgrid"></div><div class="dex-pager" id="dexpager"></div></div>';
    const reset = () => {
      dexPage = 0;
      dexCards();
    };
    $("dexfilter").onchange = (event) => {
      filter = event.target.value;
      reset();
    };
    $("dexsearch").oninput = (event) => {
      search = event.target.value.trim();
      reset();
    };
    $("dexregion").onchange = reset;
    $("dexart").onchange = reset;
  }
  dexCards();
}
function detail(id) {
  const sp = D.species[id],
    s = state,
    m = s?.box[id],
    seen = s?.seen[id] !== undefined;
  const inTeam = s?.team.includes(id);
  const many = D.sightings[id];
  const field = D.fieldRegions[sp.region];
  const progress = s?.caught[id] ? "已收服" : seen ? "已目击" : "尚未发现";
  let body =
    '<div class="detailhero">' +
    icon(id) +
    '<div><small class="micro">NO. ' +
    fmt(id) +
    "</small><h2>" +
    sp.name +
    "</h2>" +
    sp.types.map((type) => '<span class="type">' + type + "</span>").join("") +
    '</div></div><p class="brief">' +
    field.name +
    "图鉴 · " +
    progress +
    (seen ? " · 首次记录于" + area().stops[s.seen[id]].name : "") +
    "</p>";
  if (many.length) {
    body +=
      '<div class="block"><h3>野外踪迹</h3><div class="actions">' +
      many
        .map(
          (index) =>
            '<button class="chip" data-locate="' +
            index +
            '">' +
            area().stops[index].name +
            "</button>",
        )
        .join("") +
      "</div>" +
      (s
        ? '<button class="secondary block" data-target="' +
          id +
          '">' +
          (s.target === id ? "取消捕捉目标" : "设为优先捕捉目标") +
          "</button>"
        : "") +
      "</div>";
  } else if ([1, 4, 7].includes(id)) {
    body +=
      '<p class="brief block">可在真新镇选为初始伙伴，也可在取得前两枚徽章后获赠。</p>';
  }
  if (sp.parent) {
    body +=
      '<div class="block"><span class="brief">也可通过进化获得</span><div class="actions"><button class="chip" data-detail="' +
      sp.parent +
      '">' +
      name(sp.parent) +
      " · " +
      evolutionRule(sp.rule) +
      "</button></div></div>";
  }
  if (m) {
    body +=
      '<div class="block"><b>Lv. ' +
      m.level +
      "</b> · 旅行经验 " +
      m.xp +
      " / " +
      J.xpNeeded(m.level) +
      '<p class="brief">出战招式（最多两项）</p><div class="actions">' +
      D.availableMoves(id, m.level)
        .map(
          (x) =>
            '<button class="chip" data-move="' +
            x +
            '" data-owner="' +
            id +
            '" aria-pressed="' +
            m.moves.includes(x) +
            '">' +
            (m.moves.includes(x) ? "✓ " : "") +
            x +
            " · " +
            D.moves[x][0] +
            "</button>",
        )
        .join("") +
      '</div></div><div class="actions">';
    if (inTeam && s.team[0] !== id)
      body +=
        '<button class="secondary" data-lead="' + id + '">调至队首</button>';
    if (inTeam && s.team.length > 1)
      body +=
        '<button class="secondary" data-store-id="' +
        id +
        '">寄存到仓库</button>';
    if (!inTeam)
      body +=
        '<button class="secondary" data-enlist="' +
        id +
        '">' +
        (s.team.length === 3 ? "选择替换位置" : "加入同行") +
        "</button>";
    body += "</div>";
    if (sp.evolutions.length) {
      body +=
        '<div class="block"><h3>进化分支</h3><div class="evolution-options">' +
        sp.evolutions
          .map(
            ({ id: next, rule }) =>
              '<div class="rowline"><span><b>' +
              name(next) +
              '</b><br><small class="miniinfo">' +
              evolutionRule(rule) +
              (typeof rule === "string"
                ? " · 持有 " + (s.stones[rule] || 0) + " 个"
                : "") +
              "</small></span>" +
              '<button class="secondary" data-evolve="' +
              id +
              '" data-next="' +
              next +
              '" ' +
              (J.canEvolve(s, id, next) ? "" : "disabled") +
              ">进化</button></div>",
          )
          .join("") +
        "</div></div>";
    }
  }
  modal(sp.name, body);
}
function evolutionRule(rule) {
  if (typeof rule === "string") return rule;
  if (typeof rule === "number") return "达到 Lv. " + rule;
  return "同行培养至 Lv. " + rule.bond;
}
function supplies() {
  const s = state;
  let body =
    '<p class="brief">每探索 15 分钟可获得 1 枚调查印记。取得第三枚徽章后，每枚可兑换一个进化石。</p>';
  if (s) {
    body +=
      '<p class="block"><b>调查印记 · ' +
      s.research +
      '</b></p><div class="supply-grid">' +
      D.stones
        .map(
          (stone) =>
            '<button class="tile" data-stone="' +
            stone +
            '" ' +
            (s.badges.length < 3 || !s.research ? "disabled" : "") +
            '><b class="item-label">' +
            stoneIcon(stone) +
            stone +
            "</b><small>持有 " +
            (s.stones[stone] || 0) +
            " 个</small></button>",
        )
        .join("") +
      "</div>";
  }
  modal("进化补给", body);
}
function prefs() {
  if (!state) {
    modal(
      "捕捉偏好",
      '<p class="brief">选好初始伙伴后即可调整用球规则。初始携带 12 颗精灵球，默认遇到新种自动投球。</p>',
    );
    return;
  }
  const s = state;
  const options = all.filter(
    (id) =>
      D.sightings[id].length && (s.seen[id] !== undefined || s.target === id),
  );
  const targetOptions = options
    .map(
      (id) =>
        '<option value="' +
        id +
        '"' +
        (id === s.target ? " selected" : "") +
        ">" +
        name(id) +
        "</option>",
    )
    .join("");
  modal(
    "捕捉偏好",
    '<form id="capture-settings"><div class="form-group">' +
      '<label class="formline"><strong>优先捕捉目标</strong><select id="target"><option value="0">未指定</option>' +
      targetOptions +
      "</select></label>" +
      '<label class="formline"><strong>只捕捉指定目标</strong><input type="checkbox" id="only"' +
      (s.only ? " checked" : "") +
      "></label>" +
      '<label class="formline"><strong>为目标保留精灵球</strong><input id="reserve" type="number" min="0" max="99" value="' +
      s.reserve +
      '"></label></div>' +
      '<p class="form-hint">已拥有的目标会自动跳过。预留球只供优先目标使用，每旅行 3 分钟补给 2 颗。</p>' +
      '<p class="form-error" role="alert" id="capture-error" hidden></p>' +
      '<p class="brief block">持有进化石 · ' +
      (Object.keys(s.stones)
        .filter((k) => s.stones[k])
        .join("、") || "暂无") +
      "</p>" +
      '<button type="submit" class="primary wide" id="apply">保存偏好</button></form>',
  );
  $("target").onchange = () => {
    $("target").removeAttribute("aria-invalid");
    $("capture-error").hidden = true;
  };
  $("capture-settings").onsubmit = async (event) => {
    event.preventDefault();
    const target = +$("target").value;
    const only = $("only").checked;
    const reserve = Math.max(
      0,
      Math.min(99, Math.floor(+$("reserve").value) || 0),
    );
    if (only && !target) {
      $("capture-error").textContent = "请选择一只优先捕捉目标。";
      $("capture-error").hidden = false;
      $("target").setAttribute("aria-invalid", "true");
      $("target").focus();
      return;
    }
    await sync((s) => {
      s.target = target;
      s.only = only;
      s.reserve = reserve;
    });
    closeModal();
    toast("捕捉偏好已保存");
  };
}

function gymName(stop) {
  const label = area().stops[stop].name;
  return label.endsWith("道馆") ? label : label.replace(/[市镇]$/, "") + "道馆";
}
function battleDetails(battle, levelBonus = 0) {
  const last = state?.history.find((entry) => entry.leader === battle.leader);
  const lineup = battle.foes
    .map(
      ([id, label, types, level, move]) =>
        '<div class="monrow">' +
        icon(id) +
        '<div class="info"><b>' +
        label +
        '</b><p class="miniinfo">' +
        types.join(" / ") +
        " · " +
        move +
        '</p></div><span class="miniinfo">Lv. ' +
        (level + levelBonus) +
        "</span></div>",
    )
    .join("");
  const report = last
    ? "<h3>最近一次挑战 · " +
      (last.win ? "胜利" : "失利") +
      "</h3>" +
      last.lines
        .map((line) => '<p class="brief">' + escapeText(line) + "</p>")
        .join("") +
      (JourneyBattle.canReplay(last)
        ? '<button class="secondary block" data-replay="' +
          state.history.indexOf(last) +
          '">回放对战</button>'
        : "")
    : "";
  return '<div class="block">' + lineup + "</div>" + report;
}
function gym(stop) {
  const g = area().gyms[stop];
  modal(
    gymName(stop),
    "<h3>" +
      g.leader +
      " · " +
      g.type +
      '属性</h3><p class="brief">' +
      g.badge +
      " · " +
      (state?.badges.includes(stop) ? "已获得" : "尚未获得") +
      "</p>" +
      battleDetails(g) +
      (state
        ? '<button class="secondary block" data-storage="warehouse">调整阵容</button>'
        : ""),
  );
}
function league() {
  const s = state;
  const rules = area().league;
  const total = rules.rounds.length;
  const wins = s?.leagueWins || 0;
  const badgeGoal = Object.keys(area().gyms).length;
  const badges = s?.badges.length || 0;
  const body = rules.rounds
    .map((round, index) => {
      const label = index === total - 1 ? "冠军战" : "四天王";
      const status =
        index < wins
          ? "已战胜"
          : index === wins && badges === badgeGoal
            ? "下一场"
            : "待挑战";
      return (
        '<button class="league-round" type="button" data-round="' +
        index +
        '"><span>' +
        label +
        " · " +
        round.leader +
        "</span><small>" +
        status +
        "</small></button>"
      );
    })
    .join("");
  let intro =
    '<p class="brief">取得全部 ' +
    badgeGoal +
    " 枚道馆徽章后，前往石英高原挑战联盟。每场胜利都会保存，落败后可调整队伍再战。</p>";
  if (s?.hall) {
    const date = new Date(s.hall.time).toLocaleDateString("zh-CN");
    const team = s.hall.team
      .map(
        (ally) =>
          '<div class="hall-member">' +
          icon(ally.id) +
          "<span>" +
          name(ally.id) +
          "</span><small>Lv. " +
          ally.level +
          "</small></div>",
      )
      .join("");
    intro =
      '<div class="hall"><h3>关都名人堂</h3><p class="brief">首次夺冠 · ' +
      date +
      "　累计夺冠 " +
      s.hall.count +
      ' 次</p><div class="hall-team">' +
      team +
      "</div></div>";
  }
  const rematch =
    s?.hall && wins === total
      ? '<button class="primary wide" type="button" data-rematch="1">开启联盟重赛</button>'
      : "";
  modal(
    "关都联盟",
    intro + '<div class="block league-rounds">' + body + "</div>" + rematch,
  );
}
function inspectRound(index) {
  const round = area().league.rounds[index];
  const s = state;
  const bonus =
    s?.hall && s.leagueWins < area().league.rounds.length
      ? Math.min(12, s.hall.count * 4)
      : 0;
  modal(
    round.leader,
    '<p class="brief">' +
      (round.type === "冠军"
        ? "冠军战"
        : "四天王 · " + round.type + "属性专长") +
      "</p>" +
      battleDetails(round, bonus) +
      '<div class="actions block"><button class="secondary" data-league="1">联盟赛程</button>' +
      (s
        ? '<button class="secondary" data-storage="warehouse">调整阵容</button>'
        : "") +
      "</div>",
  );
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const a = b.dataset;
  if (await JourneyStorage.handle(a)) return;
  if (a.replay !== undefined) {
    JourneyBattle.replay(state?.history[+a.replay]);
    return;
  }
  if (a.startpick) {
    starter = +a.startpick;
    render();
    return;
  }
  if (a.start) {
    await sync((s, now) => s || J.start(starter, now));
    document
      .querySelector('[data-mode="travel"]')
      ?.focus({ preventScroll: true });
    toast("出发了！");
    return;
  }
  if (a.detail) {
    detail(+a.detail);
    return;
  }
  if (a.league) {
    league();
    return;
  }
  if (a.round !== undefined) {
    inspectRound(+a.round);
    return;
  }
  if (a.gym) {
    gym(+a.gym);
    return;
  }
  if (a.world) {
    world();
    return;
  }
  if (a.fieldRegion) {
    showRoute(
      a.fieldRegion === "kanto" ? 0 : area().surveyStops[a.fieldRegion][0],
    );
    return;
  }
  if (a.locate !== undefined) {
    showRoute(+a.locate);
    return;
  }
  if (a.supply) {
    supplies();
    return;
  }
  if (a.dexPage) {
    dexPage += +a.dexPage;
    dexCards();
    $("pagetitle").scrollIntoView({ block: "start" });
    $("dexgrid").querySelector("button")?.focus({ preventScroll: true });
    return;
  }
  if (a.route !== undefined) {
    selectedRoute = +a.route;
    renderMap();
    return;
  }
  if (a.field) {
    location.hash = "field";
    return;
  }
  if (!state) return;
  if (a.stone) {
    let received = false;
    await sync((s) => {
      received = J.exchangeStone(s, a.stone);
    });
    supplies();
    if (received) toast("已兑换" + a.stone);
    return;
  }
  if (a.rematch) {
    let started = false;
    await sync((s) => {
      started = J.rematch(s);
    });
    if (started) {
      closeModal();
      location.hash = "field";
      toast("已开启联盟重赛");
    }
    return;
  }
  if (a.mode) {
    await sync((s) => {
      s.mode = a.mode;
    });
    return;
  }
  if (a.go !== undefined) {
    const to = +a.go;
    let moved = false;
    await sync((s) => {
      moved = J.visit(s, to);
    });
    if (moved) {
      location.hash = "field";
      toast("已抵达" + area().stops[to].name);
    }
    return;
  }
  if (a.target) {
    const id = +a.target;
    await sync((s) => {
      s.target = s.target === id ? 0 : id;
      if (!s.target) s.only = false;
    });
    detail(id);
    return;
  }
  if (a.evolve) {
    const id = +a.evolve,
      next = +a.next;
    await sync((s, now) => {
      J.evolve(s, id, now, next);
    });
    detail(state.box[next] ? next : id);
    return;
  }
  if (a.lead) {
    const id = +a.lead;
    await sync((s) => {
      if (s.team.includes(id)) s.team = [id, ...s.team.filter((x) => x !== id)];
    });
    detail(id);
    return;
  }
  if (a.move) {
    const id = +a.owner;
    await sync((s) => {
      const m = s.box[id];
      if (!m) return;
      if (m.moves.includes(a.move)) {
        if (m.moves.length > 1) m.moves = m.moves.filter((x) => x !== a.move);
      } else m.moves = [...m.moves.slice(0, 1), a.move];
    });
    detail(id);
    return;
  }
});
$("prefs").onclick = prefs;
$("morelog").onclick = () =>
  modal(
    "旅行日志",
    state
      ? rows(state.logs)
      : '<p class="brief">选好初始伙伴后，沿途见闻将在这里留下记录。</p>',
  );
$("expand").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("scene").requestFullscreen();
  } catch {
    toast("当前浏览器未开放全屏显示");
  }
};
window.addEventListener("storage", (e) => {
  if (e.key === KEY) sync();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) sync(undefined, true);
});
window.addEventListener("DOMContentLoaded", async () => {
  await JourneySpriteArt.ready;
  $("local-art-credit").hidden = !JourneySpriteArt.info().directory;
  choosePage(location.hash.slice(1));
  sync(undefined, true);
});
setInterval(() => {
  if (!document.hidden) sync();
}, 1500);
