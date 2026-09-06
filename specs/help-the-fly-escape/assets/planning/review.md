# Specification validation — 2026-09-06

Scope: planning documents, archived mock evidence and a roadmap. No game implementation, neural benchmark or focus-ring fix is claimed by this pass.

Three independent drafts were synthesized; the architecture was reviewed for single ownership and the conversation was audited into GAMEPLAY/CONTRACTS. A separate agent reviewed the materialized plan and found three actionable issues: slice skill links had one excess parent directory; grouped-network connectivity lacked an exporter contract; house geometry depended on a workbench not yet guaranteed by its prerequisites. All three were corrected. The group export now includes directed signed aggregates and overlap semantics; house geometry depends on slice 07.

Validation: 107 active Markdown links resolved locally; all 17 slice files exist and their dependency graph is acyclic with valid earlier prerequisites. Historical archived links are intentionally outside this check and labeled historical. `git diff --check` passed. Runtime tests are not applicable to this documentation-only change.

Playwright rendered the roadmap at 1440×1000 and 760×1000. Both reported no horizontal overflow; all 17 checkpoint links were present. Captures: [desktop](roadmap-desktop.png), [top](roadmap-top.png), [narrow](roadmap-narrow.png). An unprimed screenshot reviewer found no clipping/overlap and one minor dependency-list spacing issue; spacing was corrected and all captures regenerated for final review.

The old Python plan remains in `superseded/`, while its former handoff/decisions entry points now lead to the browser spec. Historical spike documents and discovery notes carry explicit supersession banners. Runtime code and source data were not deleted during planning.

Final refreshed-capture critique: no visible layout or legibility defects at either captured width; no clipping, overlap or overflow. Accepted as a planning roadmap, not a game visual acceptance shot.
