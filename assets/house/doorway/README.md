# Open household doorway

The native asset has a clear opening 0.9 metres wide and 2.05 metres high, without a threshold or door leaf. Six-centimetre frame posts remain outside x = ±0.45 metres. The header occupies 2.05–2.10 metres and the plaster lintel reaches the 2.5-metre wall height. Its full envelope is 1.02 × 2.5 × 0.16 metres; the plaster itself is 0.12 metres thick.

The origin is floor-centred under the passage. At zero quarter-turns, the opening runs along local X and passage runs along Z. Campaign placement must align this with a core wall gap of exactly 0.9 metres. The frame overlaps the solid wall on either side, never the clear opening. Core geometry owns collision; RoomDetails owns native loading and rendering. Doorway frames remain visible from both sides during wall cutaway.

The author script validates that every vertex lies outside the clear passage and verifies native dimensions after GLB export. Ivory frame and warm plaster materials are authored into the GLB; the browser does not replace them.
