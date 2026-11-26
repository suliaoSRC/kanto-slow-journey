/* Local sprite bundles contain a small directory followed by PNG pairs. */
const JourneyArtPack = (() => {
  const magic = "KANTART1";
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  const hasPngHeader = (bytes, view, offset, length, width, height) =>
    length >= 33 &&
    pngSignature.every((value, i) => bytes[offset + i] === value) &&
    view.getUint32(offset + 8) === 13 &&
    view.getUint32(offset + 12) === 0x49484452 &&
    view.getUint32(offset + 16) === width &&
    view.getUint32(offset + 20) === height;
  function parse(buffer) {
    const bytes = new Uint8Array(buffer);
    if (
      bytes.length < 12 ||
      bytes.length > 40 * 1024 * 1024 ||
      !Array.from(magic).every((value, i) => bytes[i] === value.charCodeAt(0))
    )
      throw Error("素材包格式无效");
    const data = new DataView(buffer);
    const length = data.getUint32(8, true);
    if (!length || length > 64 * 1024 || 12 + length >= bytes.length)
      throw Error("素材目录无效");
    const index = JSON.parse(
      new TextDecoder().decode(bytes.subarray(12, 12 + length)),
    );
    if (!Array.isArray(index) || !index.length || index.length > 1025)
      throw Error("素材目录无效");
    const entries = new Map();
    let offset = 12 + length;
    for (const row of index) {
      if (!Array.isArray(row) || row.length !== 4) throw Error("素材条目无效");
      const [id, views, iconSize, sheetSize] = row;
      if (
        !Number.isInteger(id) ||
        id < 1 ||
        id > 1025 ||
        entries.has(id) ||
        ![2, 8].includes(views) ||
        ![iconSize, sheetSize].every(
          (n) => Number.isInteger(n) && n >= 33 && n < 512 * 1024,
        ) ||
        offset + iconSize + sheetSize > bytes.length
      )
        throw Error("素材条目不完整");
      if (
        !hasPngHeader(bytes, data, offset, iconSize, 64, 64) ||
        !hasPngHeader(
          bytes,
          data,
          offset + iconSize,
          sheetSize,
          256,
          64 * views,
        )
      )
        throw Error("像素图尺寸不符合素材包规范");
      entries.set(id, {
        views,
        icon: [offset, offset + iconSize],
        sheet: [offset + iconSize, offset + iconSize + sheetSize],
      });
      offset += iconSize + sheetSize;
    }
    if (offset !== bytes.length) throw Error("素材包长度不一致");
    return entries;
  }
  return { parse };
})();
if (typeof module !== "undefined") module.exports = JourneyArtPack;
