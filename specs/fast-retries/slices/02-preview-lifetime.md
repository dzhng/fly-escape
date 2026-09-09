# Release roster preview resources

## Contract

Closing a roster releases its renderer, parsed model and GPU listeners. Reopening it may parse the already-downloaded small fly asset, but must not retain a context from any previous roster or fetch the model again. The world and roster continue to display the same authored fly with independent poses.

## Evidence and seam

The first twenty-cycle run retained one additional DOM node per retry, twenty-one WebGL contexts, and twenty disposal listeners on forty-three shared preview geometry/material objects. The existing module-level Promise<FlyModel> kept those resource objects alive after each FlyPreviews renderer was disposed. Context loss alone did not remove that JavaScript retention chain.

Keep one module-level promise for immutable fly bytes. Setup warms that download. Each mounted preview parses its own FlyModel, which FlyPreviews takes ownership of and uses directly as its single posed instance. On replacement or disposal, stop its animation mixer and dispose the owned model's geometries, materials, textures and skeletons before disposing the renderer. A load that finishes after unmount disposes its result rather than attaching it. Failed downloads clear the byte promise; failed parsing does not strand a renderer. Do not introduce reference counting, clone algorithms, another model manager or a shared material-disposal broadcast.

This replaces the provisional shared parsed-model choice in the first slice. The immutable byte cache is bounded to one authored fly asset and cannot retain GPU contexts. The tiny per-roster parse is an explicit tradeoff for clear resource ownership; the whole house still stays alive across retries.

## Verification

Use the existing twenty-cycle browser report as the red resource observation. After the fix, rerun twenty actual campaign retries with startup and stability assertions enabled. Require a plateau in retained DOM nodes/listeners, no repeat world/model fetches, unchanged world canvas identity and the same startup limits. Inspect a collected heap to confirm retired preview contexts are absent and source resource listeners no longer grow per attempt. Test cancellation during a delayed preview load and reopening successfully.

Capture roster previews before and after, including selected, escaped and rewound states. Use compare-screenshots to inspect model scale, orientation and animation preservation, then screenshot-critique as the final unprimed check. Main-loop seeded records must remain unchanged. Update the choices ledger and run the ordinary review before acceptance.
