# Whole-run size accounting

Comparison: the repository after its agent skills were added (`2b500c7`), before the browser-game specification, through the local MVP closeout. Approximate textual line accounting uses a no-renames diff. Moving a file can therefore appear on both sides; binary models and screenshots are excluded. No formatter-only changes were selectively removed.

| Surface | Added | Deleted | Net |
| --- | ---: | ---: | ---: |
| Production code/config (excl. comments) | 24,377 | 6,593 | +17,784 |
| Comments | 733 | 466 | +267 |
| Specs & docs | 14,131 | 9,683 | +4,448 |
| Tests / harness | 17,585 | 4,988 | +12,597 |
| Recorded evidence/data | 2,347,010 | 0 | +2,347,010 |

Production includes build/configuration files and authoring code. Standalone comment lines are separated by syntax-prefix classification; inline Rust test modules are counted with tests. Test/harness totals include their own comments. These are review-scale estimates, not a language-parser census. Recorded evidence includes large numeric traces and frozen experimental artifacts; it is not runtime code. Documentation closeout reports added after this snapshot can slightly change the documentation total.

The durable maintenance surfaces are two browser applications, shared simulation-client and renderer packages, a Rust simulation with a WASM boundary and generated wire types, a Worker/replay protocol, browser-local progress storage, offline connectome preparation, native Blender asset/contact authoring, and a pinned Three.js patch. There is no application server, remote database, account system or deployed service added by this run.
