//! Modeled sensory-to-current adapter; no motor or target-direction commands.
use crate::{environment::SensorySample, Graph};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum CuePathway {
    ExcitatoryOdor,
    InhibitoryOdor,
    Vision,
    None,
}

/// The measured chamber maps attractive odor and the room-local exit cue to
/// excitatory-labeled inputs and repellent odor to inhibitory-labeled inputs.
/// These source bindings are modeling assumptions, not universal biological
/// functions of excitation or inhibition.
/// How the winning side's field concentration becomes a delivered current.
///
/// `Binary` is the shipped adapter: the winner receives the full `gain`, so the
/// magnitude of the concentration is discarded once the contrast test passes.
/// `Saturating` is a scratch candidate only (see `SATURATION_HALF_CONCENTRATION`).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum OdorEncoding {
    #[default]
    Binary,
    Saturating,
}

/// Concentration at which `Saturating` delivers half of `gain`.
///
/// Measured, not guessed: with one banana at the final-room entrance the settled
/// attractive-odor field over reachable floor runs 0.04..1.18 with a median of 0.548
/// above the 0.05 detection floor (scent_scale_probe, /tmp/fly-scent-strength-results/scale.json).
/// Centring the curve on that median puts the level's own concentrations in the
/// encoding's most discriminating band instead of pinned near zero or near the gain.
/// The bounded monotone form is a MODELING ASSUMPTION about peripheral compression;
/// it is not validated Drosophila ORN physiology.
pub const SATURATION_HALF_CONCENTRATION: f64 = 0.55;

/// Local contrast selects sensory input. Side identity is retained;
/// whether a pathway attracts or repels is an empirical result, not a sign flip.
pub fn cue_currents(
    graph: &Graph,
    sample: &SensorySample,
    pathway: CuePathway,
    gain: f64,
) -> Result<Vec<(u32, f64)>, String> {
    cue_currents_with(graph, sample, pathway, gain, OdorEncoding::Binary)
}

/// `cue_currents` with an explicit amplitude encoding. Side selection, the contrast
/// detector, the readout exclusion and every sign are identical across encodings;
/// only the amplitude handed to the winning side differs.
pub fn cue_currents_with(
    graph: &Graph,
    sample: &SensorySample,
    pathway: CuePathway,
    gain: f64,
    encoding: OdorEncoding,
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
        CuePathway::Vision => (
            ["visionL", "visionR"],
            [sample.left.brightness, sample.right.brightness],
        ),
        CuePathway::None => return Ok(vec![]),
    };
    // A modeled lateral detector: local field contrast chooses the sensory
    // population, never a motor command or a direction to a remote target.
    // The 0.01% contrast floor is calibrated at anatomical spacing, not a biological threshold.
    let detected = values[0].max(values[1]) >= 0.05
        && (values[0] - values[1]).abs() > 0.0001 * (values[0] + values[1]);
    // The delivered amplitude for a detected side. Binary discards the magnitude;
    // Saturating maps the winner's own concentration through a bounded, strictly
    // increasing Michaelis-Menten curve: c/(c+K) rises with c and approaches 1.
    let amplitude = |concentration: f64| match encoding {
        OdorEncoding::Binary => 1.0,
        OdorEncoding::Saturating => {
            concentration / (concentration + SATURATION_HALF_CONCENTRATION)
        }
    };
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
            wind: Point::default(),
        };
        assert_eq!(
            cue_currents(&graph, &opposed, CuePathway::ExcitatoryOdor, 1.).unwrap(),
            vec![(0, 1.0), (1, 0.0), (2, 1.0)],
            "attractive odor drives the excitatory-labelled side that smells it more"
        );
        assert_eq!(
            cue_currents(&graph, &opposed, CuePathway::InhibitoryOdor, 1.).unwrap(),
            vec![(0, 0.0), (1, 1.0)],
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
            wind: Point::default(),
        };
        assert_eq!(
            cue_currents(&graph, &exit_only, CuePathway::ExcitatoryOdor, 1.).unwrap(),
            vec![(0, 1.0), (1, 0.0), (2, 1.0)],
            "the room-local exit cue adds into the same excitatory channel"
        );
        assert!(
            cue_currents(&graph, &exit_only, CuePathway::InhibitoryOdor, 1.)
                .unwrap()
                .iter()
                .all(|(_, current)| *current == 0.),
            "the exit cue must not leak into the repellent channel"
        );
    }
    /// Build a one-sided attractive-odor sample; the left antenna smells `left`.
    fn odor(left: f64, right: f64) -> SensorySample {
        SensorySample {
            left: FieldSample {
                attractive_odor: left,
                ..Default::default()
            },
            right: FieldSample {
                attractive_odor: right,
                ..Default::default()
            },
            wind: Point::default(),
        }
    }
    /// The delivered current on the winning excitatory side.
    fn delivered(graph: &Graph, sample: &SensorySample, gain: f64, encoding: OdorEncoding) -> f64 {
        let currents =
            cue_currents_with(graph, sample, CuePathway::ExcitatoryOdor, gain, encoding).unwrap();
        currents
            .iter()
            .map(|(_, current)| *current)
            .fold(0., f64::max)
    }

    /// The point of the candidate: a stronger smell must deliver a stronger current.
    /// The shipped binary adapter is the contrast, and delivers the same current to
    /// a barely-detected plume as to one twenty times stronger.
    #[test]
    fn saturating_encoding_grows_with_concentration_where_binary_is_flat() {
        let graph = fixture_graph();
        let concentrations = [0.05, 0.1, 0.2, 0.4, 0.8, 1.6];
        let currents: Vec<f64> = concentrations
            .iter()
            .map(|&c| delivered(&graph, &odor(c, 0.), 2., OdorEncoding::Saturating))
            .collect();
        for pair in currents.windows(2) {
            assert!(
                pair[1] > pair[0],
                "delivered current must strictly increase with concentration: {currents:?}"
            );
        }
        assert!(
            concentrations
                .iter()
                .all(|&c| delivered(&graph, &odor(c, 0.), 2., OdorEncoding::Binary) == 2.),
            "the shipped adapter delivers the full gain regardless of concentration"
        );
    }

    /// Bounded above by the gain, and compressing: the increments shrink as the
    /// concentration climbs, so the encoding cannot run away on a strong source.
    #[test]
    fn saturating_encoding_is_bounded_by_gain_and_compresses_at_high_concentration() {
        let graph = fixture_graph();
        let gain = 2.;
        let huge = delivered(&graph, &odor(1e6, 0.), gain, OdorEncoding::Saturating);
        assert!(
            huge < gain && huge > 0.999 * gain,
            "an overwhelming plume approaches but never exceeds the gain: {huge}"
        );
        // Past the half-saturation point the curve is concave, so doubling the
        // plume buys steadily less. Below it the encoding is still near-linear.
        let steps: Vec<f64> = (0..5)
            .map(|i| {
                let c = 2. * SATURATION_HALF_CONCENTRATION * 2f64.powi(i);
                delivered(&graph, &odor(c, 0.), gain, OdorEncoding::Saturating)
            })
            .collect();
        assert!(
            steps[0] > gain / 2.,
            "the sampled range must sit above half saturation: {steps:?}"
        );
        let increments: Vec<f64> = steps.windows(2).map(|p| p[1] - p[0]).collect();
        for pair in increments.windows(2) {
            assert!(
                pair[1] < pair[0],
                "each doubling must buy less current than the last: {increments:?}"
            );
        }
    }

    /// Only the amplitude changes. Which antenna wins, the contrast floor that
    /// decides whether anything is delivered at all, and the keep-out of motor
    /// readouts are shared with the shipped adapter.
    #[test]
    fn saturating_encoding_preserves_side_identity_and_the_detection_gate() {
        let graph = fixture_graph();
        let side = |sample| {
            cue_currents_with(
                &graph,
                &sample,
                CuePathway::ExcitatoryOdor,
                2.,
                OdorEncoding::Saturating,
            )
            .unwrap()
        };
        assert_eq!(
            side(odor(0.8, 0.2))
                .iter()
                .map(|(index, current)| (*index, *current > 0.))
                .collect::<Vec<_>>(),
            vec![(0, true), (1, false), (2, true)],
            "the louder antenna still drives its own labelled population"
        );
        assert_eq!(
            side(odor(0.2, 0.8))
                .iter()
                .map(|(index, current)| (*index, *current > 0.))
                .collect::<Vec<_>>(),
            vec![(0, false), (1, true), (2, true)],
            "mirroring the sample mirrors the driven side"
        );
        assert!(
            !side(odor(0.8, 0.2)).iter().any(|(index, _)| *index == 3),
            "a sensory/motor overlap must not directly drive a readout"
        );
        for (left, right) in [(0., 0.), (0.8, 0.8), (0.049, 0.), (0., 0.049)] {
            assert!(
                side(odor(left, right))
                    .iter()
                    .all(|(_, current)| *current == 0.),
                "undetected contrast delivers nothing under either encoding"
            );
        }
    }

    /// A scratch knob must stay off unless a probe asks for it.
    #[test]
    fn the_default_encoding_is_the_shipped_binary_adapter() {
        let graph = fixture_graph();
        let sample = odor(0.8, 0.2);
        assert_eq!(OdorEncoding::default(), OdorEncoding::Binary);
        assert_eq!(
            cue_currents(&graph, &sample, CuePathway::ExcitatoryOdor, 2.).unwrap(),
            cue_currents_with(
                &graph,
                &sample,
                CuePathway::ExcitatoryOdor,
                2.,
                OdorEncoding::Binary
            )
            .unwrap(),
            "cue_currents must keep delivering the binary encoding"
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
        let strong = FieldSample {
            attractive_odor: 0.8,
            ..Default::default()
        };
        let weak = FieldSample {
            attractive_odor: 0.2,
            ..Default::default()
        };
        let mut sample = SensorySample {
            left: strong,
            right: weak,
            wind: Point::default(),
        };
        let left = cue_currents(&graph, &sample, CuePathway::ExcitatoryOdor, 1.).unwrap();
        std::mem::swap(&mut sample.left, &mut sample.right);
        let right = cue_currents(&graph, &sample, CuePathway::ExcitatoryOdor, 1.).unwrap();
        assert_eq!(left, vec![(0, 1.0), (1, 0.0), (2, 1.0)]);
        assert_eq!(right, vec![(0, 0.0), (1, 1.0), (2, 1.0)]);
        assert!(
            !left.iter().any(|(i, _)| *i == 3),
            "a sensory/motor overlap must not directly drive a readout"
        );
        let anatomical = SensorySample {
            left: FieldSample {
                attractive_odor: 0.5002,
                ..Default::default()
            },
            right: FieldSample {
                attractive_odor: 0.5,
                ..Default::default()
            },
            wind: Point::default(),
        };
        assert_eq!(
            cue_currents(&graph, &anatomical, CuePathway::ExcitatoryOdor, 1.).unwrap(),
            vec![(0, 1.), (1, 0.), (2, 1.)],
            "resolved anatomical-scale gradient remains detectable"
        );
        for [left, right] in [[0., 0.], [0.8, 0.8], [0.049, 0.], [0., 0.049]] {
            let neutral = SensorySample {
                left: FieldSample {
                    attractive_odor: left,
                    ..Default::default()
                },
                right: FieldSample {
                    attractive_odor: right,
                    ..Default::default()
                },
                wind: Point::default(),
            };
            assert!(
                cue_currents(&graph, &neutral, CuePathway::ExcitatoryOdor, 1.)
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
}
