# Playback controls verification

Real-time playback starts automatically when scene assets and the existing clock buffer are ready. Fast-forward waits for the full recording, making availability independent of a changing production-rate estimate. Replay and leaving an attempt explain the consequences in modal dialogs; opening a dialog pauses playback, and dismissing it restores the prior requested state.

The browser check uses the real worker and archive with a shortened horizon, holding the final chunk at the transport boundary. It verifies automatic real time, disabled fast-forward before final delivery, fast playback afterward, icon tooltip labels, pause/play behavior, replay confirmation, dialog dismissal and leaving for setup. Removing the fast-button disabled guard produces the expected regression failure. The restored guard passes. The setup-hover/return regression also passes with confirmation enabled. Type checking, web tests, animation timing tests and the production build pass.

The wing animation samples at half its previous rate; the existing animation test covers its replay-time sampling. This changes presentation only.

Independent visual review found readable icons, clear selected/disabled states and unclipped dialogs. Equal visual emphasis on the two dialog actions was a minor hierarchy observation; explicit action labels and the initially focused “Keep watching” button keep dismissal easy. Independent code review found a performance-harness confirmation outside its retry condition; both clicks now share that condition. The full long-running performance benchmark was not rerun for this control change.
