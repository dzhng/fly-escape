# Selection interaction verification

The campaign browser check places the last dirty-dishes item through the real native validator, confirms both selection states clear and hover no longer creates a preview, then releases the flies. The initial replay has no selected card, detail panel or followed fly. Both mouse buttons clear a selected fly and return to overview; dragging with either button preserves selection. Removing the placement-clear fix makes the browser regression fail on its palette assertion; restoring it passes.

Type checking, the renderer and web tests, the production web build and delayed-placement commit regression passed. Independent code review identified existing camera/science harness assumptions about automatic selection; those harnesses now select explicitly and clear before testing new scene picks.

Fresh visual review confirms coherent selected/unselected card and ring states, cleared dirty-dishes highlighting and readable placement controls. It also notes existing overlay behavior: the selected brain detail content extends below its scroll viewport, and the playback controls overlap the front house corner at this viewport. Those are framing/scroll observations rather than selection defects. Full captures and enlarged crops preserve both states.
