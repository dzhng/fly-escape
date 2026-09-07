# House assets

Furniture is authored in metres at its native size. The [catalogue](catalog.json) is the shared envelope contract for Blender export, simulation placement validation and browser loading. A placed furnishing adds appearance identity to the existing solid; it does not introduce another collision shape. Quarter turns preserve the axis-aligned physical footprint while allowing asymmetric models to face into a room.

[Authoring validation](authoring.py) checks both the source scene and exported GLB against that contract. It rejects a mismatched envelope instead of stretching the model to conceal it. The same helper owns neutral authoring lights and render settings while individual assets own their framing. The [cabinet](cabinet/README.md) and [sofa](sofa/README.md) notes explain their authored shape constraints.

Native geometry, material appearance and visibility have separate acceptance gates. A correctly sized mesh is not evidence of finished house art or readable fly contact. The active specification owns those remaining gates.

The [potted plant study](plant/README.md) is a prepared appearance proposal with unresolved foliage contact ownership; it is not a catalogue entry.

The [closed window study](window/README.md) preserves the room-scale fixture's
native dimensions; installed materials and closed panes remain separate from final glass/daylight acceptance.

The [wall sconce](sconce/README.md) is installed as household decoration, separate from the gameplay floor-light cue.

The [material finishing pass](finish-materials.py) applies production surfaces after shape authoring and saves the exported GLBs and individual blend files. Imported materials remain authoritative in the browser; semantic colors only serve temporary geometry while assets load. Floor UVs use a physical texture scale and are expanded with room dimensions, while textures remain shared. [Oak texture provenance](textures/wood-floor/source.json) records the local Poly Haven CC0 inputs. Fabric detail, plant/fruit surfaces and final lighting remain in progress.

The [open doorway](doorway/README.md) frames an ordinary clear passage beneath a lintel. Its posts sit outside the core wall gap, so dressing does not narrow traversal. The [wall-mounted plant](wall-plant/README.md) adds greenery above floor circulation space.
