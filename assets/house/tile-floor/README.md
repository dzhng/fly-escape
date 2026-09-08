# Kitchen ceramic finish

A light matte floor distinguishes a kitchen from adjoining wood rooms without adding another floor surface. The material is baked offline into an ordinary glTF image; it needs no runtime procedural shader or network texture source.

[author.py](author.py) imports the existing floor kit as its geometry owner, changes only material/UV appearance and writes an isolated Blender scene plus GLB. Execute that file through Blender with `__file__` set to its absolute path. Blender's bundled NumPy generates the deterministic colour image; no external artwork or dependency is required. Do not recreate the floor mesh in this author.

The image repeats in physical metres. Room instances expand the imported UVs together with the existing room dimensions, so tile size does not stretch with the kitchen. The renderer owns one floor placement per actual room and shares the finish material/image among its room instances; replacing tile must not release neighbouring wood resources.

Grout is colour detail on the unchanged plane, deliberately without raised geometry or a second surface. This texture does not model physical recessed joints.
