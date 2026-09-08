# Object assets

The [registry](registry.ts) supplies the same models to the game, replacement workbench and thumbnail renderer. Native household and food models retain their authored scale and contact geometry. [Thumbnail identity](thumbnails.ts) follows the model; palette pictures are generated from game assets rather than maintained as unrelated illustrations.

[Household props](../household/README.md) and [food](../food/README.md) own their physical authoring contracts. Diagnostic light cues instead use shallow meshes to indicate a field source without becoming obstacles. Their normalized footprint follows the placement catalogue while relief remains shallow.

The local [author](author.py) runs in Blender with `KIND` set to the desired diagnostic source. Each export includes only its isolated scene. These diagnostic cues are not campaign inventory; registration does not imply availability in a level.
