//! Modeled sensory-to-current adapter; no motor or target-direction commands.
use crate::{environment::SensorySample, Graph};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use ts_rs::TS;

/// Canonical linear RGB8 drives two frozen responses before spatial weighting.
pub fn retinal_currents(
    map: &crate::RetinalMap,
    rgb: &[u8],
    gain: f64,
) -> Result<Vec<(u32, f64)>, String> {
    if !gain.is_finite() || !(0. ..=3.).contains(&gain) {
        return Err("retinal gain must be between zero and three".into());
    }
    if rgb.len() != map.sample_count * 2 * 3 {
        return Err("retinal current requires both complete RGB eyes".into());
    }
    Ok(map
        .entries
        .iter()
        .map(|entry| {
            let signal: f64 = entry
                .taps
                .iter()
                .map(|&(sample, weight)| {
                    let offset = (entry.eye.index() * map.sample_count + sample) * 3;
                    let q: f64 = rgb[offset..offset + 3]
                        .iter()
                        .zip(map.coefficients[entry.channel])
                        .map(|(&byte, coefficient)| byte as f64 / 255. * coefficient)
                        .sum();
                    weight * q / (q + 0.5)
                })
                .sum();
            (entry.index, gain * signal)
        })
        .collect())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum CuePathway {
    ExcitatoryOdor,
    InhibitoryOdor,
    Vision,
    None,
}

/// Modeled half-gain scale chosen from uniform settled-field samples, not receptor
/// measurements or the concentrations experienced by moving flies. See the
/// scent-strength evidence under specs/done/help-the-fly-escape/assets/evidence/33/.
const ODOR_HALF_CONCENTRATION: f64 = 0.55;

/// The measured chamber maps attractive odor and the room-local exit cue to
/// excitatory-labeled inputs and repellent odor to inhibitory-labeled inputs.
/// These source bindings are modeling assumptions, not universal biological
/// functions of excitation or inhibition.
/// Local contrast selects sensory input. Side identity is retained;
/// whether a pathway attracts or repels is an empirical result, not a sign flip.
/// Odor is delivered graded: the detected side carries its own concentration, so a
/// stronger smell drives a stronger current. Vision preserves all eight recorded
/// brightness channels through the graph’s annotation-derived input map.
pub fn cue_currents(
    graph: &Graph,
    sample: &SensorySample,
    pathway: CuePathway,
    gain: f64,
) -> Result<Vec<(u32, f64)>, String> {
    if !gain.is_finite() || !(0.0..=3.0).contains(&gain) {
        return Err("cue gain must be between zero and three".into());
    }
    let (ids, mut values) = match pathway {
        CuePathway::ExcitatoryOdor => (
            ["odorExcL", "odorExcR"],
            [
                sample.left.attractive_odor + sample.left.exit_cue,
                sample.right.attractive_odor + sample.right.exit_cue,
            ],
        ),
        CuePathway::InhibitoryOdor => (
            ["odorInhL", "odorInhR"],
            [sample.left.repellent_odor, sample.right.repellent_odor],
        ),
        CuePathway::Vision => {
            if gain == 0. {
                return Ok(vec![]);
            }
            let map = graph
                .manifest
                .vision_input
                .as_ref()
                .ok_or("graph has no validated visual input map")?;
            if sample
                .vision
                .brightness
                .iter()
                .any(|value| !value.is_finite() || *value < 0.)
            {
                return Err("visual brightness must be finite and nonnegative".into());
            }
            let amplitudes = sample
                .vision
                .brightness
                .map(|brightness| brightness / (brightness + 0.5));
            return Ok(map
                .entries
                .iter()
                .map(|entry| {
                    let signal: f64 = entry
                        .weights
                        .iter()
                        .zip(amplitudes)
                        .map(|(weight, amplitude)| weight * amplitude)
                        .sum();
                    (entry.index, (gain * signal).clamp(0., gain))
                })
                .collect());
        }
        CuePathway::None => return Ok(vec![]),
    };
    // A modeled lateral detector: local field contrast chooses the sensory
    // population, never a motor command or a direction to a remote target.
    // The 0.01% contrast floor is calibrated at anatomical spacing, not a biological threshold.
    let detected = values[0].max(values[1]) >= 0.05
        && (values[0] - values[1]).abs() > 0.0001 * (values[0] + values[1]);
    // Compress large odor concentrations while retaining dose sensitivity.
    let amplitude = |concentration: f64| concentration / (concentration + ODOR_HALF_CONCENTRATION);
    values = if !detected {
        [0.0, 0.0]
    } else if values[0] > values[1] {
        [amplitude(values[0]), 0.0]
    } else {
        [0.0, amplitude(values[1])]
    };
    group_currents(graph, ids, values.map(|value| gain * value.clamp(0.0, 1.0)))
}

/// Sensory-labelled inputs must propagate through the graph before reaching a
/// motor readout, including manual inputs in the observation lab.
pub fn group_currents(
    graph: &Graph,
    ids: [&str; 2],
    values: [f64; 2],
) -> Result<Vec<(u32, f64)>, String> {
    if values
        .iter()
        .any(|v| !v.is_finite() || !(0.0..=3.0).contains(v))
    {
        return Err("sensory currents must be between zero and three".into());
    }
    // Keep sensory stimuli out of every motor readout. The confirmatory probe
    // establishes the downstream response without directly driving a measured DN.
    let readouts = motor_readout_indices(graph);
    let mut currents = BTreeMap::new();
    for (id, value) in ids.into_iter().zip(values) {
        let group = graph
            .manifest
            .groups
            .iter()
            .find(|g| g.id == id && !g.indices.is_empty())
            .ok_or_else(|| format!("missing sensory group {id}"))?;
        for &index in group.indices.iter().filter(|i| !readouts.contains(i)) {
            *currents.entry(index).or_insert(0.0) += value;
        }
    }
    Ok(currents.into_iter().collect())
}

/// All neuronal populations consumed by the current body/movement decoders.
pub fn motor_readout_indices(graph: &Graph) -> HashSet<u32> {
    let m = &graph.manifest.motor;
    m.dn_left
        .iter()
        .chain(&m.dn_right)
        .chain(&m.mn_left)
        .chain(&m.mn_right)
        .copied()
        .chain(
            [
                "OLFACTORY_DN_LEFT",
                "OLFACTORY_DN_RIGHT",
                "FLIGHT_DN_LEFT",
                "FLIGHT_DN_RIGHT",
            ]
            .into_iter()
            .flat_map(|id| graph.pathway(id).iter().copied()),
        )
        .chain(
            graph
                .manifest
                .groups
                .iter()
                .filter(|g| matches!(g.id.as_str(), "proboscis" | "landingL" | "landingR"))
                .flat_map(|g| g.indices.iter().copied()),
        )
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::environment::{FieldSample, Point};
    fn fixture_graph() -> Graph {
        Graph {
            manifest: serde_json::from_value(serde_json::json!({
                "schemaVersion":1,"neuronCount":4,"edgeCount":0,"graphHash":"fixture",
                "bodyIds":["1","2","3","4"],"motor":{"dnL":[3],"dnR":[],"mnL":[],"mnR":[]},
                "pathways":{},"groups":[
                    {"id":"odorExcL","label":"Left","indices":[0,2,3]},
                    {"id":"odorExcR","label":"Right","indices":[1,2]},
                    {"id":"odorInhL","label":"Left inhibitory","indices":[0]},
                    {"id":"odorInhR","label":"Right inhibitory","indices":[1]}],
                "groupLinks":[],"pathwayProvenance":"synthetic adapter fixture"
            }))
            .unwrap(),
            source_offsets: vec![0; 5],
            targets: vec![],
            weights: vec![],
            body_lookup: Default::default(),
        }
    }
    /// Which populations a pathway drives at all, ignoring how strongly.
    fn driven(currents: &[(u32, f64)]) -> Vec<(u32, bool)> {
        currents.iter().map(|(i, c)| (*i, *c > 0.)).collect()
    }
    /// The strongest current the pathway delivers anywhere.
    fn peak(currents: &[(u32, f64)]) -> f64 {
        currents.iter().map(|(_, c)| *c).fold(0., f64::max)
    }
    /// A one-sided attractive-odor sample; the left antenna smells `left`.
    fn attractive(left: f64, right: f64) -> SensorySample {
        SensorySample {
            left: FieldSample {
                attractive_odor: left,
                ..Default::default()
            },
            right: FieldSample {
                attractive_odor: right,
                ..Default::default()
            },
            vision: Default::default(),
            wind: Point::default(),
        }
    }
    /// Each odor channel reaches its own labelled population, so a pathway ablation
    /// removes one smell rather than silently re-routing the other.
    #[test]
    fn each_odor_channel_and_the_exit_cue_reach_their_own_labelled_pathway() {
        let graph = fixture_graph();
        let opposed = SensorySample {
            left: FieldSample {
                attractive_odor: 0.8,
                repellent_odor: 0.2,
                ..Default::default()
            },
            right: FieldSample {
                attractive_odor: 0.2,
                repellent_odor: 0.8,
                ..Default::default()
            },
            vision: Default::default(),
            wind: Point::default(),
        };
        let excitatory = cue_currents(&graph, &opposed, CuePathway::ExcitatoryOdor, 1.).unwrap();
        assert_eq!(
            driven(&excitatory),
            vec![(0, true), (1, false), (2, true)],
            "attractive odor drives the excitatory-labelled side that smells it more"
        );
        assert_eq!(
            driven(&cue_currents(&graph, &opposed, CuePathway::InhibitoryOdor, 1.).unwrap()),
            vec![(0, false), (1, true)],
            "repellent odor drives the inhibitory-labelled side independently"
        );
        let exit_only = SensorySample {
            left: FieldSample {
                exit_cue: 0.8,
                ..Default::default()
            },
            right: FieldSample {
                exit_cue: 0.2,
                ..Default::default()
            },
            vision: Default::default(),
            wind: Point::default(),
        };
        assert_eq!(
            driven(&cue_currents(&graph, &exit_only, CuePathway::ExcitatoryOdor, 1.).unwrap()),
            vec![(0, true), (1, false), (2, true)],
            "the room-local exit cue drives the same excitatory channel on its own"
        );
        let odor_and_exit = SensorySample {
            left: FieldSample {
                exit_cue: 0.8,
                ..opposed.left
            },
            ..opposed
        };
        assert!(
            peak(&cue_currents(&graph, &odor_and_exit, CuePathway::ExcitatoryOdor, 1.).unwrap())
                > peak(&excitatory),
            "the exit cue adds into the attractive channel rather than replacing it"
        );
        assert!(
            cue_currents(&graph, &exit_only, CuePathway::InhibitoryOdor, 1.)
                .unwrap()
                .iter()
                .all(|(_, current)| *current == 0.),
            "the exit cue must not leak into the repellent channel"
        );
    }
    #[test]
    fn mirrored_senses_swap_currents_without_stimulating_motor_readouts() {
        let graph = fixture_graph();
        assert_eq!(
            group_currents(&graph, ["odorExcL", "odorExcR"], [0.25, 0.75]).unwrap(),
            vec![(0, 0.25), (1, 0.75), (2, 1.0)],
            "manual sensory input sums overlapping groups and excludes motor neuron 3"
        );
        let mut sample = attractive(0.8, 0.2);
        let left = cue_currents(&graph, &sample, CuePathway::ExcitatoryOdor, 1.).unwrap();
        std::mem::swap(&mut sample.left, &mut sample.right);
        let right = cue_currents(&graph, &sample, CuePathway::ExcitatoryOdor, 1.).unwrap();
        assert_eq!(driven(&left), vec![(0, true), (1, false), (2, true)]);
        assert_eq!(driven(&right), vec![(0, false), (1, true), (2, true)]);
        assert_eq!(
            peak(&left),
            peak(&right),
            "mirroring a sample mirrors which side is driven, not how strongly"
        );
        assert_eq!(
            (left[1].1, left[2].1),
            (0., left[0].1),
            "the population shared by both sides carries the driven side's current alone"
        );
        assert!(
            !left.iter().any(|(i, _)| *i == 3),
            "a sensory/motor overlap must not directly drive a readout"
        );
        assert_eq!(
            driven(
                &cue_currents(
                    &graph,
                    &attractive(0.5002, 0.5),
                    CuePathway::ExcitatoryOdor,
                    1.
                )
                .unwrap()
            ),
            vec![(0, true), (1, false), (2, true)],
            "resolved anatomical-scale gradient remains detectable"
        );
        for [left, right] in [[0., 0.], [0.8, 0.8], [0.049, 0.], [0., 0.049]] {
            assert!(
                cue_currents(
                    &graph,
                    &attractive(left, right),
                    CuePathway::ExcitatoryOdor,
                    1.
                )
                .unwrap()
                .iter()
                .all(|(_, current)| *current == 0.),
                "uniform or sub-floor odor must not drive a lateral input"
            );
        }
        assert!(
            cue_currents(&graph, &sample, CuePathway::Vision, 1.).is_err(),
            "missing required pathways cannot silently become zero input"
        );
    }
    /// The point of grading: how hard a smell drives the fly now depends on how
    /// strong the smell is, and a stronger source keeps buying less than the last.
    #[test]
    fn stronger_odor_delivers_more_current_with_bounded_diminishing_returns() {
        let graph = fixture_graph();
        for pathway in [CuePathway::ExcitatoryOdor, CuePathway::InhibitoryOdor] {
            let gain = 2.;
            let delivered = |concentration: f64| {
                let mut sample = attractive(concentration, 0.);
                sample.left.repellent_odor = concentration;
                peak(&cue_currents(&graph, &sample, pathway, gain).unwrap())
            };
            // The concentrations this house actually produces: the minimum above the
            // detection floor, the quartiles and median the half-concentration was drawn
            // from, and the strongest cell of the settled field.
            let surveyed = [0.051, 0.251, 0.548, 0.666, 0.840, 1.180];
            let currents: Vec<f64> = surveyed.iter().map(|&c| delivered(c)).collect();
            for pair in currents.windows(2) {
                assert!(
                    pair[1] > pair[0],
                    "delivered current must rise with concentration: {currents:?}"
                );
            }
            assert!(
            4. * currents[0] < *currents.last().unwrap(),
            "a barely detected plume must drive far less than the strongest one this house produces: {currents:?}"
        );
            assert!(
                delivered(1e6) < gain && delivered(1e6) > 0.999 * gain,
                "an overwhelming plume approaches the gain without ever exceeding it"
            );
            let doublings: Vec<f64> = (0..5)
                .map(|i| delivered(ODOR_HALF_CONCENTRATION * 2f64.powi(i)))
                .collect();
            assert_eq!(
            doublings[0],
            gain / 2.,
            "the half-concentration delivers half the gain, so subsequent doublings test diminishing returns"
        );
            let gained: Vec<f64> = doublings.windows(2).map(|p| p[1] - p[0]).collect();
            for pair in gained.windows(2) {
                assert!(
                pair[1] < pair[0],
                "each doubling above the half-gain concentration must buy less current than the last: {gained:?}"
            );
            }
        }
    }
    fn vision_fixture() -> (Vec<u8>, serde_json::Value) {
        use sha2::{Digest, Sha256};
        let mut bytes = b"FLYGRAPH".to_vec();
        bytes.extend(1u32.to_le_bytes());
        bytes.extend(10u32.to_le_bytes());
        bytes.extend(0u32.to_le_bytes());
        bytes.resize(64, 0);
        let hash = format!("{:x}", Sha256::digest(&bytes));
        let manifest = serde_json::json!({
            "schemaVersion":1,"neuronCount":10,"edgeCount":0,"graphHash":hash,
            "bodyIds":(1..=10).map(|i|i.to_string()).collect::<Vec<_>>(),
            "motor":{"dnL":[8],"dnR":[9],"mnL":[],"mnR":[]},"pathways":{},
            "groups":[{"id":"visionL","label":"Left","indices":[5,6,7]},
                      {"id":"visionR","label":"Right","indices":[1,2,3]}],
            "groupLinks":[],"pathwayProvenance":"synthetic visual input test",
            "sources":[{"file":"body-annotations.feather","sha256":"0".repeat(64)}],
            "visionInput":{"graphHash":hash,"annotationHash":"0".repeat(64),"family":"synthetic",
                "registration":"synthetic directions", "entries":(0..8).map(|i|serde_json::json!({"index":i,"weights":(0..8).map(|b|if i==b {1.0}else{0.0}).collect::<Vec<_>>()})).collect::<Vec<_>>()}
        });
        (bytes, manifest)
    }
    fn vision_graph() -> Graph {
        let (bytes, manifest) = vision_fixture();
        Graph::from_bytes(&bytes, &manifest.to_string()).unwrap()
    }

    #[test]
    fn vision_preserves_all_eight_directions_and_brightness() {
        let graph = vision_graph();
        let mut sample = attractive(100., 0.);
        sample.vision.blocked = [100.; 8];
        for bin in 0..8 {
            sample.vision.brightness = [0.; 8];
            sample.vision.brightness[bin] = 0.5;
            let dim = cue_currents(&graph, &sample, CuePathway::Vision, 1.).unwrap();
            let expected: Vec<_> = (0..8)
                .map(|i| (i as u32, if i == bin { 0.5 } else { 0. }))
                .collect();
            assert_eq!(dim, expected);
            sample.vision.brightness[bin] = 2.;
            let bright = cue_currents(&graph, &sample, CuePathway::Vision, 1.).unwrap();
            assert_eq!(bright[bin], (bin as u32, 0.8));
            assert!(bright
                .iter()
                .all(|(index, value)| *index < 8 && *value <= 1.));
        }
    }
    #[test]
    fn overlapping_receptive_fields_combine_directions_without_exceeding_gain() {
        let (bytes, mut manifest) = vision_fixture();
        for i in 0..2 {
            manifest["visionInput"]["entries"][i]["weights"] =
                serde_json::json!([0.5, 0.5, 0., 0., 0., 0., 0., 0.]);
        }
        let graph = Graph::from_bytes(&bytes, &manifest.to_string()).unwrap();
        let mut sample = attractive(0., 0.);
        sample.vision.brightness = [0.5, 2., 0., 0., 0., 0., 0., 0.];
        let currents = cue_currents(&graph, &sample, CuePathway::Vision, 2.).unwrap();
        assert_eq!(currents[0], (0, 1.3));
        assert_eq!(currents[1], (1, 1.3));
        sample.vision.brightness = [f64::MAX; 8];
        assert!(cue_currents(&graph, &sample, CuePathway::Vision, 3.)
            .unwrap()
            .iter()
            .all(|(_, value)| *value <= 3. && value.is_finite()));
        sample.vision.brightness[2] = -1.;
        assert!(cue_currents(&graph, &sample, CuePathway::Vision, 1.).is_err());
    }

    #[test]
    fn visual_maps_reject_motor_targets_duplicate_channels_and_false_provenance() {
        let changes: [fn(&mut serde_json::Value); 11] = [
            |m| m["visionInput"]["entries"][0]["weights"][0] = serde_json::json!(2.),
            |m| m["visionInput"]["entries"][0]["weights"][0] = serde_json::json!(-1.),
            |m| m["sources"] = serde_json::Value::Null,
            |m| m["sources"][0]["sha256"] = serde_json::json!(123),
            |m| m["visionInput"]["entries"][0]["index"] = serde_json::json!(8),
            |m| m["visionInput"]["entries"][0]["index"] = serde_json::json!(1),
            |m| m["visionInput"]["entries"][0]["index"] = serde_json::json!(10),
            |m| m["visionInput"]["entries"] = serde_json::json!([]),
            |m| m["visionInput"]["entries"][0]["weights"][0] = serde_json::json!(0.5),
            |m| m["visionInput"]["graphHash"] = serde_json::json!("f".repeat(64)),
            |m| {
                m["sources"] =
                    serde_json::json!([{"file":"body-annotations.feather","sha256":"f".repeat(64)}])
            },
        ];
        for change in changes {
            let (bytes, mut manifest) = vision_fixture();
            change(&mut manifest);
            assert!(Graph::from_bytes(&bytes, &manifest.to_string()).is_err());
        }
        let mut sample = attractive(0., 0.);
        sample.vision.brightness = [0.; 8];
        assert!(
            cue_currents(&vision_graph(), &sample, CuePathway::Vision, 3.)
                .unwrap()
                .iter()
                .all(|(_, value)| *value == 0.)
        );
        let mut graph = vision_graph();
        graph.manifest.vision_input = None;
        assert!(cue_currents(&graph, &sample, CuePathway::Vision, 1.).is_err());
        assert!(cue_currents(&graph, &sample, CuePathway::Vision, 0.)
            .unwrap()
            .is_empty());
    }
}
