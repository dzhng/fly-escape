# Selected fly panel layout

The activity charts follow the 3D brain so the selected fly’s time series can be read before the connectivity diagram and group legend. Smaller roster thumbnails and tighter row spacing move the details upward while preserving all sixteen fly entries and their labels.

The [user reference](assets/user-reference.png) shows the earlier order that prompted this change. [Desktop](assets/desktop.png), [selected details](assets/details.png) and [narrow layout](assets/mobile.png) captures show the production result. [Independent visual review](assets/visual-review.md) found no blocking overlap or missing elements. Graph labels remain small on narrow screens. Type checking and the production build pass.

[SciencePanel](../../../apps/web/src/science-panel.tsx) owns the order; [its stylesheet](../../../apps/web/src/science-panel.css) owns roster spacing. This layout change does not alter recorded data or selection behavior.
