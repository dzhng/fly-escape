# Directional light through the neural circuit

Objective 3 connects the recorded eight-direction light sample to the existing MaleCNS neural simulation. Biological annotations establish cell identity and retained connectivity; they do not establish a fly's response to modeled current. Direction, intensity and occlusion must affect downstream activity, and silencing the injected cells must remove the stimulus-dependent effect. Attraction is not an acceptance requirement.

## Next Agent Prompt

Start [the mapping audit](slices/01-input-map.md), then implement [the graded adapter and experiments](slices/02-causal-response.md). No production changes have begun. Do not specify the lighting puzzle until this objective is verified and archived. Preserve the user's new panel order: graphs directly below the brain, compact roster. Update this handoff after each committed pass.

- [ ] Audit annotations and actual retained paths; freeze two bounded candidate maps.
- [ ] Implement one graded map adapter, run bounded pilot, freeze the winner and held-out protocol.
- [ ] Pass paired neural/optical silencing and closed-loop response gates.
- [ ] Verify actual worker/playback, resource cost, tests and independent review.
- [ ] Consolidate choices and close-spec.

## Research and synthesis

The [official downloads](https://male-cns.janelia.org/download/) distinguish v1.0 curated annotations, transmitter predictions and full connection weights. The [MaleCNS Cell Type Explorer](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/) identifies its dataset as male-cns:v1.0. Its [help](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage) describes hexagonal optic-lobe columns, not a calibrated world-angle transform. Soma side is anatomical laterality, not a receptive-field direction. The [anterior visual pathway study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11446847/) is candidate context, not permission to import FlyWire body IDs or retinal mappings.

Actual reconnaissance: 211,577 annotation rows; selected graph 70,000 neurons and 798,715 signed edges. Extraction admits seed-touching edges only. Current AOTU groups have 122/128 cells and no assignedOlHex coordinates. Retinal R1–R8 cells are absent. However, selected hex-assigned Tm2 has 128 left/238 right cells and Tm20 284 left/526 right. Their retained outgoing edges lead to visual LC/LPLC populations without directly targeting DN/MN cells. The first slice turns these findings into reproducible evidence and checks actual reachability rather than treating selection as an intact circuit.

Three independent drafts informed this plan. Fewest-slices proposed audit then causal validation; seam-quality found the retained Tm populations and correctly rejected arbitrary eight-way AOTU splits. The Claude risk-first draft emphasized annotation verification and production body gains. Its optional graded adapter, reliance on an older slowed-body experiment and suggested blocked-light injection are rejected: brightness must be graded, old behavior is not acceptance, and invisible light must not drive input. Keep two slices, one graph and one adapter. Graph expansion is not justified while existing spatial visual cells remain untested.

## Ownership and firewalls

- `scripts/connectome` owns the reproducible annotation-to-input-map export and provenance; `Graph` validates/resolves it once. Reuse the existing graph manifest, not a second runtime file/service/cache.
- `sensory.rs` owns actual brightness-to-current conversion. `Brain`, neural parameters, signed circuit weights and body decoding stay unchanged. `FieldSet` and schema-5 records retain the objective-2 contract.
- No input can target any motor readout, use exit direction, odor, blocked-light telemetry, renderer state or player-camera data. All eight brightness bins have a nonempty declared route.
- Coordinate-to-angle registration, positive brightness current, normalization and temporal units are explicit modeling assumptions. Do not claim retinal reconstruction, living-fly firing rates or universal attraction.
- Preserve 16 flies, 2/5/10 stars, 128 MiB archive cap, existing saved arrangements and About. Existing campaign rooms keep their cue configuration; only a diagnostic run enables vision here. The later puzzle gets its own evidence-led content spec.
- No graph binary rebuild, new neural groups beyond the existing 16, eight per-fly cameras, ON/OFF filtering, learning, or unbounded gain/seed search. If both bounded candidates fail, reslice the evidenced missing mechanism before further changes; never replace it with steering.

Every produced browser capture receives independent screenshot-critique; compare-screenshots judges any changed visual surface against the objective-2 and selected-panel layout references. Human review stays nonblocking. Review shape, diff, documentation and choices before each commit; closeout audits claims against the actual artifacts.
