"""Numeric visual telemetry and frozen-color comparisons; not a visual acceptance verdict."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import sobel

ROOT = Path(__file__).resolve().parents[4]
ASSETS = ROOT / "specs/retinal-vision/assets"
def inspect(folder):
    results = []
    manifest = json.loads((folder / "figures.json").read_bytes())
    actual = sorted(p.name for p in folder.glob("*.png"))
    assert actual == sorted(manifest["files"])
    for name in actual:
        path = folder / name
        rgb = np.asarray(Image.open(path).convert("RGB"))
        gray = .2126 * rgb[:, :, 0] + .7152 * rgb[:, :, 1] + .0722 * rgb[:, :, 2]
        assert np.isfinite(gray).all()
        results.append(dict(path=str(path.relative_to(ASSETS)), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            width=rgb.shape[1], height=rgb.shape[0], grayRange=[float(gray.min()), float(gray.max())],
            meanGray=float(gray.mean()), edgeEnergy=float(np.hypot(sobel(gray,0),sobel(gray,1)).mean())))
    checks = folder / "patch-pixel-checks.json"
    if checks.exists():
        values = json.loads(checks.read_bytes())
        assert len(values) == 16 and max(value["maximumError"] for value in values) <= 1
    return results


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--panel", type=Path, action="append", help="Inspect a supplied figure directory instead of the original paired v1 panels")
parser.add_argument("--output", type=Path, default=ASSETS / "08/visual-metrics.json")
args = parser.parse_args()
results = []
comparisons = []
if args.panel:
    for folder in args.panel:
        results.extend(inspect(folder.resolve()))
else:
    for slice_id in ["08", "09"]:
        for phase in ["diagnostic", "confirmation"]:
            results.extend(inspect(ASSETS / slice_id / phase / "figures"))
        first = ASSETS / slice_id / "diagnostic/figures"
        second = ASSETS / slice_id / "confirmation/figures"
        for path in sorted(first.glob("inputs-*.png")):
            left = np.asarray(Image.open(path).convert("RGB"))[150:]
            right = np.asarray(Image.open(second / path.name).convert("RGB"))[150:]
            delta = np.abs(left.astype(int) - right.astype(int))
            comparisons.append(dict(kind="same frozen RGB/control panels; phase-title strip excluded, remaining label raster differences retained", slice=slice_id,
                image=path.name, maximumRgbDifference=int(delta.max()), changedPixelFraction=float(np.any(delta,axis=2).mean())))
        for name in ["color-inputs-enlarged.png", "color-patch-crops.png"]:
            if (first / name).exists():
                assert (first / name).read_bytes() == (second / name).read_bytes()
                comparisons.append(dict(kind="identical RGB enlarged panels", slice=slice_id, image=name, pngBytesEqual=True))
        left = np.asarray(Image.open(first / "responses.png").convert("RGB"))
        right = np.asarray(Image.open(second / "responses.png").convert("RGB"))
        delta = np.abs(left.astype(int) - right.astype(int))
        assert np.any(delta)
        comparisons.append(dict(kind="six-seed versus thirty-seed response figure", slice=slice_id,
            image="responses.png", maximumRgbDifference=int(delta.max()), changedPixelFraction=float(np.any(delta,axis=2).mean())))
args.output.write_text(json.dumps(dict(images=results, comparisons=comparisons,
    scope="Every generated PNG measured; exact patch colors and unchanged frozen inputs checked. Metrics do not establish biological validity or visual readability."), indent=2) + "\n")
print(json.dumps(dict(images=len(results), comparisons=len(comparisons))))
