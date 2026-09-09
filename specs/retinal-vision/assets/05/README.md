# Provisional retinal map

This is an offline registration and adapter oracle, not a published runtime map or a completed neural proof. It uses the frozen slice 04 color model and a 128×128, radius-15 optical snapshot (721 RGB8 samples per eye). Final optical profile selection requires regeneration and downstream verification.

One registration belongs to each eye. Its bounds use every finite full-source Tm2/Tm20 coordinate, including neurons absent from the retained graph. Both families therefore map identical columns to identical locations. The source embedding is `(h1+h2/2, sqrt(3)*h2/2)`, centered on its Cartesian bounds and scaled isotropically into the sample hexagon. Left horizontal mirroring and source-positive Y mapping upward are modeling conventions; anatomical visual-field calibration remains unresolved. No selected-subset stretching or motor-outcome fitting occurs.

Each eligible neuron has at most three local barycentric taps. Positive support is shown separately from full-source locations missing from the retained graph and locations outside all mapped source support. Sparse coverage is real evidence: the modeled full-source cloud occupies a diagonal band. It does not justify filling gaps or changing orientation to improve behavior.

The inherited Tm2 weight budget is divided equally between the frozen Tm2 brightness and Tm20 blue-proxy channels. Each family normalizes supported columns across both eyes, then one common scale keeps every neuron’s weight sum at most one. The resulting combined weight is 220, below the inherited 245.75302425522457. Uniform white at gain 3 totals 440 current versus 491.50604851044915 for the baseline. This is an algorithmic bound, not physiological calibration.

For each sample, decode linear RGB8, apply the frozen coefficient row, then apply `q/(q+0.5)` **before** the weighted spatial sum. Gain remains in `[0,3]`; black contributes zero. The exact-isoluminant supported color pair and its spatial swap preserve each eye/channel’s aggregate current while changing chromatic location. These fixtures establish adapter behavior only; they do not establish downstream spikes or motor discrimination.

`retinal-map.json` supplies sparse native indices, body identity, eye, channel and taps. Channel order is Tm2 then Tm20; input order is eye L then R, sample order from the profile, RGB per sample. `current-fixtures.json` supplies uniform patches and sparse updates with expected currents in map-entry order. `audit.json` retains eligibility decisions, source paths, registration coordinates, raw taps and coverage. `registration-atlas.svg` displays all samples without hiding holes.

Semantic identities use SHA-256 of sorted-key compact JSON followed by a newline. The canonical companion files provide exact bytes for cross-language verification. Preserve the exporter’s compact subobject bytes: the native importer hashes those exact bytes plus a newline, so pretty-printing the map invalidates its binding. The profile bundle also carries the source’s canonical JavaScript rig bytes, whose hash and parsed transforms are independently checked. Profile identity includes optics, layout, eye rig identity, photometry and explicit optical-model version. Source-file hashes are provenance, so comment-only changes do not invalidate the semantic map. The exporter never changes the graph binary or published manifest.

Reproduce from the repository root, using the Python environment with NumPy, pandas and SciPy:

```sh
PYTHONPATH=scripts python -m connectome.vision_map \
  --annotations data/raw/body-annotations.feather \
  --profile specs/retinal-vision/assets/05/provisional-profile.json \
  --color-model specs/retinal-vision/assets/04/color-model.json \
  --output /tmp/retinal-map
python -m unittest discover -s tests/connectome
```

To create a new provisional optical snapshot from a compatible capture owner, run `bun specs/retinal-vision/assets/05/export-profile.mjs SOURCE_ROOT OUTPUT.json`. The exporter and browser binding check now share the semantic profile owner. A new snapshot requires regenerating the map and repeating its gates; it must not silently replace the frozen evidence here.

## Integration binding

The selected optics match this frozen semantic map exactly. The reviewed map is published separately under `data/processed/brain/retinal-map.json`; build preparation validates the installed profile and graph identity, copies the map without reserialization, and generates the eye-panel identity artifact. Native remains the full map/hash/budget validator. The optical-model identifier retains its original provisional name so the frozen identity does not change merely for a label. This is bounded registration acceptance, not a positive downstream-neural verdict.
