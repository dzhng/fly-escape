# Object asset registry

The shared registry supplies the same models to the game, replacement workbench and offline thumbnail renderer. Native household and food models retain their authored metre scale and exact core contact geometry. Their sources live beside their GLBs; a palette picture is regenerated from that model, never maintained as an unrelated illustration.

The remaining lamp and shade diagnostic cues are shallow static Blender meshes. They indicate a light-field source without becoming physical obstacles. Their radius-one X/Z geometry scales with the catalog footprint; relief stays within five millimetres. They are not campaign inventory. Run author.py through Blender MCP with KIND set to the source being authored. Each blend owns a separate scene, and export includes only that scene.
