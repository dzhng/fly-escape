# Open household doorway

The [envelope](envelope.json) is the shared native width contract for the [author](author.py) and browser. Frame posts overlap the wall beside the opening, never the crossing corridor. No threshold or door leaf narrows the gap.

The origin is floor-centred under the passage. At zero quarter-turns, the opening runs along local X and passage runs along Z. Campaign frames derive their placement and clear width from the core wall gaps. The renderer spreads the posts and extends the lintel to match each opening, preserving post thickness. Closing a physical opening removes its frame. The frame overlaps the solid wall on either side, never the clear opening. Core geometry owns collision; RoomDetails owns native loading and rendering. Doorway frames remain visible from both sides during wall cutaway.

The author script validates that every vertex lies outside the clear passage and verifies native dimensions after GLB export. Ivory frame and warm plaster materials are authored into the GLB; the browser does not replace them.
