# Retry resource investigation

The production build at 60bef2b was exercised through real twenty-fly Run, Pause, Cancel and return-to-edit cycles. A single Worker remains live and the reported WASM allocation stays at 92,340,224 bytes. Each new attempt has a fresh identity and root seed. Those invariants pass; memory lifetime is not yet accepted.

Collected main-thread heap grows by 1,926,472 bytes over six cycles and 4,312,300 over twenty. DOM counters grow from 103 to 141 nodes in the twenty-cycle run, two per retry, while document and event-listener counts stay fixed. These are browser observations, not process RSS or a GPU allocation measurement. No performance timing conclusion is drawn under concurrent native calibration load.

A separate five-cycle clean heap snapshot identified the shared Three.js lighting lookup texture retaining each renderer through its disposal listeners and WebGL context. Another diagnostic snapshot taken after asking DevTools for detached nodes is contaminated by inspector-owned references; it is not the basis of the library-retention finding. The dependency fix and its red/green lifetime evidence are the next bounded pass. This initial harness records observations without inventing a heap-growth tolerance that would declare them acceptable.
