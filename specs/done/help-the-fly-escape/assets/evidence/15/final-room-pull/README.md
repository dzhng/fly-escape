# Gentle final-room exit pull

The user asked for objects to bring flies into the final room, followed by gentle physical help toward the exit. The room pull preserves the existing stronger near-door falloff, room boundary, line-of-sight restriction and ordinary swept-body collision/escape checks. It does not change neural input or act across the maze.

Root verification:55 Rust body/attempt tests pass, including isolated drift from beyond doorway reach, no influence across the adjacent room boundary, and wall/obstacle occlusion. WASM, TypeScript and web builds pass. Independent code review found no actionable defects; its generated-type check matches the exporter.

The actual no-object browser run used twenty campaign flies, seed15789670027162723101 and the ten-minute horizon. It completed with3 escapes,17 dead and zero underruns. The earlier doorway-only native control had5 escapes on that seed. This single run verifies integration, not an improvement or balanced difficulty. The authored room speed remains provisional. Scent experiments run separately with doorway-only assistance so this change cannot explain their treatment differences.

Recorded reports include build/content identity, placements, seed and replay metrics. The campaign still has twenty flies; the user-requested sixteen-fly cohorts are used for the ongoing exploratory scent comparisons. No score thresholds changed.
