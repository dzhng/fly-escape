# Airborne selection

The user requested a yellow selection circle. The initial ground-only choice made its angled projection fall between other flies when the selected body was airborne. The circle now uses the selected body's presentation height while retaining its horizontal orientation, fixed outer footprint and minimum screen stroke. Walking still places it at ground level. No physics, camera, model or shadow changes are involved.

The actual production replay at cursor10.3 has exact pause and reverse-seek pixels ([check](airborne-marker/report.json)). The same seed, cursor and viewport were captured before and after; the science panel changed independently, so [full-frame distance](airborne-diff/visual-parity-diff.json) is diagnostic rather than a ring-only metric. The visible world shows the ring moving from empty space to the selected body.

A fresh reviewer inspected the full image and enlarged crop without source/history. Selection was unambiguous: the ring closely encloses the upper fly. Neighboring diffuse shadows remain difficult to associate individually; that is a lighting concern for12, not a second selection ornament. Historical workbench flight captures still show the old ring until rebuilt. Grounded overview stroke had already passed independent full/crop review, including an interior fly among neighbors.

Review keeps the correction to one position component in the shared renderer. The explicit contract and choices ledger now state this altitude policy. Integration tests and the nonblocking human checkpoint remain tracked by the slice handoff; no acceptance of final house lighting or animation readability is implied.
