"""Import existing workspace art for local-only play. No network access."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "dist/assets/mon"
DEST = ROOT / "dist/assets/local-mon"
FIT = (58, 58)
CELL = 64
IDS = range(1, 1026)


def padded_frames(frames, fit=FIT):
    bounds = [frame.getchannel("A").getbbox() for frame in frames]
    if not all(bounds):
        raise ValueError("Transparent animation frame")
    crop = (
        min(bound[0] for bound in bounds), min(bound[1] for bound in bounds),
        max(bound[2] for bound in bounds), max(bound[3] for bound in bounds),
    )
    for frame in frames:
        image = frame.crop(crop)
        image.thumbnail(fit, Image.Resampling.NEAREST)
        cell = Image.new("RGBA", (CELL, CELL))
        cell.paste(image, ((CELL - image.width) // 2, 60 - image.height))
        yield cell


def draw_icon(frame, path):
    bounds = frame.getchannel("A").getbbox()
    image = frame.crop(bounds)
    icon = Image.new("RGBA", (CELL, CELL))
    icon.paste(image, ((CELL-image.width)//2, (CELL-image.height)//2))
    icon.save(path, optimize=True)


def sample_frames(count):
    if count < 1:
        raise ValueError("Animation has no recorded frames")
    return [min(count-1, int((i+.25)*count/4)) for i in range(4)]


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def pmd_frames(folder):
    xml = ElementTree.parse(folder / "AnimData.xml")
    move = next(anim for anim in xml.findall("./Anims/Anim") if anim.findtext("Name") == "Walk")
    width, height = int(move.findtext("FrameWidth")), int(move.findtext("FrameHeight"))
    count = len(move.findall("./Durations/Duration"))
    path = folder / "Walk-Anim.png"
    with Image.open(path) as source:
        sheet = source.convert("RGBA")
    if sheet.height < 8*height or sheet.width < count*width:
        raise ValueError(f"{path} is missing a frame or direction")
    # The local PMD assets use down, down-left, left, up-left, up,
    # up-right, right, and down-right, matching the game's walk cells.
    def frame(row, index):
        return sheet.crop((index*width,row*height,(index+1)*width,(row+1)*height))
    return path, [[frame(row,index) for index in sample_frames(count)] for row in range(8)]


def battle_frames(folder, side, meta):
    gif = folder / (side + ".gif")
    if gif.exists():
        with Image.open(gif) as image:
            frames = []
            for index in sample_frames(image.n_frames):
                image.seek(index)
                frames.append(image.convert("RGBA"))
        return gif, frames
    path = folder / (side + ".png")
    row = meta[side]
    width,height,count,cols = (row[key] for key in ("w","h","count","cols"))
    with Image.open(path) as image:
        sheet = image.convert("RGBA")
    if sheet.width < min(count,cols)*width or sheet.height < (1+(count-1)//cols)*height:
        raise ValueError(f"Incomplete frame sheet: {path}")
    frames = []
    for index in sample_frames(count):
        x,y = (index%cols)*width,(index//cols)*height
        frames.append(sheet.crop((x,y,x+width,y+height)))
    return path,frames


def normalized_rows(raw_rows):
    # Keep registration stable across frames. Treat facing groups separately
    # because the front and back atlases for late species use different bounds.
    return [list(padded_frames(row)) for row in raw_rows]


def write_sheets(id, rows):
    output = Image.new("RGBA", (CELL*4,CELL*len(rows)))
    for y,row in enumerate(rows):
        for x,frame in enumerate(row):
            output.paste(frame,(CELL*x,CELL*y))
    output.save(DEST/f"{id}.png", optimize=True)
    draw_icon(rows[0][0], DEST/f"{id}-icon.png")


def build(emerald, tower):
    DEST.mkdir(parents=True, exist_ok=True)
    overworld = emerald / "tools/pmd-field/sources"
    modern = emerald / "assets/pokemon"
    pmd = {int(folder.name):folder for folder in overworld.iterdir()
           if folder.name.isdecimal() and (folder/"Walk-Anim.png").is_file()}
    # Emerald's cached #386 walk uses Speed Forme; this catalog uses Normal Forme.
    pmd.pop(386,None)
    pmd.update({id:tower/f"{id:04}" for id in (66,92)})
    expanded_info = json.loads((emerald/"assets/expanded/art.json").read_text(encoding="utf-8-sig"))["ready"]

    def pack(id):
        if (BASE/f"{id}.png").is_file() and (BASE/f"{id}-icon.png").is_file():
            return {"id":id,"views":8,"style":"existing-pmd","reference":"assets/mon/credits.txt"}
        if id in pmd:
            folder = pmd[id]
            path, rows = pmd_frames(folder)
            write_sheets(id, normalized_rows(rows))
            credit = (folder/"credits.txt").read_text(encoding="utf-8-sig").splitlines()
            return {"id":id,"views":8,"style":"local-pmd","file":str(path),"sha256":digest(path),"credit":credit}
        folder = modern / str(id)
        metadata = folder/"meta.json"
        meta=json.loads(metadata.read_text(encoding="utf-8-sig")) if metadata.exists() else {}
        front,battle_front = battle_frames(folder,"front",meta)
        back,battle_back = battle_frames(folder,"back",meta)
        packed = normalized_rows([battle_front,battle_back])
        write_sheets(id,packed)
        fields = meta or expanded_info.get(str(id),{}).get("art",{})
        return {"id":id,"views":2,"style":fields.get("style","cached-battle-gif"),
                "files":[str(front),str(back)],"sha256":[digest(front),digest(back)],
                "sources":fields.get("sources",[])}

    with ThreadPoolExecutor(max_workers=6) as executor:
        records = list(executor.map(pack,IDS))
    layout = {row["id"]:row["views"] for row in records if row["style"]!="existing-pmd"}
    manifest = json.dumps(layout, separators=(",", ":"))
    (DEST/"manifest.js").write_text("window.JourneyLocalArt = "+manifest+";\n",encoding="utf-8")
    (DEST/"credits.json").write_text(json.dumps({"scope":"local use; imported from existing workspace sources",
        "entries":records}, ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"{len(records)} entries: {dict(Counter(row['style'] for row in records))}")
    print(f"Native directional views: {dict(Counter(row['views'] for row in records))}")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("emerald",type=Path,help="Root of existing EmeraldHD2D project")
    parser.add_argument("tower",type=Path,help="Existing PokemonTD assets/pokemon directory")
    args=parser.parse_args()
    build(args.emerald.resolve(),args.tower.resolve())
