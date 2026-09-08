# Timed placement pilot

Root verified15unique complete attempts,20terminal outcomes each, zero starvation and five-minute horizons against the raw reports. Raw reports are preserved losslessly as `runs/*.json.gz`; decompress with gzip to inspect their complete sampled events and outcomes. All tested plans passed the production placement owner. This is three-seed exploratory evidence, not final campaign acceptance or proof that a strategy works reliably.

Escapes for seeds100/101/102: empty5/10/9; mid-room apple6/9/11; nearby vinegar6/6/9; their combination5/8/12; exit-adjacent apple plus relocated vinegar11/10/9. The best candidate's mean improvement is2flies, entirely from seed100. Separating the two changed placements and checking fresh tuning seeds is the next mechanics action. No fan was tested.

Read the [Claude report](report.md) with these corrections:

- The fruit radius is a source-injection parameter, not a hard cutoff for the propagated odor plume. The wall-aware field owner controls propagation; claims that a plume necessarily covers or stops at an opening are not proven by source radius.
- The alternate plan moves both objects. Occupancy and exit-distance changes are observations, but attributing them to the apple or vinegar separately remains a hypothesis.
- The caught fly in combined seed100 means timeouts are not always the complement of escapes alone; all terminal outcomes together total20. Zero feeding is required by the timed policy and does not measure successful landing or feeding behavior.
- This candidate predates the latest explicit all-escaped early-finish clarification, but every observed attempt reaches3000ticks, with no run exhausting all flies to hazards beforehand. The source identity is preserved in each report; later neural performance work must establish equivalence before reusing these results.

The source harness reads the authored first-level JSON literal with `include_str!`; it uses the actual Graph and Attempt. Reproduction needs the corresponding timed level and source revision, then its CLI arguments are graph directory, plan JSON, comma-separated seeds and output directory. Historical numerical evidence remains immutable; do not silently run it against newer gameplay content and call it a replication.
