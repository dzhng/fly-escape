# Actual campaign warmup/placement pilot — incomplete comparison

This pilot uses the production Attempt owner, current first-house geometry,20 naturally initialized flies and full terminal outcomes. Before observing results, Claude fixed seeds100–105 and four valid editable setups: empty, apple toward the exit, vinegar behind spawn, and both. Cold and60 unstimulated brain-update variants otherwise use identical inputs. No production warmup has shipped.

All48 cells were attempted:19/24 cold and16/24 warm completed;13 failed on contact errors. Root reviewed the temporary patch and probe, verified unique plan/seed coverage,20 terminal outcomes for each completed run, and recomputed the13 complete matched warm/cold pairs. Raw failures are preserved, not treated as zero escapes or removed from the declared design.

On surviving matched cells, warmup adds one escape per swarm on average (13pairs), and vinegar adds two escapes compared with empty (threepairs per initialization). These are leads, not reliable average-effect estimates: failures depend on trajectory and differ between treatments. Cold apple effects are mixed. One example is warm seed103: empty2escapes, apple5, both7. That demonstrates a reachable useful outcome, not general success.

Feeding is rare among completed runs: one recorded meal in700 completed fly-lives. The rest of those flies either escape or starve; they do not all starve. One meal-bearing run lasts450ticks, while most end around30game seconds, so a universal323tick ceiling would also be false. Failed runs prevent a complete estimate of feeding opportunities. The observed best is7escapes, below the current two-star threshold8; thresholds and lifetime require calibration after the comparison can finish.

The next step is to fix the captured contact failures and rerun this exact design. Do not select a warmup, infer a food-controller change, or start a placement/gain search from this censored pilot. A larger disjoint-seed confirmation follows a promising complete pilot. Visual refinement is not on this path.

Reproduction: apply the desired temporary patch to baseline92b7067 in an isolated checkout, build its example with the workspace lockfile, and pass the prepared brain directory, preserved level content and output JSON path. Each patch contains its own complete example and differs in neural warmup only. `cold.json.gz` and `warm60.json.gz` preserve identities, inputs, outcomes and errors; `paired-results.txt` is secondary presentation. No probe belongs in production.
