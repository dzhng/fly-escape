# Reading flies and neural activity

User-requested presentation changes: capped per-fly camera-depth sizing, right-drag
orbit with orientation-only reset, 5× flying clip speed, skull/escape billboards,
warm exit light, measured soma cloud and simultaneous grouped traces.

The brain uses 65,044 measured soma locations from the selected graph. Missing
locations are omitted. Activity remains the 16 recorded group aggregates; neutral
background cells have no invented voltage/spike measurements. Legend colours and
3D colours share a parser-compatible representation. Group points render after
the neutral cloud. The brain redraws on data/interaction/resize changes and skips
offscreen draws. Similar recorded values can overlap in the shared plots.

Validation: root typecheck, 68 renderer tests, production web build; camera and
science-panel browser suites against Vite :5320; production root captures :5322;
controlled actual-asset outcome/rotation fixture. Both browser suites passed.
Static :5322 does not serve lab deep links: initial lab runs returned 404 and were
rerun against Vite. These checks are not a final throughput/platform acceptance.

Fresh reviews caught unsupported HSL parsing (all brain groups became white),
continuous offscreen brain draws, faint activity highlights, and badges overlapping
wings. Those were corrected. Production setup before/after pixels differ, and the
neural highlight fix changes the cloud region. Existing transparent-wall overlap
and naturally overlapping group traces were recorded, not disguised as new defects.

The glyph for escape is a green check. No post-escape departure path was added;
physical terminal poses and replay timing remain authoritative. Exit glow does not
feed the brain. Optional geometric sensory input was deferred; see ../geometry-vision.
