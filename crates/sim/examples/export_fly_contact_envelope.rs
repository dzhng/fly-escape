//! Offline derivative of the finite native animation hull; never linked into WASM.
use parry3d_f64::{math::Vector, query::PointQuery, shape::ConvexPolyhedron};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{error::Error, path::Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeHull {
    asset_sha256: String,
    vertices: Vec<[f64; 3]>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Envelope {
    asset_sha256: String,
    source_hull_sha256: String,
    provenance: String,
    supporting_planes: usize,
    measurements: Measurements,
    vertices: Vec<[f64; 3]>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Measurements {
    max_native_point_distance_metres: f64,
    max_outer_vertex_distance_metres: f64,
    native_axis_extrema_metres: [[f64; 3]; 2],
    candidate_axis_extrema_metres: [[f64; 3]; 2],
}

fn extrema(points: &[Vector]) -> [Vector; 2] {
    [
        points.iter().copied().reduce(Vector::min).unwrap(),
        points.iter().copied().reduce(Vector::max).unwrap(),
    ]
}

fn outer_hull(points: &[Vector], center: Vector, normals: &[Vector]) -> ConvexPolyhedron {
    let duals: Vec<_> = normals
        .iter()
        .map(|n| {
            *n / points
                .iter()
                .map(|p| n.dot(*p - center))
                .fold(f64::NEG_INFINITY, f64::max)
        })
        .collect();
    // Merged coplanar dual faces can discard primal detail and cut into the source.
    let (dual_points, triangles) = parry3d_f64::transformation::convex_hull(&duals);
    let [min, max] = extrema(points);
    let vertices: Vec<_> = triangles
        .into_iter()
        .map(|ids| {
            let [a, b, c] = ids.map(|i| dual_points[i as usize]);
            let normal = (b - a).cross(c - a);
            let mut vertex = center + normal / normal.dot(a);
            // Preserve incident source axis planes exactly, without outward padding.
            for id in ids {
                for (axis, dual) in duals.iter().take(6).enumerate() {
                    if dual_points[id as usize] == *dual {
                        vertex[axis / 2] = if axis % 2 == 0 {
                            max[axis / 2]
                        } else {
                            min[axis / 2]
                        };
                    }
                }
            }
            vertex
        })
        .collect();
    ConvexPolyhedron::from_convex_hull(&vertices).expect("bounded outer hull")
}

fn farthest(outer: &ConvexPolyhedron, native: &ConvexPolyhedron) -> (f64, Vector) {
    outer
        .points()
        .iter()
        .map(|p| {
            let delta = *p - native.project_local_point(*p, true).point;
            (delta.length(), delta)
        })
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .unwrap()
}

fn generate(source: &[u8], glb: &[u8]) -> Result<Envelope, Box<dyn Error>> {
    let input: NativeHull = serde_json::from_slice(source)?;
    if input.asset_sha256 != format!("{:x}", Sha256::digest(glb)) {
        return Err("native hull does not match GLB".into());
    }
    // Match the native query normalization; artifact coordinates remain metres.
    let points: Vec<_> = input
        .vertices
        .iter()
        .map(|p| Vector::from_array(*p) * 1000.)
        .collect();
    if points.iter().any(|p| !p.is_finite()) {
        return Err("nonfinite native point".into());
    }
    let native = ConvexPolyhedron::from_convex_hull(&points).ok_or("degenerate native hull")?;
    let center = points.iter().copied().sum::<Vector>() / points.len() as f64;
    let mut normals = vec![
        Vector::X,
        -Vector::X,
        Vector::Y,
        -Vector::Y,
        Vector::Z,
        -Vector::Z,
    ];
    while normals.len() < 128 {
        let outer = outer_hull(&points, center, &normals);
        let (distance, direction) = farthest(&outer, &native);
        if distance == 0. {
            return Err("source reached before plane budget".into());
        }
        normals.push(direction.normalize());
    }
    let outer = outer_hull(&points, center, &normals);
    let containment = points
        .iter()
        .map(|p| outer.distance_to_local_point(*p, true))
        .fold(0., f64::max);
    let outward = farthest(&outer, &native).0;
    let native_extrema = extrema(&points);
    let candidate_extrema = extrema(outer.points());
    // Numerical validation only: this allowance never moves a plane or query.
    let roundoff = 128. * f64::EPSILON * (native_extrema[1] - native_extrema[0]).length();
    if containment > roundoff || candidate_extrema != native_extrema {
        return Err("candidate lost containment or exact axis extrema".into());
    }
    Ok(Envelope {
        asset_sha256: input.asset_sha256,
        source_hull_sha256: format!("{:x}", Sha256::digest(source)),
        provenance: "adaptive supporting planes; unmerged polar triangles; exact incident axis extrema; Parry 0.30.2 enhanced-determinism; finite animation source; provisional candidate".into(),
        supporting_planes: normals.len(),
        measurements: Measurements {
            max_native_point_distance_metres: containment / 1000.,
            max_outer_vertex_distance_metres: outward / 1000.,
            native_axis_extrema_metres: native_extrema.map(|v| (v / 1000.).to_array()),
            candidate_axis_extrema_metres: candidate_extrema.map(|v| (v / 1000.).to_array()),
        },
        vertices: outer.points().iter().map(|v| (*v / 1000.).to_array()).collect(),
    })
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() != 3 {
        return Err(
            "Usage: export_fly_contact_envelope source-hull.json fly.glb candidate.json".into(),
        );
    }
    if Path::new(&args[0]).canonicalize()? == Path::new(&args[2]).canonicalize().unwrap_or_default()
    {
        return Err("candidate must not replace its source hull".into());
    }
    let envelope = generate(&std::fs::read(&args[0])?, &std::fs::read(&args[1])?)?;
    let mut bytes = serde_json::to_vec(&envelope)?;
    bytes.push(b'\n');
    std::fs::write(&args[2], bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derivative_preserves_native_containment_and_regenerates() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../assets/fly");
        let source = std::fs::read(root.join("contact-hull.json")).unwrap();
        let glb = std::fs::read(root.join("fly.glb")).unwrap();
        let generated = generate(&source, &glb).unwrap();
        let committed: Envelope = serde_json::from_slice(
            &std::fs::read(root.join("contact-envelope-candidate.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            serde_json::to_vec(&generated).unwrap(),
            serde_json::to_vec(&committed).unwrap()
        );
        let native: NativeHull = serde_json::from_slice(&source).unwrap();
        let points: Vec<_> = generated
            .vertices
            .iter()
            .map(|v| Vector::from_array(*v) * 1000.)
            .collect();
        let outer = ConvexPolyhedron::from_convex_hull(&points).unwrap();
        for point in native.vertices {
            assert!(outer.distance_to_local_point(Vector::from_array(point) * 1000., true) < 1e-10);
        }
        // The preparation target is a sub-10-micrometre outward representation,
        // not permission to add that distance to contact queries.
        assert!(generated.measurements.max_outer_vertex_distance_metres < 1e-5);
        assert_eq!(
            generated.measurements.native_axis_extrema_metres,
            generated.measurements.candidate_axis_extrema_metres
        );
    }
}
