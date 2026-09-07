# RTS camera controls

The game uses scroll-wheel zoom and canvas edge panning. Zoom preserves fly follow; panning releases follow without clearing selection. The user explicitly removed the Overview button. Asset inspection presets remain in the separate workbench.

The browser camera harness passes card/model selection, close and wide wheel bounds, centered follow, drag, keyboard and edge release, and accessible keyboard focus. After removing the button, selection assertions await the new selected ID rather than the already-true follow flag.

The root game route was captured paused with the prior button restored temporarily and with the final source. The full frames differ in11,982pixels; toolbar crops show removal and reflow. Source was restored to the final candidate after the baseline capture. Independent visual review found clean controls and centered full fly/ring framing. Dense wide swarms can partially obscure a selection ring; that remains a composed readability issue. Camera instructions are less discoverable in the initial viewport and should accompany the final game controls. Neither finding blocks the requested button removal.

See [before](production-before.png), [after](production-after.png), [toolbar before](toolbar-before.png), [toolbar after](toolbar-after.png) and [behavior report](checks.json.gz). This pass does not accept final house art or furnished-food contact.
