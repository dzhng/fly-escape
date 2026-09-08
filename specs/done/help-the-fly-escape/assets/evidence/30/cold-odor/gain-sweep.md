# Cold anatomical attraction gain sweep

No candidate showed reliable approach. Do not choose a gain increase as an attraction fix. Gains 1.5, 2.5 and 3 produce exactly identical per-seed observations on both sides, and all common observations match the previous gain-2 run. This is an observed response plateau, not a claim about a particular biological saturation mechanism.

One predetermined sweep: inhibitoryOdor gains 0.5, 1, 1.5, 2.5, 3; 30 seeds; both mirrored sources; paired same-source/no-current controls; 100 moving ticks; zero brain warmup; anatomical antenna spacing; settled fields. Existing graph, Chamber, body, sensory adapter and signs unchanged. Runtime 88.6 seconds. No repository edits.

All values below are active minus matched control, except explicitly absolute columns. Positive source-directed turn, alignment, and distance reduction point toward approach. Intervals are descriptive t(29) 95% intervals without multiplicity correction.

| Gain | Source Z | Source-directed mean turn [95% CI] | Final alignment [95% CI] | Distance reduction, m [95% CI] | Absolute distance reduction, m | Absolute path / net displacement, m | Seeds closer than start |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0.5 | -1 | -0.00109 [-0.00310, 0.00092] | -0.0280 [-0.1428, 0.0868] | -0.0485 [-0.0810, -0.0160] | -0.2315 | 0.7874 / 0.7138 | 5/30 |
| 0.5 | 1 | 0.00330 [0.00088, 0.00572] | 0.2427 [0.1025, 0.3828] | -0.0267 [-0.0585, 0.0051] | -0.2767 | 0.7874 / 0.7213 | 2/30 |
| 1 | -1 | -0.00073 [-0.00283, 0.00136] | 0.0499 [-0.0573, 0.1570] | -0.0720 [-0.1042, -0.0397] | -0.2550 | 0.7873 / 0.7106 | 3/30 |
| 1 | 1 | 0.00186 [-0.00024, 0.00396] | 0.1741 [0.0525, 0.2956] | -0.0758 [-0.1044, -0.0473] | -0.3258 | 0.7872 / 0.7161 | 2/30 |
| 1.5 | -1 | -0.00075 [-0.00284, 0.00134] | 0.0506 [-0.0555, 0.1566] | -0.0715 [-0.1037, -0.0393] | -0.2545 | 0.7873 / 0.7102 | 3/30 |
| 1.5 | 1 | 0.00186 [-0.00024, 0.00396] | 0.1740 [0.0525, 0.2955] | -0.0757 [-0.1042, -0.0472] | -0.3256 | 0.7873 / 0.7163 | 2/30 |
| 2.5 | -1 | -0.00075 [-0.00284, 0.00134] | 0.0506 [-0.0555, 0.1566] | -0.0715 [-0.1037, -0.0393] | -0.2545 | 0.7873 / 0.7102 | 3/30 |
| 2.5 | 1 | 0.00186 [-0.00024, 0.00396] | 0.1740 [0.0525, 0.2955] | -0.0757 [-0.1042, -0.0472] | -0.3256 | 0.7873 / 0.7163 | 2/30 |
| 3 | -1 | -0.00075 [-0.00284, 0.00134] | 0.0506 [-0.0555, 0.1566] | -0.0715 [-0.1037, -0.0393] | -0.2545 | 0.7873 / 0.7102 | 3/30 |
| 3 | 1 | 0.00186 [-0.00024, 0.00396] | 0.1740 [0.0525, 0.2955] | -0.0757 [-0.1042, -0.0472] | -0.3256 | 0.7873 / 0.7163 | 2/30 |

Every arm ends farther from the source on average, with absolute distance-reduction intervals wholly negative. Actual paths are about .787 m, and net displacement about .710–.721 m: the failure is not lack of movement. At gain .5, one source side improves alignment/turn, but this does not generalize to its mirror or become actual approach. All source-directed turn intervals for gains 1 and above include zero.

Increasing gain above 1.5 has no measured behavioral effect here. Gain .5 is less adverse on distance than the plateau, but still gives no reliable approach and is not an accepted replacement. No warmup, hidden steering, motor sign inversion, antenna enlargement, extra gain search, or campaign acceptance is inferred.

Evidence: gain-sweep-evidence.json contains full per-seed active/control observations, absolute and paired statistics, exact source/graph identity, and movement metrics. Executed probe source: src/main.rs; original gain-2 source retained as src/gain2-original.rs. This finite ten-second moving-chamber diagnostic does not test mixed sources, cold fields, household occlusion, or campaign outcomes.
