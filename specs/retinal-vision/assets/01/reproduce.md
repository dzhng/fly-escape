# Reference optics reproduction

This runs the **unmodified pinned FlyGym Retina sampler** on generated asymmetric RGB camera fixtures. It reproduces fisheye remapping, original ommatidial pooling and display reconstruction. It does **not** reproduce the fly-api MuJoCo simulation, camera rasterization, articulated pose, or visual pursuit. This narrower experiment is explicitly allowed by slice 01; the next optical stage must still test real renderer handedness.

## Run from a fresh temporary environment

Requires `uv` and network access for the pinned sources and Python wheels. From the repository root:

```sh
uv python install 3.11.16
uv venv --python 3.11.16 /tmp/flygym-reference-env
uv pip install --python /tmp/flygym-reference-env/bin/python -r specs/retinal-vision/assets/01/requirements.txt
NUMBA_NUM_THREADS=1 /tmp/flygym-reference-env/bin/python specs/retinal-vision/assets/01/reproduce.py --cache /tmp/flygym-reference-sources --out /tmp/flygym-reference-output
```

The script downloads only the named source, configuration, layout and license files into the temporary cache. Committed SHA-256 identities reject changed input bytes. An existing cache can be reused; a new output directory reproduces all evidence. Neither product dependencies nor the product virtual environment change. `reproduce.py` generates the inputs, so there are no hidden source images or external video files needed to repeat the test. The two package-discovery functions are supplied locally to avoid importing FlyGym's unrelated physics stack; no sampler method is rewritten or mocked, and Numba executes the original functions.

The initial host Python was 3.14.6, which did not fit the pinned Numba recipe; that bounded installation attempt was stopped and the isolated Python 3.11 recipe above used. A full FlyGym checkout was also stopped before completion to avoid fetching unrelated asset history. The full native driver and its OSMesa setup were not installed or run. This is an intentional bounded original-sampler invocation, not a report of a MuJoCo runtime failure.

## What the evidence means

[reference-profile.json](reference-profile.json) freezes source geometry, units, channel policy and layout provenance. [correspondence.json](correspondence.json) records all landmark bounds, transformed centroids and touched sample IDs, plus assertions for motion, up/down, left/right within an image and source-to-sample pooling. [source-manifest.json](source-manifest.json) is the exact source-byte ledger. The binary sample archive retains actual floating-point outputs; the center table maps original one-based sample IDs to image rows/columns.

[The contact sheet](contact-sheet.png) separates raw RGB fixtures, the original corrected camera images, and original sampled mosaics for both eyes at two times. Numbers on all contact-sheet panels are correspondence annotation overlays only; the standalone raw inputs and sampler inputs are unannotated. The retinal visualization maps output channel 0 to display green and channel 1 to blue, with red zero. It is **false color**, not an RGB image of the scene. The disappearance of the pure-red patch and the loss of yellow's red component are expected reference behavior. The final feature must retain RGB and must not silently adopt this approximation.

The original has one active channel in each sample: yellow-type cells pool input green, pale-type cells pool input blue. There is no red response or spectral/UV reconstruction. Even when neighboring cells see a uniformly green patch, alternate pale cells can look dark. These spots are channel selection, not missing pixels. White outside the retinal lattice is the original `color_8bit=True` display background; black exterior in the corrected raster comes from out-of-bounds remapping.

The independent pooling oracle uses NumPy per-ID weighted sums, then the reference mask selection. Its floating-point values agree within 6e-15. Display differences are at most one 8-bit level: the original truncates floating-point values, and different accumulation orders can straddle an integer boundary. The amplified per-frame oracle-diff images and JSON measurements retain this difference rather than hiding it. This comparison tests pooling and channels against a simple independent implementation; it is not a comparison with an original MuJoCo capture. Geometry evidence is source-derived: the camera rotation determinant, optical forward direction and up vector are checked, but articulated pose and renderer row direction require real render tests later. Fisheye retains array row direction; the fixture proves upper and lower landmarks stay ordered through its sampled image.

The native basis conversion is a proper cyclic permutation, followed by the full native quaternion. Source positions use millimetres; translated positions use metres. These are neutral source offsets relative to the thorax, **not final camera placements on our asset**. The original camera's nearly symmetric Euler angles retain their source rounding; do not replace them with idealized angles and claim an exact replication. The original 721-cell ID order is preserved in the center table; the product's 61-cell axial layout remains a separate declared quality profile.

## Provenance and licenses

| Material used | Pinned source | License / treatment |
| --- | --- | --- |
| Retina sampler, configuration, ommatidial ID map, pale mask, source eye hierarchy | [FlyGym](https://github.com/NeLy-EPFL/flygym/tree/c7affce924cb1c6add16619adf83be5c6b223e89) | [Apache-2.0](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/LICENSE); fetched original files remain in temporary cache. Generated mosaics and center coordinates derive from this layout; the [license copy](LICENSE-FlyGym.txt) accompanies them. Attribution: FlyGym contributors, NeLy-EPFL. No meshes copied. |
| Fisheye method's upstream attribution | Retina's method docstring identifies Gil-Mor/iFish | [MIT](https://github.com/Gil-Mor/iFish); retained original FlyGym source includes this attribution. No separate iFish code fetched or copied. |
| Demo/controller source inspection | [fly-api](https://github.com/dtch1997/fly-api/tree/a6ad07a810b1a43cd0356149c07b32105eb46d2a) | [MIT](https://github.com/dtch1997/fly-api/blob/a6ad07a810b1a43cd0356149c07b32105eb46d2a/LICENSE); inspected only, no controller imported into product. |
| Camera fixtures, harness and contact-sheet composition | Authored for this experiment | Project-owned original content; input colors are synthetic RGB, not measured fly spectra. |

Source ownership map: FlyGym `config.yaml` owns camera settings and mask paths; `fly.py::_configure_eyes` attaches the cameras and `_update_vision` orders L/R capture → fisheye → pool. `vision/retina.py` owns the actual transformations. The pinned MJCF owns neutral eye/head translation and extrinsic XYZ convention. fly-api `demo/svt_taxis.py::_process_visual_observation` thresholds the maximum retinal channel, finds the mean positions of dark samples and normalizes their area. Its `calc_ipsilateral_speed` clips a speed computed from deviation; `track_b_embodied.py` runs that controller. This is hand-written centroid steering, not demonstrated neural retinal processing.
