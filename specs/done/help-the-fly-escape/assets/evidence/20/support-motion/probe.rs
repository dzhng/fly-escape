use serde_json::json;
use sim::surface::{ContactHull, ContactScene, ContactSurface};
fn main() {
    let data: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(std::env::args().nth(1).expect("hull JSON path")).unwrap(),
    )
    .unwrap();
    let points: Vec<[f64; 3]> = serde_json::from_value(data["vertices"].clone()).unwrap();
    let hull = ContactHull::new(&points).unwrap();
    let floor = ContactSurface {
        id: 256,
        vertices: vec![[-1., 0., -1.], [1., 0., -1.], [1., 0., 1.], [-1., 0., 1.]],
        triangles: vec![[0, 2, 1], [0, 3, 2]],
    };
    let apple: ContactSurface = serde_json::from_str(
        &std::fs::read_to_string(std::env::args().nth(2).expect("apple JSON path")).unwrap(),
    )
    .unwrap();
    for (name, surfaces) in [("floor", vec![floor]), ("apple", vec![apple])] {
        let scene = ContactScene::new(&surfaces).unwrap();
        for x in [-0.03, 0., 0.03] {
            let hit = scene
                .cast(&hull, [x, 0.2, 0.], 0., [0., 1., 0.], [0., -0.3, 0.])
                .unwrap()
                .unwrap();
            let root = [
                x,
                if name == "floor" && std::env::args().any(|arg| arg == "--exact-floor") {
                    -points.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min)
                } else {
                    0.2 - 0.3 * hit.fraction
                },
                0.,
            ];
            let mut moves = vec![];
            for delta in [
                [0.001, 0., 0.],
                [-0.001, 0., 0.],
                [0., 0.001, 0.],
                [0., -0.001, 0.],
                [0., 0., 0.001],
            ] {
                moves.push(json!({"delta":delta,"hit":scene.cast(&hull,root,0.,[0.,1.,0.],delta)}));
            }
            println!(
                "{}",
                json!({"surface":name,"x":x,"root":root,"landing":hit,"moves":moves})
            );
        }
    }
}
