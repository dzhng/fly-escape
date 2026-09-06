use sim::environment::{FieldConfig, FieldSet, Geometry, Point};
use std::collections::BTreeSet;

#[test]
fn five_room_review_house_has_a_route_and_one_door_pantry() {
    let geometry: Geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json")).unwrap();
    FieldSet::new(geometry.clone(), FieldConfig::default(), vec![], None).unwrap();
    let mut links = BTreeSet::new();
    // Adjacent grid centers cross actual collision openings, not a second door map.
    for x in 0..64 {
        for z in 0..32 {
            let from = Point {
                x: x as f64 * 0.25 + 0.125,
                z: z as f64 * 0.25 + 0.125,
            };
            let Some(a) = geometry.room_at(from) else {
                continue;
            };
            for (dx, dz) in [(0.25, 0.), (0., 0.25)] {
                let to = Point {
                    x: from.x + dx,
                    z: from.z + dz,
                };
                let Some(b) = geometry.room_at(to) else {
                    continue;
                };
                if a != b && geometry.sweep(from, to, 0.1) == to {
                    links.insert((a.min(b), a.max(b)));
                }
            }
        }
    }
    assert_eq!(links, BTreeSet::from([(1, 2), (2, 3), (2, 5), (3, 4)]));
    let pantry = Point { x: 6., z: 6. };
    let hall = Point { x: 6., z: 2. };
    assert_eq!(geometry.sweep(pantry, hall, 0.1), hall);
    assert!(geometry.sweep(pantry, Point { x: 6., z: 9. }, 0.1).z < 8.);
    let beside_door = Point { x: 4.5, z: 3. };
    assert!(geometry.sweep(beside_door, Point { x: 4.5, z: 5. }, 0.1).z < 4.);
    let outside = Point { x: 17., z: 2. };
    assert_eq!(
        geometry.sweep(Point { x: 14., z: 2. }, outside, 0.1),
        outside
    );
}
