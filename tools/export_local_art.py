"""Bundle the locally prepared sprites into one browser-importable file."""
import argparse
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent.parent
LOCAL = ROOT / "dist/assets/local-mon"
MAGIC = b"KANTART1"


def export(output):
    index = json.loads((LOCAL / "credits.json").read_text(encoding="utf-8"))["entries"]
    rows, files = [], []
    for record in index:
        if record["style"] == "existing-pmd":
            continue
        species_id = record["id"]
        icon = (LOCAL / f"{species_id}-icon.png").read_bytes()
        sheet = (LOCAL / f"{species_id}.png").read_bytes()
        rows.append([species_id, record["views"], len(icon), len(sheet)])
        files.extend((icon, sheet))
    directory = json.dumps(rows, separators=(",", ":")).encode("utf-8")
    temp = output.with_name(output.name + ".tmp")
    with temp.open("wb") as handle:
        handle.write(MAGIC)
        handle.write(struct.pack("<I", len(directory)))
        handle.write(directory)
        handle.writelines(files)
    temp.replace(output)
    print(f"{len(rows)} species included. File: {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination .kanto-art file")
    export(parser.parse_args().output.resolve())
