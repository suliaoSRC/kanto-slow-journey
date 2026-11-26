const JourneyStorage = (() => {
  let tab = "warehouse";
  let query = "";
  let type = "";
  let sort = "id";
  let offset = 0;
  let pendingSave = null;
  const pageSize = 36;
  const labels = {
    warehouse: "宝可梦仓库",
    bag: "道具背包",
    save: "存档",
    art: "素材",
  };

  function row(id, slot) {
    const mon = state.box[id];
    const action = (name, attributes, disabled = false) =>
      '<button class="secondary" type="button" ' +
      attributes +
      (disabled ? " disabled" : "") +
      ">" +
      name +
      "</button>";
    const move = (to) =>
      'data-party-id="' + id + '" data-party-slot="' + to + '"';
    return (
      '<div class="warehouse-slot"><button class="monrow" data-detail="' +
      id +
      '">' +
      icon(id) +
      '<span class="info"><b>' +
      name(id) +
      "</b><small>Lv. " +
      mon.level +
      " · 第 " +
      (slot + 1) +
      ' 位</small></span></button><div class="actions">' +
      action("前移", move(slot - 1), slot === 0) +
      action("后移", move(slot + 1), slot === state.team.length - 1) +
      action("寄存", 'data-store-id="' + id + '"', state.team.length === 1) +
      "</div></div>"
    );
  }
  function warehouse() {
    if (!state) {
      updateMarkup(
        "storage-main",
        '<p class="brief">开始旅行后，可在这里编排同行队伍和寄存伙伴。</p><button class="primary block" data-field="1">返回旅行现场</button>',
      );
      return;
    }
    if (!$("warehouse-grid")) {
      const typeItems = Object.keys(typePalette)
        .map((label) => "<option>" + label + "</option>")
        .join("");
      updateMarkup(
        "storage-main",
        '<div class="warehouse-layout"><section class="team-editor"><h2>同行队伍</h2><p class="brief">按显示顺序自动出战。</p><div id="warehouse-team"></div></section><section class="collection-editor"><div class="rowline"><h2>寄存伙伴</h2><span class="num" id="warehouse-count"></span></div><div class="filter"><input type="search" id="warehouse-search" aria-label="搜索寄存伙伴" placeholder="按名称或编号搜索"><select id="warehouse-type" aria-label="按属性筛选"><option value="">全部属性</option>' +
          typeItems +
          '</select><select id="warehouse-sort" aria-label="仓库排序"><option value="id">图鉴编号</option><option value="level">等级从高到低</option></select></div><div id="warehouse-grid" class="dexgrid warehouse-grid"></div><div id="warehouse-pager" class="dex-pager"></div></section></div>',
      );
      $("warehouse-search").value = query;
      $("warehouse-type").value = type;
      $("warehouse-sort").value = sort;
      $("warehouse-search").oninput = (e) => {
        query = e.target.value.trim();
        offset = 0;
        warehouse();
      };
      $("warehouse-type").onchange = (e) => {
        type = e.target.value;
        offset = 0;
        warehouse();
      };
      $("warehouse-sort").onchange = (e) => {
        sort = e.target.value;
        offset = 0;
        warehouse();
      };
    }
    const s = state;
    updateMarkup(
      "warehouse-team",
      s.team.map(row).join("") +
        (s.team.length < 3
          ? '<div class="warehouse-empty">还有 ' +
            (3 - s.team.length) +
            " 个空位</div>"
          : ""),
    );
    const stored = Object.keys(s.box)
      .map(Number)
      .filter((id) => !s.team.includes(id));
    const matching = stored
      .filter(
        (id) =>
          (!query || name(id).includes(query) || fmt(id).includes(query)) &&
          (!type || D.species[id].types.includes(type)),
      )
      .sort((a, b) =>
        sort === "level" ? s.box[b].level - s.box[a].level || a - b : a - b,
      );
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    offset = Math.min(offset, pages - 1);
    $("warehouse-count").textContent = stored.length + " 只寄存";
    updateMarkup(
      "warehouse-grid",
      matching
        .slice(offset * pageSize, (offset + 1) * pageSize)
        .map(
          (id) =>
            '<article class="tile"><button type="button" class="warehouse-profile" data-detail="' +
            id +
            '">' +
            icon(id) +
            "<b>" +
            name(id) +
            "</b><small>Lv. " +
            s.box[id].level +
            " · " +
            D.species[id].types.join(" / ") +
            "</small></button>" +
            '<button type="button" class="secondary" data-enlist="' +
            id +
            '">' +
            (s.team.length < 3 ? "加入同行" : "更换队伍成员") +
            "</button></article>",
        )
        .join("") ||
        '<p class="brief">' +
          (stored.length
            ? "没有符合条件的伙伴。"
            : "新收服的宝可梦在队伍满员后会寄存在这里。") +
          "</p>",
    );
    $("warehouse-pager").hidden = pages === 1;
    updateMarkup(
      "warehouse-pager",
      '<button class="secondary" data-storage-offset="-1" ' +
        (offset === 0 ? "disabled" : "") +
        ">上一页</button><span>" +
        (offset + 1) +
        " / " +
        pages +
        '</span><button class="secondary" data-storage-offset="1" ' +
        (offset + 1 === pages ? "disabled" : "") +
        ">下一页</button>",
    );
  }
  function bag() {
    const s = state;
    const count = s?.balls ?? 12;
    const reserve = s?.target ? Math.min(count, s.reserve) : 0;
    const ordinary = s?.only ? 0 : count - reserve;
    const stones = D.stones
      .filter((stone) => s?.stones[stone])
      .map(
        (stone) =>
          '<div class="item-line"><strong class="item-label">' +
          stoneIcon(stone) +
          stone +
          "</strong><b>" +
          s.stones[stone] +
          "</b></div>",
      )
      .join("");
    updateMarkup(
      "storage-main",
      '<div class="inventory-grid"><section class="inventory-card"><div class="rowline"><h2 class="item-label"><i class="ball-icon" aria-hidden="true"></i>精灵球</h2><strong class="inventory-quantity">' +
        count +
        '</strong></div><p class="brief">探索每满 3 分钟补给 2 颗，最多 99 颗。</p><div class="block item-list"><div class="item-line"><span>普通捕捉可用</span><b>' +
        ordinary +
        '</b></div><div class="item-line"><span>优先目标预留</span><b>' +
        reserve +
        '</b></div></div><div class="rowline"><span class="brief">' +
        (s?.target ? "当前目标 · " + name(s.target) : "当前规则 · 优先新种") +
        '</span><button class="secondary" data-prefs="1">捕捉偏好</button></div></section><section class="inventory-card"><div class="rowline"><h2>进化石</h2><button class="secondary" data-supply="1">兑换</button></div><p class="brief">调查印记 · ' +
        (s?.research || 0) +
        '</p><div class="block item-list">' +
        (stones || '<p class="brief">当前背包里没有进化石。</p>') +
        "</div></section></div>",
    );
  }
  function saves() {
    updateMarkup(
      "storage-main",
      '<div class="inventory-card save-card"><h2>转移旅行进度</h2><p class="brief block">存档保存在当前浏览器。要在其他设备或网址继续旅行，可导出此页面的进度，再到新页面导入。</p><div class="actions"><button type="button" class="primary" data-export-save="1" ' +
        (state ? "" : "disabled") +
        '>导出存档</button><button type="button" class="secondary" data-import-save="1">导入存档</button></div></div>',
    );
  }
  function renderArt() {
    if (!$("art-upload")) {
      updateMarkup(
        "storage-main",
        '<div class="inventory-card save-card"><h2>宝可梦素材包</h2>' +
          '<p class="brief block">导入 .kanto-art 文件，补充图鉴、仓库和赛场的宝可梦图像。导入的文件保存在当前浏览器。</p>' +
          '<p class="block" id="art-count"></p><label class="art-picker">' +
          '<span>选择素材包</span><input type="file" id="art-upload" accept=".kanto-art"></label>' +
          '<p class="brief block" id="art-status" role="status"></p></div>',
      );
      $("art-upload").onchange = async (event) => {
        const input = event.currentTarget,
          file = input.files[0],
          status = $("art-status");
        if (!file) return;
        input.disabled = true;
        status.textContent = "正在读取素材包…";
        try {
          const result = await JourneySpriteArt.install(file);
          if ($("art-count"))
            $("art-count").textContent =
              "当前已配图像 " + result.total + " / 1025 种";
          status.textContent = result.persisted
            ? "已导入，刷新后仍可使用。"
            : "已导入。本次会话可用，浏览器未能保存素材包。";
        } catch (error) {
          status.textContent = error.message || "读取失败，请重新选择素材包。";
        } finally {
          input.disabled = false;
          input.value = "";
        }
      };
    }
    const { total } = JourneySpriteArt.info();
    $("art-count").textContent = "当前已配图像 " + total + " / 1025 种";
  }
  function render() {
    if (!$("storage-main"))
      $("storage").innerHTML =
        '<div class="pagepanel"><div role="group" aria-label="背包与仓库分类" id="storage-tabs" class="storage-tabs"></div><div id="storage-main"></div></div>';
    updateMarkup(
      "storage-tabs",
      Object.entries(labels)
        .map(
          ([key, label]) =>
            '<button type="button" class="chip" data-storage-tab="' +
            key +
            '" aria-pressed="' +
            (tab === key) +
            '">' +
            label +
            "</button>",
        )
        .join(""),
    );
    if (tab === "warehouse") warehouse();
    else if (tab === "bag") bag();
    else if (tab === "art") renderArt();
    else saves();
  }
  function open(next = "warehouse") {
    tab = next;
    closeModal();
    if (page === "storage") render();
    else location.hash = "storage";
  }
  async function place(id, slot) {
    let changed = false;
    await sync((s) => {
      changed = J.placeInParty(s, id, slot);
    });
    if (changed) toast(name(id) + "已调至同行队伍");
    return changed;
  }
  function chooseSlot(id) {
    const s = state;
    if (!s?.box[id] || s.team.includes(id)) return;
    if (s.team.length < 3) {
      place(id).then((changed) => {
        if (changed && $("dialog").open) detail(id);
      });
      return;
    }
    modal(
      "选择替换位置",
      '<p class="brief">将' +
        name(id) +
        '加入队伍。换下的伙伴会进入仓库。</p><div class="block">' +
        s.team
          .map(
            (other, slot) =>
              '<button class="monrow" data-replace="' +
              id +
              '" data-replace-slot="' +
              slot +
              '">' +
              icon(other) +
              '<span class="info"><b>' +
              name(other) +
              "</b><small>第 " +
              (slot + 1) +
              ' 位</small></span><span class="miniinfo">替换</span></button>',
          )
          .join("") +
        "</div>",
    );
  }
  async function exportSave() {
    await sync();
    if (!state) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "kanto-journey-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importSave() {
    pendingSave = null;
    modal(
      "导入旅行存档",
      '<p class="brief block">选择此前导出的旅行存档 JSON 文件。</p><input type="file" id="save-file" accept=".json,application/json"><p class="brief block" id="save-review" role="status"></p><button class="primary wide" data-confirm-save="1" disabled>导入并替换当前存档</button>',
    );
    $("save-file").onchange = async (e) => {
      const file = e.target.files[0];
      const button = $("dcontent").querySelector("[data-confirm-save]");
      pendingSave = null;
      button.disabled = true;
      if (!file) return;
      try {
        if (file.size > 2_500_000) throw Error("size");
        const data = JourneySave.parse(await file.text());
        if (!$("save-review") || e.target.files[0] !== file) return;
        pendingSave = data;
        $("save-review").textContent =
          J.route(data).name +
          " · " +
          data.badges.length +
          " 枚徽章 · " +
          Object.keys(data.caught).length +
          " 种已收服";
        button.disabled = false;
      } catch {
        if ($("save-review"))
          $("save-review").textContent =
            "无法读取该存档。请使用关都慢旅行导出的 JSON 文件。";
      }
    };
  }
  async function handle(a) {
    if (a.storage) {
      open(a.storage);
      return true;
    }
    if (a.storageTab) {
      open(a.storageTab);
      return true;
    }
    if (a.storageOffset) {
      offset += +a.storageOffset;
      warehouse();
      return true;
    }
    if (a.enlist) {
      chooseSlot(+a.enlist);
      return true;
    }
    if (a.partyId) {
      await place(+a.partyId, +a.partySlot);
      return true;
    }
    if (a.storeId) {
      await sync((s) => {
        J.storePartner(s, +a.storeId);
      });
      if ($("dialog").open) detail(+a.storeId);
      return true;
    }
    if (a.replace) {
      if (await place(+a.replace, +a.replaceSlot)) closeModal();
      return true;
    }
    if (a.prefs) {
      prefs();
      return true;
    }
    if (a.exportSave) {
      await exportSave();
      return true;
    }
    if (a.importSave) {
      importSave();
      return true;
    }
    if (a.confirmSave && pendingSave) {
      const imported = pendingSave;
      pendingSave = null;
      await sync((s, now) => {
        J.advance(imported, now);
        return imported;
      });
      closeModal();
      toast("旅行存档已导入");
      return true;
    }
    return false;
  }
  return {
    render,
    handle,
    select: (next) => {
      tab = next;
    },
  };
})();
