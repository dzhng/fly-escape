# Household props

Familiar domestic objects make rooms readable. Appearance does not establish an effect on a fly: the [placement owner](../../crates/sim/src/placement.rs) defines modeled odor, physical roles and hazards separately from the mesh. Timed campaign food does not replenish energy.

[Authoring](author.py) creates isolated scenes in metres and checks each exported envelope through re-import. Use actual glTF Y-up bounds when mounting props rather than stretching them to a nominal box. Materials are embedded; the staging camera and lighting are not part of the game model.

Native contact preserves baked geometry. Disconnected mesh pieces become separate edge-connected support surfaces, retaining closed-component boundaries. A supporting surface is not automatically edible. For the spider web, only the strands and spider catch flies; gaps remain passable. Catching is an authored game rule, not simulated adhesive mechanics.

The [fan](fan/README.md) documents its directional convention and open guard. The [vinegar bottle](vinegar/README.md) explains its contact shell. Other models share this authoring contract; their exact registration belongs to the [object registry](../tools/README.md).
