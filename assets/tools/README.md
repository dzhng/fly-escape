# Floor tool sources

These static Blender-authored sources identify catalog placements without becoming solid obstacles. Vinegar uses an amber liquid saucer; fan a rotor behind a vent grille; lamp a recessed radial lens; shade a contrasting slatted tile. Shade is a visual cue source representation, not a physical canopy. Materials do not introduce scene lights or alter sampled sensory fields.

Native GLBs use +Y up and radius at most one around the origin, with relief from Y=0 to0.005. Placement radius scales X/Z only; fan's chevron points +X at heading zero. Core placement heading and catalog footprint remain authoritative. The renderer's shared placement-model loader validates this contract for all six tool kinds. The shared URL registry serves production and the replacement workbench.

Run author.py through Blender MCP with KIND set to one tool at a time. Each preserved .blend owns a separate scene; GLBs use only that active scene. roundtrip.json records reimported Blender coordinates (+Z up). Existing food scenes remain separately preserved under assets/food. New source replacement must retain these bounds and static-mesh/resource constraints.
