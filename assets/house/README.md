# House assets

Furniture is authored in metres at native size. The [catalogue](catalog.json) is the shared envelope contract for authoring, placement validation and loading. Appearance is attached to an existing solid; it does not create another collision shape. Closed bases deliberately avoid suggesting under-furniture routes that the rectangular physical footprint cannot provide.

[Authoring validation](authoring.py) checks source scenes and exported GLBs against that envelope instead of stretching them to pass. Stage lights and cameras remain outside the game model. The [material author](finish-materials.py) owns production surfaces; imported materials remain authoritative in the browser. Physical floor UVs expand with room dimensions while textures stay shared. [Oak texture provenance](textures/wood-floor/source.json) identifies the local Poly Haven CC0 inputs.

The [cabinet](cabinet/README.md) and [sofa](sofa/README.md) explain grounded furnishing conventions. The shared study/bedroom author is documented through the [desk](desk/README.md), [chair](chair/README.md) and [bed](bed/README.md); the [kitchen](kitchen/README.md) explains its combined solid footprint.

Presentation fixtures use existing room geometry without creating escape routes or sensory sources. The [doorway](doorway/README.md) and [exit window](exit-window/README.md) preserve clear physical openings; the [closed window](window/README.md), [sconce](sconce/README.md) and [wall plant](wall-plant/README.md) explain their mounting conventions. The [floor finish](tile-floor/README.md) changes appearance without adding a second surface.

The [potted plant study](plant/README.md) remains a diagnostic source outside the furniture catalogue. Its foliage must not be treated as validated physical occupancy. Model appearance alone does not establish contact behavior or biological effects.
