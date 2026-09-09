# Final campaign visual review

Target: preserve recognizable furnished rooms, visible selected flies and usable replay controls; keep the graphs directly below the brain. All 22 images were inspected by a fresh reviewer: eight full frames, twelve 2× room/panel crops, and two setup pairs. The implementing agent separately inspected the setup pairs, selected fly, and result frames.

The setup comparisons show no apparent regression in room composition, furniture, lighting, doorway transparency, Start/Finish labels or placement controls. Open Window's additional bananas and expanded inventory fit without overlap. Pixel metrics are diagnostic because placements, random seed and rendering state differ. World-crop grayscale MAE is 4.37/4.47 and the proportion above a delta of 32 is 1.33%/1.02%. No depth-ordering error, missing geometry or clipped fly is established by these stills.

The fresh reviewer identified these limitations at high confidence in full frames and crops:

- The visible legend stops after Landing L/R, with four groups below the panel boundary and no obvious scroll cue.
- Sixteen traces in short plots are difficult to follow; the selected Vision L trace lacks strong emphasis.
- Rewind close-ups show mostly floor. Final camera frames can show furniture bars or a floor/green-surface boundary, making room location difficult to understand even though the selected fly remains visible.

These are retained limitations, not claimed fixes. The [earlier visual review](../../neural-vision/assets/browser/visual-review.md) records the same panel discoverability and trace-density issues; its [paused frame](../../neural-vision/assets/browser/paused-rewind.png) also shows the floor-focused camera. Campaign integration changes neither camera nor inspector code. The final-state furniture/boundary views are additional examples of that existing follow-camera behavior; there is no matched baseline proving those exact frames unchanged. The browser harness reaches Vision L by scrolling and exercises playback normally.

The empty plots for the caught fly are labeled “gaps = no sample,” so the reviewer did not classify that alone as a rendering defect. Accept campaign lighting integration within the regression-check scope, retaining the listed readability and camera-context limitations. This is not a claim that every UI or camera state is ideal.
