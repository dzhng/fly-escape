# Apple contact asset

The Blender source uses metres with its support pivot on the floor. The apple body is both visible geometry and an edible contact surface; a separate invisible sphere must not replace it. Its red/yellow skin uses a deterministic baked colour image and an authored glossy finish. The shared skin author places irregular blush and pale pores on spherical coordinates; the exported material is ordinary glTF with a local embedded image. Material changes preserve the exact contact geometry; there is no separate non-colliding stem or leaf.

Run [author.py](author.py) through Blender to export the active scene only. Bake the exported GLB through the workbench's [contact exporter](../../../apps/asset-lab/scripts/export-contact.ts):

```sh
bun apps/asset-lab/scripts/export-contact.ts assets/food/apple/apple.glb assets/food/apple/contact.json
cargo run -q -p sim --example contact_pose_fixture > assets/proportions/contact-fixture.json
```

The contact JSON stores the GLB's world-space triangle positions. Its local surface ID identifies this standalone asset; placement resolution must assign unique identities within an attempt. Rust's exact JSON float parsing preserves exported vertex values. The contact workbench rejects stale geometry rather than displaying poses computed against a different mesh.

The game uses this native asset for visible and physical contact. Fixed workbench queries isolate attachment; they do not by themselves establish moving behavior, feeding, or final photorealistic art.
