"""Render every frozen input and prespecified response contrast; no simulation or endpoint selection."""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
import numpy as np

ROOT = Path(__file__).resolve().parents[4]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False, "axes.spines.right": False})


def read_json(path):
    data = path.read_bytes()
    decoded = gzip.decompress(data) if path.suffix == ".gz" else data
    return json.loads(decoded), hashlib.sha256(decoded).hexdigest()


def render(report_path, analysis_path, output, input_root=None):
    report, report_hash = read_json(report_path)
    analysis, analysis_hash = read_json(analysis_path)
    assert analysis["reportSha256"] == report_hash and analysis["freezeHash"] == report["freezeHash"]
    frozen = report["frozen"]
    ticks, dt = frozen["measuredTicks"], frozen["lifParams"]["dt"]
    window = f"{ticks} neural steps at dt={dt:g} = {ticks * dt:g} model-time units"
    timing = f"Window: {window}; after {frozen['warmupTicks']} warmup steps. No physical-time calibration claimed."
    require_hash = lambda raw, expected: hashlib.sha256(raw).hexdigest() == expected
    map_bytes = (ROOT / "specs/retinal-vision/assets/05/retinal-map.json").read_bytes()
    assert require_hash(map_bytes, frozen["identities"]["mapHash"])
    cells = json.loads(map_bytes)["profile"]["layout"]["cells"]
    centres = np.asarray([[cell["x"], cell["y"]] for cell in cells])
    angles = np.arange(6) * np.pi / 3 + np.pi / 6
    vertices = centres[:, None, :] + .56 * np.stack([np.cos(angles), np.sin(angles)], axis=1)[None, :, :]
    specifications = frozen["pack"]["conditions"]
    if frozen["pack"]["version"] == 2 and input_root is None:
        raise ValueError("Version-2 figures require --input-root pointing to the frozen prepared pack")
    rgb_root = input_root or ROOT / "specs/retinal-vision/assets/08"
    proposal = None
    if frozen["pack"]["version"] == 2:
        binding = frozen["pack"]["reslice"]["proposal"]
        raw = (rgb_root / binding["path"]).read_bytes()
        assert require_hash(raw, binding["sha256"])
        proposal = json.loads(raw)
    output.mkdir(parents=True, exist_ok=True)
    paths = []

    def image(spec):
        raw = (rgb_root / spec["rgbPath"]).read_bytes()
        assert require_hash(raw, spec["rgbSha256"])
        linear = np.frombuffer(raw, dtype=np.uint8).reshape(2, len(cells), 3) / 255.
        return np.where(linear <= .0031308, 12.92 * linear, 1.055 * linear ** (1 / 2.4) - .055)

    def eye(ax, rgb, label):
        ax.add_collection(PolyCollection(vertices, facecolors=rgb, edgecolors="#444444", linewidths=.08))
        ax.set_xlim(-16, 16)
        ax.set_ylim(14.5, -14.5)
        ax.set_aspect("equal")
        ax.set_title(label, fontsize=8, pad=2)
        ax.axis("off")

    input_pages = [specifications[offset:offset + 8] for offset in range(0, len(specifications), 8)]
    if frozen["slice"] == "08":
        # Keep each opening/blocker comparison adjacent on the final page.
        last = input_pages[-1]
        last.insert(3, None)
    for page, group in enumerate(input_pages, start=1):
        fig = plt.figure(figsize=(14, 6.8), layout="constrained")
        grid = fig.add_gridspec(2, 4)
        for j, spec in enumerate(group):
            if spec is None: continue
            sub = grid[j // 4, j % 4].subgridspec(2, 2, height_ratios=[.24, 1])
            title = fig.add_subplot(sub[0, :]); title.axis("off")
            flags = "full RGB adapter" if spec["chromatic"] else "Tm20 off"
            if spec["silenceInputs"]: flags += ", inputs silenced"
            if spec["zeroCurrent"]: flags += ", zero current"
            if spec["permuteRows"]: flags += ", row permutation"
            title.text(.5, .65, spec["name"], ha="center", va="center", fontsize=9, weight="bold")
            title.text(.5, .05, flags, ha="center", va="center", fontsize=7)
            colors = image(spec)
            for side in range(2): eye(fig.add_subplot(sub[1, side]), colors[side], ["Left eye", "Right eye"][side])
        fig.suptitle(f"Slice {frozen['slice']} — {frozen['phase']} inputs, page {page}\nExact linear RGB8 displayed through sRGB transfer; each hex is one sample. Image axes: right/down.\nFlags describe adapter or silencing controls applied after the stored RGB8.", fontsize=12)
        path = output / f"inputs-{page:02}.png"; fig.savefig(path, dpi=150); paths.append(path.name); plt.close(fig)

    contrasts = analysis["contrasts"]
    by_name = {c["name"]: c for c in report["conditions"]}
    fig = plt.figure(figsize=(18, 4.2 * len(contrasts)), layout="constrained")
    grid = fig.add_gridspec(len(contrasts), 3)
    axes = []
    for row, contrast in enumerate(contrasts):
        current_ax = fig.add_subplot(grid[row, 0])
        row_axes = [current_ax]
        axes.append(row_axes)
        a, b = by_name[contrast["a"]], by_name[contrast["b"]]
        current_difference = np.asarray(a["effectiveCurrentByEntry"]) - np.asarray(b["effectiveCurrentByEntry"])
        current_ax.scatter(np.arange(len(current_difference)), current_difference,
                           c=np.where(np.asarray(frozen["currentEntryChannels"]) == 0, "#555555", "#297699"), s=5)
        current_ax.axhline(0, color="#404040", linewidth=.7)
        current_ax.set_title(f"{contrast['a']} − {contrast['b']}\nTotal dose A/B: {a['effective']['total']:.5g} / {b['effective']['total']:.5g}\nTm2 gray; Tm20 blue", fontsize=9)
        current_ax.set_xlabel("Frozen injected-entry order (all 1,176 cells)")
        current_ax.set_ylabel("Injected Δ current (model units)")
        current_ax.grid(axis="y", alpha=.2)
        for col, (field, ylabel) in enumerate([("cells", "Mean Δ voltage (model units)"), ("spikeCells", f"Δ spikes / {ticks}-step window")]):
            neural_grid = grid[row, col + 1].subgridspec(2, 1, height_ratios=[2, 1])
            ax = fig.add_subplot(neural_grid[0])
            detail = fig.add_subplot(neural_grid[1])
            row_axes.extend([ax, detail])
            data = contrast[field]
            means = np.asarray([cell["mean"] for cell in data])
            intervals = np.asarray([cell["interval"] for cell in data])
            ax.vlines(np.arange(len(data)), intervals[:, 0], intervals[:, 1], colors="#92a4b0", linewidth=.6)
            accepted = np.asarray([cell.get("responseAboveFloor", cell["significant"]) for cell in data])
            ax.scatter(np.arange(len(data)), means, c=np.where(accepted, "#ae4c15", "#17617a"), s=7, zorder=3)
            ax.axhline(0, color="#404040", linewidth=.7)
            ax.set_xlim(-5, len(data) + 5)
            ax.set_title(f"{contrast['a']} − {contrast['b']}\n{int(accepted.sum())}/{len(data)} corrected endpoints", fontsize=9)
            ax.set_xlabel("Frozen endpoint order (all 438 native indices)")
            ax.set_ylabel(ylabel)
            ax.grid(axis="y", alpha=.2)
            ax.text(.01, .98, "95% simultaneous CI; orange = significant after multiplicity correction", transform=ax.transAxes, va="top", fontsize=5.5)
            passing = np.flatnonzero(accepted)
            if len(passing):
                detail.errorbar(np.arange(len(passing)), means[passing],
                    yerr=np.stack([means[passing] - intervals[passing, 0], intervals[passing, 1] - means[passing]]),
                    fmt="o", color="#ae4c15", markersize=3, linewidth=.7)
                detail.set_xticks(np.arange(len(passing)), passing, fontsize=7, rotation=45 if len(passing) > 5 else 0)
                detail.tick_params(axis="y", labelsize=7)
                detail.set_title("Corrected endpoints only — separate y scale; same 95% intervals", fontsize=8, pad=4)
                detail.set_ylabel("Δ voltage (model units)" if field == "cells" else f"Δ spikes / {ticks}-step window", fontsize=8)
                detail.set_xlabel("Frozen endpoint order", fontsize=8)
                detail.grid(axis="y", alpha=.2)
            else:
                detail.axis("off")
                detail.text(.5, .5, "No corrected endpoints to enlarge", ha="center", va="center", fontsize=8)
    fig.suptitle(f"Slice {frozen['slice']} — {frozen['phase']}, all preregistered contrasts\nCurrent: Tm2 gray, Tm20 blue. Neural means with simultaneous 95% intervals; orange marks corrected responses. All injected/motor cells excluded from neural endpoints.\n{timing} Endpoint means/intervals compare {len(analysis['seeds'])} paired seed windows.", fontsize=11)
    path = output / "responses.png"; fig.savefig(path, dpi=150); paths.append(path.name)
    fig.canvas.draw()
    # Per-row crops retain every endpoint/interval at readable scale, including failed contrasts.
    from PIL import Image
    full = Image.open(path)
    width, height = full.size
    for row in range(len(contrasts)):
        boxes = [ax.get_tightbbox(fig.canvas.get_renderer()).transformed(fig.dpi_scale_trans.inverted()) for ax in axes[row]]
        bottom = min(box.y0 for box in boxes); top = max(box.y1 for box in boxes)
        crop = full.crop((0, max(0, height - math.ceil(top * 150) - 8), width, min(height, height - math.floor(bottom * 150) + 8)))
        from PIL import ImageDraw
        labeled = Image.new("RGB", (crop.width, crop.height + 40), "white")
        labeled.paste(crop, (0, 0))
        ImageDraw.Draw(labeled).text((12, crop.height + 10), f"{timing} Means / simultaneous CIs across {len(analysis['seeds'])} paired seed windows.", fill="black", font_size=17)
        name = f"response-{row + 1:02}-crop.png"; labeled.save(output / name); paths.append(name)
    plt.close(fig)

    fig, axes = plt.subplots(len(contrasts), 1, figsize=(12, 1.8 * len(contrasts)), squeeze=False, layout="constrained")
    for row, contrast in enumerate(contrasts):
        ax = axes[row, 0]
        differences = contrast["downstreamSpikeDifferences"]
        ax.bar(range(len(differences)), differences, color="#247482")
        ax.axhline(0, color="#333333", linewidth=.7)
        if min(differences) < 0 < max(differences):
            ax.set_yticks([min(differences), 0, max(differences)])
        ax.set_xticks(range(len(differences)), analysis["seeds"], fontsize=7)
        ax.set_title(f"{contrast['a']} − {contrast['b']}: {contrast['downstreamCellCountWithDifferentAggregatedSpikes']} cells differ in counts summed across all seeds", fontsize=9)
        ax.set_ylabel("Δ spikes")
    axes[-1, 0].set_xlabel("Prespecified paired seed")
    fig.suptitle(f"All 40,944 reachable non-input/non-motor neurons — descriptive spike totals\nSlice {frozen['slice']} {frozen['phase']}; Rows use independent y scales; signed differences do not replace corrected endpoint tests.\nEach bar sums 40,944 cells for ONE paired seed.\n{timing}", fontsize=10)
    path = output / "downstream-counts.png"; fig.savefig(path, dpi=150); paths.append(path.name); plt.close(fig)

    if frozen["slice"] == "09":
        pairs = [s for s in specifications if s["name"] in ["color-1-a", "color-1-b", "color-2-a", "color-2-b"]]
        fig, axes = plt.subplots(4, 2, figsize=(10, 14), layout="constrained")
        for row, spec in enumerate(pairs):
            colors = image(spec)
            for side in range(2): eye(axes[row, side], colors[side], spec["name"] + " / " + ["Left", "Right"][side])
        if proposal:
            level = proposal["colorSearch"]["levels"][0]
            caption = f"color-1 lower context: A={level['a']}, B={level['b']}; color-2 adds 100 to R/G, holding blue fixed.\nPattern a: upper=A / lower=B; pattern b: upper=B / lower=A in both eyes."
        else:
            caption = "A=[100,100,100], B=[35,117,123]; second level doubles each byte."
        fig.suptitle("Exact matched-dose color inputs — enlarged retinal samples\n" + caption + "\nColors shown after display transfer. Both eyes use image-right/down axes, without mirroring. Sample IDs: color-patch-crops.png.", fontsize=11)
        path = output / "color-inputs-enlarged.png"; fig.savefig(path, dpi=150); paths.append(path.name); plt.close(fig)
    if frozen["slice"] == "09":
        selected = [s for s in specifications if s["name"] in ["color-1-a", "color-1-b", "color-2-a", "color-2-b"]]
        spots = [(0, 163), (0, 562), (1, 170), (1, 567)]
        fig, axes = plt.subplots(4, 4, figsize=(12, 12), layout="constrained")
        checks = []
        for row, spec in enumerate(selected):
            colors = image(spec)
            raw = np.frombuffer((rgb_root / spec["rgbPath"]).read_bytes(), dtype=np.uint8).reshape(2, len(cells), 3)
            for column, (side, sample) in enumerate(spots):
                ax = axes[row, column]
                eye(ax, colors[side], f"{spec['name']} / {['L','R'][side]}{sample}\nlinear RGB8 {raw[side,sample].tolist()}")
                x, y = centres[sample]; ax.set_xlim(x - 1.65, x + 1.65); ax.set_ylim(y + 1.65, y - 1.65)
                checks.append((ax, x, y, np.rint(colors[side, sample] * 255).astype(int).tolist()))
        context = "Central hex is the original anchor within a 32-sample supported patch; neighboring samples retain their supplied colors." if proposal else "Central hex is the supplied colored sample; surrounding black samples are retained for context."
        fig.suptitle("All four matched-color locations, both contexts and swaps — tight sample crops\n" + context + "\nL/R identify the eye; numbers are zero-based frozen layout sample indices. Image axes right/down; neither eye mirrored.", fontsize=11)
        path = output / "color-patch-crops.png"; fig.savefig(path, dpi=150); paths.append(path.name); fig.canvas.draw()
        pixels = np.asarray(Image.open(path).convert("RGB"))
        observations = []
        for ax, x, y, expected in checks:
            px, py = ax.transData.transform((x,y)) / fig.dpi * 150
            actual = pixels[pixels.shape[0] - 1 - round(py), round(px)].astype(int).tolist()
            error = max(abs(a-b) for a,b in zip(actual,expected))
            assert error <= 1, (actual, expected)
            observations.append(dict(expectedDisplayRgb8=expected, actualDisplayRgb8=actual, maximumError=error))
        (output / "patch-pixel-checks.json").write_text(json.dumps(observations, indent=2) + "\n")
        plt.close(fig)
    (output / "figures.json").write_text(json.dumps(dict(files=paths, report=report_path.name, analysis=analysis_path.name,
        reportSha256=report_hash, analysisSha256=analysis_hash, matplotlib=matplotlib.__version__, scope="Every frozen condition and primary contrast included; no plot changes experimental gates."), indent=2) + "\n")
    print(json.dumps(dict(figures=len(paths), output=str(output))))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path); parser.add_argument("analysis", type=Path); parser.add_argument("output", type=Path)
    parser.add_argument("--input-root", type=Path, help="Directory containing the exact RGB files referenced by the frozen pack")
    args = parser.parse_args(); render(args.report, args.analysis, args.output, args.input_root)
