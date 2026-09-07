# House assets

Furniture is authored in metres at its native size. The [catalogue](catalog.json) is the shared envelope contract for Blender export, simulation placement validation and browser loading. A placed furnishing adds appearance identity to the existing solid; it does not introduce another collision shape. Quarter turns preserve the axis-aligned physical footprint while allowing asymmetric models to face into a room.

[Authoring validation](authoring.py) checks both the source scene and exported GLB against that contract. It rejects a mismatched envelope instead of stretching the model to conceal it. The [cabinet](cabinet/README.md) and [sofa](sofa/README.md) notes explain their authored shape constraints.

Native geometry, material appearance and visibility have separate acceptance gates. A correctly sized mesh is not evidence of finished house art or readable fly contact. The active specification owns those remaining gates.
