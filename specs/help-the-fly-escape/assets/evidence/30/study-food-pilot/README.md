# A proposed poor setup that did not reliably perform poorly

Two new native timed attempts at the paced second-house settings. The [frozen setup](plans.json) piles fruit, banana and laundry in the study and puts an east-facing fan in the corridor. All proposed positions passed production placement validation without adjustment. Same [harness](../second-house-route/second_house_pilot.rs); compact raw results under runs/.

Escapes:2 on seed110,5 on111; all remaining flies timed out, no hazards or starvation. Both rounds completed3000ticks. The existing same-seed doorway reference scored4,6, so paired improvement is only2,1. This does not establish the four-escape planner gate or justify calling this setup reliably poor. A food-only ablation is next to isolate the fan contribution.

Root review rejects several delegate assertions: same-seed reference data do exist (doorway-placements);5escapes is not the highest measured second-house result; zero proximity to the fan does not mean zero exposure to its downstream jet; an east-facing fan at x1 does not point into the west dead end. No feeding is expected under the timed policy. Root uses the raw outcomes and actual placement inputs rather than those explanations. No production or threshold change follows from this pilot.
