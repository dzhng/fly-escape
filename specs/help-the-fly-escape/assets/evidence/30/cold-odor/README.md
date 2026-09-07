# Cold-start odor response probe

Minimal recommendation: retain existing inhibitoryOdor gain 2 as an explicitly modeled attractive binding; enable the currently absent excitatoryOdor pathway at gain 2 for repellent field sources. Do not invert source sides, flip motor signs, add warmup, or raise gains from this evidence. Repulsion is supported here; reliable attraction is not established under this cold-start moving fixture.

One matched set used 30 seeds, 100 moving ticks (10 game seconds), zero brain warmup, settled fields, native anatomical antenna spacing, a source one metre to either side, and gain 2. Each active sample had an identical-source/no-current paired control. The existing field fixture supplied geometry; the existing Chamber, sensory adapter, Graph, Brain, and body owners supplied behavior. Runtime was 39.5 seconds. The exact graph, source hashes, observations, and descriptive t(29) intervals are in evidence.json. No project code changed.

| Pathway/source Z | Change in source-directed mean motor turn (95% CI) | Change in distance reduction, m (95% CI) | Change in final source alignment (95% CI) |
|---|---:|---:|---:|
| Inhibitory / -1 | -.00075 [-.00284, .00134] | -.0715 [-.1037, -.0393] | .0506 [-.0555, .1566] |
| Inhibitory / +1 | .00186 [-.00024, .00396] | -.0757 [-.1042, -.0472] | .1740 [.0525, .2955] |
| Excitatory / -1 | -.01658 [-.02036, -.01281] | -.1476 [-.2188, -.0763] | -.5407 [-.7759, -.3056] |
| Excitatory / +1 | -.00794 [-.01124, -.00464] | -.0730 [-.1168, -.0293] | -.2650 [-.4340, -.0959] |

Negative source-directed turn is away from the source; negative distance reduction means farther than matched controls. The excitatory pathway showed away-turning in 28/30 and 27/30 paired seeds. The inhibitory pathway had no consistent directional turn and was farther from source than controls on both sides. All arms detected the source from tick zero, so this is not an absent-input failure.

The adapter thresholds odor contrast and then injects a binary side-selected current of the configured gain. Gain is not physical odor concentration. The old field_probe uses a 60-tick brain warmup and a .15-m antenna offset; those results do not automatically transfer to a cold brain at anatomical spacing. Its hand-integrated heading also omits the Chamber body turn gain; this probe instead uses actual endpoint pose and directly measures mean motor turn.

This is one finite moving-chamber comparison, not a campaign/body validation, simultaneous-source interaction test, gain optimization, or biological preference proof. No ablation arm was included. Initial fields were settled; newly introduced sources with a cold field can have different onset delays. Keep these limits with any campaign claim.

Biological caveat: Semmelhack and Wang report strong attraction to low-concentration apple cider vinegar; higher concentration recruits an additional glomerulus and is less attractive. This does not establish that all vinegar is a repellent, that these modeled pathways correspond to those glomeruli, or that current gain encodes vinegar concentration. Treat ordinary vinegar/fermented food as potentially attractive and describe any high-concentration irritant category as a modeling assumption. Primary source: https://www.nature.com/articles/nature07983 (Nature 459, 218–223, 2009; DOI 10.1038/nature07983).

The [bounded gain sweep](gain-sweep.md) found no reliable approach candidate. Raising gain is not supported as an attraction fix; identical observations at gains 1.5, 2, 2.5 and 3 reflect the measured response saturation rather than rounded summaries.
