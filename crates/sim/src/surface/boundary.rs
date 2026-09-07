//! Prepared incidence is authoritative; never infer it from reconstructed hull faces.
use parry3d_f64::math::Vector;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactPlane {
    pub normal: [f64; 3],
    pub offset: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactEdge {
    pub vertices: [usize; 2],
    pub planes: [usize; 2],
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactBoundary {
    pub vertices: Vec<[f64; 3]>,
    pub planes: Vec<ContactPlane>,
    pub edges: Vec<ContactEdge>,
}
pub fn validate_boundary(
    vertices: &[[f64; 3]],
    planes: &[ContactPlane],
    edges: &[ContactEdge],
) -> Result<(), &'static str> {
    let points: Vec<_> = vertices.iter().map(|p| Vector::from_array(*p)).collect();
    if points.is_empty() || points.iter().any(|p| !p.is_finite()) {
        return Err("invalid boundary vertices");
    }
    let bounds = [
        points.iter().copied().reduce(Vector::min).unwrap(),
        points.iter().copied().reduce(Vector::max).unwrap(),
    ];
    let roundoff = 128. * f64::EPSILON * (bounds[1] - bounds[0]).length();
    let mut used = BTreeSet::new();
    for plane in planes {
        let normal = Vector::from_array(plane.normal);
        if !normal.is_finite()
            || !plane.offset.is_finite()
            || (normal.length() - 1.).abs() > 128. * f64::EPSILON
            || points
                .iter()
                .any(|p| normal.dot(*p) - plane.offset > roundoff)
        {
            return Err("invalid supporting plane");
        }
    }
    for edge in edges {
        if edge.vertices[0] == edge.vertices[1]
            || edge.planes[0] == edge.planes[1]
            || edge.vertices.iter().any(|i| *i >= points.len())
            || edge.planes.iter().any(|i| *i >= planes.len())
        {
            return Err("invalid boundary edge");
        }
        if Vector::from_array(planes[edge.planes[0]].normal)
            .cross(Vector::from_array(planes[edge.planes[1]].normal))
            .length_squared()
            == 0.
        {
            return Err("edge incident planes are parallel");
        }
        for vertex in edge.vertices {
            used.insert(vertex);
            for plane in edge.planes {
                if (Vector::from_array(planes[plane].normal).dot(points[vertex])
                    - planes[plane].offset)
                    .abs()
                    > roundoff
                {
                    return Err("edge leaves incident plane");
                }
            }
        }
    }
    if used.len() != points.len() || points.len() + planes.len() != edges.len() + 2 {
        return Err("boundary is not closed");
    }
    for plane in 0..planes.len() {
        let face: Vec<_> = edges.iter().filter(|e| e.planes.contains(&plane)).collect();
        let mut degrees = BTreeMap::new();
        for edge in &face {
            for v in edge.vertices {
                *degrees.entry(v).or_insert(0) += 1;
            }
        }
        if degrees.len() < 3 || degrees.values().any(|degree| *degree != 2) {
            return Err("face is not a cycle");
        }
        let mut connected = BTreeSet::from([*degrees.keys().next().unwrap()]);
        loop {
            let before = connected.len();
            for edge in &face {
                if edge.vertices.iter().any(|v| connected.contains(v)) {
                    connected.extend(edge.vertices);
                }
            }
            if connected.len() == before {
                break;
            }
        }
        if connected.len() != degrees.len() {
            return Err("face has disconnected cycles");
        }
    }
    Ok(())
}
