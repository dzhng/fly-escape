Read all 9 PNGs. Verdict: **pass, no new blocking defects** — cosmetic limitations only.

**Checklist results**

| Check | Result |
|---|---|
| Title/instructions legible | Pass. `panel-crop.png` confirms dark-green on cream, clean serif title, 4-line instruction with no clipping or overlap. |
| Palette controls not overlapping | Pass. 2-col grid, uniform gutters, no collisions at 5 items (setup/valid/invalid) or 7 items (second/rotated). Selected state (Apple, Fan) reads clearly via gold fill + border. |
| House fits beside overlay @1440 | Pass. `setup.png`/`valid.png`: house right edge ~x=995, panel left ~x=1143 — ~150px clear. `rotated.png` is the widest footprint (~x=1045) and still clears. |
| House fits beside overlay @900 | Pass but tight. `compact.png`: house right edge ~x=590 vs panel left ~x=603 — roughly a 13px gap, no overlap or clipping. Level tabs wrap stars to a second line, still non-overlapping. |
| Invalid preview red visible in crop | Pass. `invalid-crop.png` shows a distinctly red fly silhouette against grass; hue separation from green is unambiguous. |
| Golden haze does not hide house | Pass. Walls, floor planks, furniture, and window/door geometry stay readable in all four setup shots. |

**Player-requested items confirmed present:** fullscreen overlays with no page header (all shots), real star glyphs in level tabs including one earned gold star in `rotated.png`/`second.png`, and 16 flies in `playback.png` ("16 active" + a full 16-card roster).

**Cosmetic limitations (not blocking)**
- `invalid.png` at full scale: the red invalid marker sits at ~(43, 438), far left of the cursor-free frame and only a few px across — legible in crop, easy to miss at 1:1.
- `second.png` haze is noticeably warmer/more washed than `setup.png`; contrast on the far bedroom floor drops but nothing is obscured.
- `playback.png`: the neural panel's caption is cut mid-sentence at the viewport bottom, and "About the data and models" sits directly beneath the panel edge with minimal breathing room. Both fall under the allowed scrollable-panel behaviour.
- `compact.png`'s 13px house-to-panel gap has no margin left; any further increase to panel width or house footprint at 900 would start overlapping.
