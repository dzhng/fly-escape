# Choices ledger

## Sound

- **Require a possible downstream route for every included input cell — high confidence.** A spatial bin could contain one connected cell and many cells with no retained route to an output. The exporter excludes individual cells without a visual-relay or motor-readout path rather than treating one reachable neighbor as sufficient for the whole bin. This keeps the injected population causally interpretable. On the frozen data this removes no additional cells: all coordinate-qualified Tm2/Tm20 cells have both paths. Connectivity still makes no promise about neural activity.

The spec delegates internal file/report layout and numerical tie handling. The exported registration records the symmetric nearest-bin tie convention; no anatomy, registration, dose or behavioral selection rule was changed.
