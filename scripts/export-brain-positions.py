"""Export measured MaleCNS soma locations in graph-index order for the brain viewer.

Missing locations are omitted. Centring and uniform scaling preserve geometry;
no anatomical coordinates or activity are synthesized.
Run from the repository root after data:prepare.
"""
import json
from pathlib import Path

import numpy as np
import pyarrow.feather as feather

manifest = json.loads(Path("data/processed/brain/manifest.json").read_text())
annotations = feather.read_feather(
    "data/raw/body-annotations.feather", columns=["bodyId", "somaLocation"]
).set_index("bodyId")
rows = []
for index, body_id in enumerate(manifest["bodyIds"]):
    if int(body_id) not in annotations.index:
        continue
    position = annotations.loc[int(body_id), "somaLocation"]
    if position is not None and len(position) == 3 and np.isfinite(position).all():
        rows.append((index, *map(float, position)))

values = np.array(rows)
low = values[:, 1:].min(axis=0)
high = values[:, 1:].max(axis=0)
values[:, 1:] = (values[:, 1:] - (low + high) / 2) / max(high - low) * 2
artifact = {
    "dataset": manifest["dataset"],
    "graphHash": manifest["graphHash"],
    "selectedCount": len(manifest["bodyIds"]),
    "measuredCount": len(rows),
    "positions": [[int(row[0]), *np.round(row[1:], 5).tolist()] for row in values],
}
Path("apps/web/src/brain-positions.json").write_text(
    json.dumps(artifact, separators=(",", ":")) + "\n"
)
