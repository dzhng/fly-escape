# Open household doorway

The [author](author.py) owns the native envelope and clear passage dimensions. Frame posts overlap the wall beside the opening, never the crossing corridor. No threshold or door leaf narrows the gap.

The origin is floor-centred under the passage. At zero quarter-turns, the opening runs along local X and passage runs along Z. Campaign placement must align the authored passage with the core wall gap. The frame overlaps the solid wall on either side, never the clear opening. Core geometry owns collision; RoomDetails owns native loading and rendering. Doorway frames remain visible from both sides during wall cutaway.

The author script validates that every vertex lies outside the clear passage and verifies native dimensions after GLB export. Ivory frame and warm plaster materials are authored into the GLB; the browser does not replace them.
