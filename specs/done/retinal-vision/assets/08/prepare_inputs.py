"""Archive exact diagnostic RGB8 inputs; never evaluates a Brain or chooses a response."""
import argparse
import hashlib
import json
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare(root, optics, benchmark, output, occlusion=None):
    map_dir = root / "specs/done/retinal-vision/assets/05"
    mapping = json.loads((map_dir / "retinal-map.json").read_bytes())
    fixtures = json.loads((map_dir / "current-fixtures.json").read_bytes())
    samples = len(mapping["profile"]["layout"]["cells"])
    assert samples == 721
    by_name = {case["name"]: case for case in fixtures["cases"]}
    bindings = []
    output.mkdir(parents=True, exist_ok=True)
    (output / "inputs").mkdir(exist_ok=True)
    packs = {}
    for slice_id in ["08", "09"]:
        packs[slice_id] = dict(version=1, slice=slice_id, phase="diagnostic", profile=mapping["identities"],
                              conditions=[], primaryContrasts=[], exactPairs=[], chromaticOffPairs=[], dosePairs=[])

    def load(path, label):
        raw = path.read_bytes()
        bindings.append(dict(label=label, sha256=digest(raw), filename=path.name))
        return json.loads(raw)

    def rgb(case):
        value = bytearray(case["fillRgb8"] * (2 * samples))
        for update in case["updates"]:
            at = ((0 if update["eye"] == "L" else 1) * samples + update["sample"]) * 3
            value[at:at + 3] = bytes(update["rgb8"])
        return bytes(value)

    def add(slice_id, name, value, chromatic=False, silence=False, zero=False, permute=False, origin=None):
        value = bytes(value)
        assert len(value) == samples * 6
        identity = digest(value)
        filename = f"inputs/{identity}.rgb"
        path = output / filename
        if path.exists():
            assert path.read_bytes() == value
        else:
            path.write_bytes(value)
        packs[slice_id]["conditions"].append(dict(name=name, rgbPath=filename, rgbSha256=identity,
            chromatic=chromatic, silenceInputs=silence, zeroCurrent=zero, permuteRows=permute,
            origin=origin or {"kind": "declared RGB8 adapter-seam fixture"}))
        return name

    for name, source in [("dark", "black"), ("gray64", "gray 64"), ("gray128", "gray 128"), ("white", "white")]:
        add("08", name, rgb(by_name[source]))
    positions = [("Lupper", "L", 163), ("Llower", "L", 562), ("Rupper", "R", 170), ("Rlower", "R", 567)]
    for name, eye, sample in positions:
        image = rgb(dict(fillRgb8=[0, 0, 0], updates=[dict(eye=eye, sample=sample, rgb8=[128, 128, 128])]))
        add("08", name, image)
        add("08", name + "-permuted", image, permute=True)
    spatial = [["Lupper", "Rupper"], ["Llower", "Rlower"], ["Lupper", "Llower"], ["Rupper", "Rlower"]]
    packs["08"]["primaryContrasts"] = [["gray64", "dark"], ["gray128", "gray64"], ["white", "gray128"], *spatial]
    packs["08"]["dosePairs"] = [dict(a=a, b=b, scope="total") for a, b in spatial]
    add("08", "dark-repeat", rgb(by_name["black"]))
    add("08", "white-zero", rgb(by_name["white"]), zero=True)
    add("08", "dark-silenced", rgb(by_name["black"]), silence=True)
    add("08", "white-silenced", rgb(by_name["white"]), silence=True)
    packs["08"]["exactPairs"] = [["dark", "dark-repeat"], ["dark", "white-zero"], ["dark-silenced", "white-silenced"]]
    optical = load(optics, "provided real-world pose captures")
    for capture in optical["fixtures"]:
        value = bytes(capture["samples"])
        assert digest(value) == capture["samplesHash"]
        add("08", "scene-" + capture["name"], value, chromatic=True,
            origin=dict(kind="supplied browser RGB; descriptive pose condition", pose=capture["pose"],
                        sceneId=capture["sceneId"], source=optics.name))
    quality = load(benchmark, "slice02 higher-resolution benchmark")
    profile = next(p for p in quality["profiles"] if p["ready"]["profile"]["width"] == 128 and p["ready"]["profile"]["radius"] == 15)
    for capture in profile["quality"]:
        add("08", "quality-" + capture["name"], capture["samples"], chromatic=True,
            origin=dict(kind="supplied browser RGB; descriptive quality condition", pose=capture["pose"], source=benchmark.name))
    if occlusion:
        controlled = load(occlusion, "fixed-pose open/blocked RGB capture")
        profile = next(p for p in controlled["profiles"] if p["ready"]["profile"]["width"] == 128 and p["ready"]["profile"]["radius"] == 15)
        for pair in profile["occlusion"]:
            for side in ["open", "blocked"]:
                add("08", f"occlusion-{pair['name']}-{side}", pair[side + "Samples"],
                    origin=dict(kind="fixed-pose physical occlusion", pose=pair["pose"], sceneId=pair[side + "SceneId"], source=occlusion.name))
            packs["08"]["primaryContrasts"].append([f"occlusion-{pair['name']}-open", f"occlusion-{pair['name']}-blocked"])

    for scale in [1, 2]:
        images = []
        for source in ["supported-color-pair", "supported-color-pair-swapped"]:
            case = by_name[source]
            image = rgb(dict(fillRgb8=case["fillRgb8"], updates=[dict(update, rgb8=[byte * scale for byte in update["rgb8"]]) for update in case["updates"]]))
            images.append(image)
        a, b = f"color-{scale}-a", f"color-{scale}-b"
        for name, image in zip([a, b], images):
            add("09", name, image, chromatic=True)
            add("09", name + "-off", image)
            add("09", name + "-silenced", image, chromatic=True, silence=True)
            add("09", name + "-permuted", image, chromatic=True, permute=True)
        add("09", a + "-repeat", images[0], chromatic=True)
        gray = rgb(dict(fillRgb8=[0, 0, 0], updates=[dict(update, rgb8=[100 * scale] * 3) for update in by_name["supported-color-pair"]["updates"]]))
        add("09", f"color-{scale}-gray", gray, chromatic=True)
        for side, color in [("a", [100, 100, 100]), ("b", [35, 117, 123])]:
            add("09", f"uniform-color-{scale}-{side}", [byte * scale for byte in color] * (2 * samples), chromatic=True)
        packs["09"]["primaryContrasts"].append([a, b])
        packs["09"]["exactPairs"] += [[a, a + "-repeat"], [a + "-silenced", b + "-silenced"]]
        packs["09"]["chromaticOffPairs"].append([a + "-off", b + "-off"])
        packs["09"]["dosePairs"].append(dict(a=a, b=b, scope="eyeChannel", equalBrightness=True))
    for slice_id, pack in packs.items():
        pack["sources"] = bindings + [dict(label="slice05 frozen current fixtures", sha256=digest((map_dir / "current-fixtures.json").read_bytes()))]
        pack["analysisSha256"] = digest((root / "specs/done/retinal-vision/assets/08/analyze.py").read_bytes())
        pack["statisticsOwnerSha256"] = digest((root / "scripts/connectome/analyze_neural_vision.py").read_bytes())
        pack["preregistrationSha256"] = digest((root / f"specs/done/retinal-vision/assets/{slice_id}/preregistration.md").read_bytes())
        pack["scope"] = "Fixed RGB8 native diagnostics; not a browser pose-to-tick or navigation proof."
        (output / f"inputs-{slice_id}.json").write_text(json.dumps(pack, sort_keys=True, indent=2) + "\n")
    return packs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("optics", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--occlusion", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[4]
    prepare(root, args.optics, root / "specs/done/retinal-vision/assets/02/higher-resolution/benchmark.json", args.output, args.occlusion)
