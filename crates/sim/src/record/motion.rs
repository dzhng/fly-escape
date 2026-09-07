use super::NO_SUPPORT;
use crate::body::{BodyMode, BodyPose, MotionPoint, MotionTrace, MAX_MOTION_POINTS};
use crate::environment::Point;

pub(super) const VALUE_FIELDS: [&str; 9] = [
    "fraction",
    "x",
    "z",
    "heading",
    "height",
    "rotationX",
    "rotationY",
    "rotationZ",
    "rotationW",
];
pub(super) const STATE_FIELDS: [&str; 2] = ["support", "grounded"];
pub(super) const SAMPLE_FIELDS: [&str; 8] = [
    "x",
    "z",
    "heading",
    "height",
    "rotationX",
    "rotationY",
    "rotationZ",
    "rotationW",
];
pub(super) const POINT_BYTES: u64 = (VALUE_FIELDS.len() * 8 + STATE_FIELDS.len() * 4) as u64;

pub(super) fn encode(
    points: &[MotionPoint],
    values: &mut Vec<f64>,
    states: &mut Vec<u32>,
) -> Result<(), String> {
    validate(points)?;
    for p in points {
        values.extend([
            p.fraction,
            p.pose.position.x,
            p.pose.position.z,
            p.pose.heading,
            p.height,
        ]);
        values.extend(p.rotation);
        states.extend([p.support.unwrap_or(NO_SUPPORT), u32::from(p.grounded)]);
    }
    Ok(())
}

fn validate(points: &[MotionPoint]) -> Result<(), String> {
    if !(2..=MAX_MOTION_POINTS).contains(&points.len())
        || points[0].fraction != 0.
        || points.last().unwrap().fraction != 1.
        || points.windows(2).any(|p| p[0].fraction >= p[1].fraction)
        || points.iter().any(|p| {
            ![
                p.fraction,
                p.pose.position.x,
                p.pose.position.z,
                p.pose.heading,
                p.height,
            ]
            .into_iter()
            .chain(p.rotation)
            .all(f64::is_finite)
                || super::validate_support(
                    p.support,
                    p.rotation,
                    if p.grounded {
                        BodyMode::Walking
                    } else {
                        BodyMode::Flying
                    },
                )
                .is_err()
        })
    {
        return Err("invalid recorded motion trajectory".into());
    }
    Ok(())
}

pub(super) fn decode(values: &[f64], states: &[u32]) -> Result<Vec<MotionPoint>, String> {
    if !values.len().is_multiple_of(VALUE_FIELDS.len())
        || states.len() != values.len() / VALUE_FIELDS.len() * STATE_FIELDS.len()
    {
        return Err("invalid motion buffer lengths".into());
    }
    let mut points = Vec::with_capacity(values.len() / VALUE_FIELDS.len());
    for (v, s) in values
        .chunks_exact(VALUE_FIELDS.len())
        .zip(states.chunks_exact(STATE_FIELDS.len()))
    {
        if s[1] > 1 {
            return Err("invalid motion grounded flag".into());
        }
        points.push(MotionPoint {
            fraction: v[0],
            pose: BodyPose {
                position: Point { x: v[1], z: v[2] },
                heading: v[3],
            },
            height: v[4],
            rotation: [v[5], v[6], v[7], v[8]],
            support: (s[0] != NO_SUPPORT).then_some(s[0]),
            grounded: s[1] != 0,
        });
    }
    validate(&points)?;
    Ok(points)
}

pub(super) fn validate_offsets(
    offsets: &[u32],
    values: &[f64],
    states: &[u32],
    records: usize,
) -> Result<(), String> {
    if offsets.len() != records + 1
        || offsets.first() != Some(&0)
        || offsets
            .last()
            .is_none_or(|&n| n as usize > records * MAX_MOTION_POINTS)
        || offsets
            .last()
            .copied()
            .map(|n| n as usize * VALUE_FIELDS.len())
            != Some(values.len())
        || values.len() / VALUE_FIELDS.len() * STATE_FIELDS.len() != states.len()
        || offsets
            .windows(2)
            .any(|p| p[1] < p[0] || !(2..=MAX_MOTION_POINTS).contains(&((p[1] - p[0]) as usize)))
    {
        return Err("invalid motion offsets".into());
    }
    Ok(())
}

/// Samples only recorded numeric trajectories; no world, contact queries or brain state.
pub fn sample_motion(
    values: &[f64],
    states: &[u32],
    offsets: &[u32],
    fraction: f64,
) -> Result<Vec<f64>, String> {
    if !(2..=101).contains(&offsets.len()) {
        return Err("motion batch requires 1..100 flies".into());
    }
    validate_offsets(offsets, values, states, offsets.len() - 1)?;
    let mut output = Vec::with_capacity((offsets.len() - 1) * SAMPLE_FIELDS.len());
    for pair in offsets.windows(2) {
        let a = pair[0] as usize;
        let b = pair[1] as usize;
        let points = decode(
            &values[a * VALUE_FIELDS.len()..b * VALUE_FIELDS.len()],
            &states[a * STATE_FIELDS.len()..b * STATE_FIELDS.len()],
        )?;
        let p = MotionTrace { points, queries: 0 }.at(fraction)?;
        output.extend([
            p.pose.position.x,
            p.pose.position.z,
            p.pose.heading,
            p.height,
        ]);
        output.extend(p.rotation);
    }
    Ok(output)
}
