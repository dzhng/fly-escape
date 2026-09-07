# Yellow selection circle contrast

The selected fly should remain easy to locate on yellow fruit using a simple
yellow circle. A narrow dark outer edge improves that circle's contrast while
preserving its yellow interior, geometry, world depth test and camera sizing.
The same material shades both bands in one existing draw; no overlay, selection
box, extra mesh, physical clearance or fruit-material adjustment is introduced.
Ring UVs retain their original radial band when the camera adjusts mesh width.

The exact stored banana input and production player generated both capture sets
at tick 53, with identical viewport and camera operations. Context, extra-close,
normal feeding and departure frames change respectively 123, 2291, 763 and 759
pixels. Every changed pixel falls inside the marker crop; all pixels outside
those crops are identical. Metrics locate the change, not its aesthetic merit.
The existing meal-playback harness also verifies byte-identical canvas restoration
through reverse seek. Renderer tests pass (49), and repository typecheck passes.

Independent image review accepts the final version: the circle stays visible on
the banana and reads as one marker. Minor stair-stepping remains in the enlarged
wide-context crop, without blocking full-frame readability. No new fly occlusion
or viewport clipping was observed. The marker remains visible through translucent
wings. The first two-edge candidate improved contrast but read as a double dark
outline; its failed image and crop are retained.

The circle is still planar and aligned to the body. This contrast correction does
not prove surface conformance, precise foot planting, mouth contact or the slice
20 visual-error target. Those remain separate acceptance questions.

## Choices audit

- Keep the original yellow and add an outer contrast edge: follows the requested
  simple circle; changing the entire marker to brown would lose its yellow identity.
- Use the outer 30% of the existing ring band for its dark edge: a presentation
  judgment accepted by independent full-frame/crop review. It adds no footprint.
- Shade within the existing material using derivative antialiasing: preserves
  resource ownership and world occlusion, with no added draw call or dependency.
- Retain original UV band coordinates during camera width updates: makes the
  edge track that same width rather than introducing a second sizing owner.
- Reject the double-edge candidate after review: the clearer single edge meets
  the requested visual language with less visual structure.

Source shape/diff review found no new resource lifetime or contact owner. Local
Codex CLI review could not run: the configured model requires a newer CLI. No
upgrade or model substitution was made; direct code review and independent visual
review cover this pass.
