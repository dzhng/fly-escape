# Choices ledger

## Sound

- **Require a possible downstream route for every included input cell — high confidence.** A spatial bin could contain one connected cell and many cells with no retained route to an output. The exporter excludes individual cells without a visual-relay or motor-readout path rather than treating one reachable neighbor as sufficient for the whole bin. This keeps the injected population causally interpretable. On the frozen data this removes no additional cells: all coordinate-qualified Tm2/Tm20 cells have both paths. Connectivity still makes no promise about neural activity.

The spec delegates internal file/report layout and numerical tie handling. The exported registration records the symmetric nearest-bin tie convention; no anatomy, registration, dose or behavioral selection rule was changed.

- **Require an explicit family before a winner is frozen — high confidence.** The normal preparation command must not silently emit a production graph without visual groups while the pilot is still open. Both export modes require a command-line family until the existing pathway registry records the pilot winner. This keeps the exporter usable for controlled experiments without choosing the winner on behalf of the experiment.
- **Retain extraction provenance across metadata updates — high confidence.** Updating visual groups changes the metadata exporter identity without changing any graph bytes. The manifest retains the original extraction exporter hash/revision alongside the current exporter identity, so a later audit can distinguish graph construction from a metadata-only refresh.
