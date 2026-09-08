Inspected all 10 PNGs. Findings below, ordered by severity. No files were modified.

## Functional obstruction

**1. Escaped flies render with no thumbnail in the roster grid — missing asset. (High confidence)**
`campaign/level-1-result.png`: tiles 07 and 12 are blank above their labels; every other tile has a fly image. `campaign/level-2-result.png`: tiles 01, 05, 08, 10, 14, 15 are blank. In both cases the blank tiles are exactly the ones labeled `Escaped`, and their count matches the HUD (2 escaped / 6 escaped). So the `Escaped` state has no icon variant, or resolves to a missing texture. This is the win state, so the most rewarding outcome is the one with a hole in it.

**2. The run camera renders broken geometry. (High confidence it's a defect; medium on cause)**
`campaign/level-1-result.png`: the viewport is a flat khaki field with horizontal streak banding, a hard diagonal seam, and stair-stepped green blocks along the lower left — reads as near-plane clipping through terrain plus depth/z-fight artifacts, not a scene. `campaign/level-2-result.png` shows the same flat tan plane with a jagged, aliased brown/green boundary at top and no house geometry at all. `campaign/level-1-selected.png` has the same class of problem more mildly: the upper-left third is an untextured dark-brown wedge, i.e. the camera is inside a wall.

**3. During a run the world is unreadable at the framed zoom. (High confidence)**
All four run screenshots frame a single fly against floorboards at macro scale. No walls, no rooms, no exit, no placed objects, no other flies in 3 of 4 shots — while the HUD says `20 active`. The player cannot see whether their object placement is working, which is the core feedback loop of the setup screen. Related: white leader lines to off-screen flies cross the entire viewport and terminate at nothing (`level-1-selected.png`, `level-1-result.png`), which adds visual noise without conveying position.

**4. The neural panel — the panel the copy promises — is below the fold. (High confidence)**
"These charts show each fly's neural activity" sits at the top, then a 20-tile picker consumes ~450px, pushing `Inside fly 02` to the viewport edge where it is cut off mid-graphic in all four run shots. At this window height you never see a chart without scrolling. The blob itself has no axes, legend, or scale.

**5. `Put objects away` is effectively unreadable. (High confidence)**
Pale grey underlined text on cream in all four setup/platform shots. Well below AA contrast, and it is a destructive action.

**6. `dead` is the wrong word for a timed round. (Medium-high)**
Both results read `0 active · N escaped · 0 zapped · 0 caught · 14–18 dead`. Campaign rounds are timed with no energy model, so flies that simply ran out the clock are being reported as dead. Either the label or the accounting is wrong; as shown, the player is told they killed 18 of 20 flies for a 1-star pass.

## Cosmetic refinement

- **Locked tab styling** (`level-1-setup`, both platform shots): `2. Turn the Corner · 0/3 stars · Locked` is low-contrast grey with no lock affordance and the same pill shape as the active tab; it reads as merely inactive. (High)
- **`Start` badge collision** (`level-2-setup.png`, ~x315,y605): the dark navy pill straddles a wall/doorway line with its dashed spawn square split across the boundary, so the spawn room is ambiguous. Level 1's badge is clean. (Medium)
- **Palette dark-navy `Start` badge** is the only cool-dark element in an otherwise warm palette; sticks out. (Medium, subjective)
- **Empty room** in `level-1-setup.png` (lower-right): no furniture at all, unlike every other room. (Medium — may be intentional)
- **Wall-mounted plant** in `level-1-setup.png` (~x440,y355) appears to sit on the wall top edge rather than the floor. (Low-medium — could be the intended shelf placement)
- **Roster grid orphan row**: 20 tiles in a 3-wide grid leaves 2 tiles and a gap. (High, trivial)
- **Selection ring** on fly 02 is thinner than the fly's wingspan and the white leader line is drawn over the fly body; the ring itself reads clearly, so this is polish, not occlusion. (High)

## Clean

- `about/desktop.png` and `about/mobile.png`: no defects found. Measure, hierarchy, and link contrast are good; mobile wraps without overflow or clipped links.
- `platforms/firefox.png` vs `platforms/webkit.png`: parity holds. The only delta is ~4–6px of vertical spacing in the right panel and title baseline from font metrics. No layout break, no missing geometry, both render the house identically.

The two things I'd fix before release are (1) and (3) — the missing escaped-fly icon and the run camera, since together they mean neither the simulation nor its successful outcome is visible.
