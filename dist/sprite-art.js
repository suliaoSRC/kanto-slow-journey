/* The shipped artwork works by itself. Optional packs are read from this device. */
const JourneySpriteArt = (() => {
  const stock = new Set([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    26, 27, 28, 35, 36, 41, 42, 43, 44, 45, 46, 47, 52, 53, 54, 55, 56, 57, 74,
    81, 95, 100, 120, 121, 129, 130,
  ]);
  let local = {};
  let installed = new Map();
  let pack = null;
  let persisted = false;
  const urls = new Map();
  const loaded = new Map();
  const originAllowsFiles =
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const views = (id) =>
    stock.has(id) ? 8 : installed.get(id)?.views || local[id] || 0;
  function localManifest() {
    if (!originAllowsFiles) return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "assets/local-mon/manifest.js";
      const complete = () => {
        local = window.JourneyLocalArt || {};
        resolve();
      };
      script.onload = complete;
      script.onerror = complete;
      document.head.append(script);
    });
  }
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("kanto-journey-art", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("packs");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error("素材仓库正由另一个页面使用"));
    });
  }
  async function readPack() {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = db
          .transaction("packs")
          .objectStore("packs")
          .get("current");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }
  async function writePack(blob) {
    const db = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("packs", "readwrite");
        tx.objectStore("packs").put(blob, "current");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  function setPack(blob, entries, saved) {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
    loaded.clear();
    pack = blob;
    installed = entries;
    persisted = saved;
  }
  async function install(blob) {
    if (blob.size > 40 * 1024 * 1024) throw Error("素材包不能超过 40 MB");
    const entries = JourneyArtPack.parse(await blob.arrayBuffer());
    let saved = true;
    try {
      await writePack(blob);
    } catch {
      saved = false;
    }
    setPack(blob, entries, saved);
    return info();
  }
  const ready = Promise.all([
    localManifest(),
    (async () => {
      try {
        const blob = await readPack();
        if (blob instanceof Blob && blob.size <= 40 * 1024 * 1024) {
          setPack(blob, JourneyArtPack.parse(await blob.arrayBuffer()), true);
        }
      } catch {
        /* Browsers without local storage still use the shipped artwork. */
      }
    })(),
  ]);
  function info() {
    return {
      total: new Set([
        ...stock,
        ...Object.keys(local).map(Number),
        ...installed.keys(),
      ]).size,
      imported: installed.size,
      persisted,
      directory: Object.keys(local).length > 0,
    };
  }
  function url(id, kind) {
    const filename = id + (kind === "icon" ? "-icon" : "") + ".png";
    if (stock.has(id)) return "assets/mon/" + filename;
    const entry = installed.get(id);
    if (!entry) return local[id] ? "assets/local-mon/" + filename : "";
    const key = id + ":" + kind;
    if (!urls.has(key))
      urls.set(
        key,
        URL.createObjectURL(pack.slice(...entry[kind], "image/png")),
      );
    return urls.get(key);
  }
  function draw(ctx, id, x, y, direction, frame, scale = 1) {
    const available = views(id);
    if (!available) return false;
    if (!loaded.has(id)) {
      const image = new Image();
      image.src = url(id, "sheet");
      loaded.set(id, image);
    }
    const sheet = loaded.get(id);
    if (!sheet.complete || !sheet.naturalWidth) return false;
    const row =
      available === 8 ? direction : direction >= 3 && direction <= 5 ? 1 : 0;
    // Battle atlases are framed closer than the native walking art.
    const displayScale = available === 2 ? scale * 0.76 : scale;
    const cell = 64,
      size = Math.round(cell * displayScale);
    ctx.drawImage(
      sheet,
      frame * cell,
      row * cell,
      cell,
      cell,
      Math.round(x - 32 * displayScale),
      Math.round(y - 60 * displayScale),
      size,
      size,
    );
    return true;
  }
  return {
    views,
    iconUrl: (id) => url(id, "icon"),
    draw,
    ready,
    info,
    install,
  };
})();
