use parry3d_f64::{math::{Pose, Vector}, shape::{Ball, Shape, TriMesh, TriMeshFlags}, query::{cast_shapes, ShapeCastOptions}};
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;
const R: f64 = 0.002632;
const QUERY_UNITS: f64 = 1000.;
fn cast(shape: &dyn Shape, transform: Pose, start: Vector, end: Vector) -> Option<Value> {
    let mut transform = transform;
    transform.translation *= QUERY_UNITS;
    let hit = cast_shapes(&Pose::from_translation(start*QUERY_UNITS), (end-start)*QUERY_UNITS, &Ball::new(R*QUERY_UNITS),
        &transform, Vector::ZERO, shape,
        ShapeCastOptions { max_time_of_impact:1., stop_at_penetration:false, ..Default::default() }).unwrap()?;
    let point = (transform * hit.witness2)/QUERY_UNITS;
    Some(json!({"fraction":hit.time_of_impact,"position":(start+(end-start)*hit.time_of_impact).to_array(),
        "point":point.to_array(),"normal":(transform.rotation * hit.normal2).to_array(),"status":format!("{:?}",hit.status)}))
}
fn near(a: f64, b: f64) { assert!((a-b).abs()<1e-9,"{a} differs from {b}"); }
fn component(v: &Value, name: &str, i: usize) -> f64 { v[name][i].as_f64().unwrap() }
fn run() -> Value {
    let apple = Ball::new(0.04*QUERY_UNITS);
    let pose = Pose::translation(0.,0.04,0.);
    let mut cases = vec![];
    for (name, start, end, expected) in [
        ("land", Vector::new(0.,0.2,0.),Vector::new(0.,-0.1,0.),Some((0.2-0.08-R)/0.3)),
        ("through",Vector::new(-0.2,0.04,0.),Vector::new(0.2,0.04,0.),Some((0.2-0.04-R)/0.4)),
        ("miss",Vector::new(-0.2,0.2,0.),Vector::new(0.2,0.2,0.),None),
        ("depart",Vector::new(0.,0.08+R,0.),Vector::new(0.,0.2,0.),None),
        ("return",Vector::new(0.,0.2,0.),Vector::new(0.,0.04,0.),Some((0.2-0.08-R)/0.16)),
        ("touch-inward",Vector::new(0.,0.08+R,0.),Vector::new(0.,0.04,0.),Some(0.)),
        ("penetrating-inward",Vector::new(0.,0.08,0.),Vector::new(0.,0.04,0.),Some(0.)),
        ("penetrating-outward",Vector::new(0.,0.08,0.),Vector::new(0.,0.2,0.),None),
    ] {
        let hit=cast(&apple,pose,start,end);
        assert_eq!(hit.is_some(),expected.is_some(),"{name}");
        if let Some(t)=expected { near(hit.as_ref().unwrap()["fraction"].as_f64().unwrap(),t); }
        for _ in 0..100 { assert_eq!(cast(&apple,pose,start,end),hit,"repeat {name}"); }
        cases.push(json!({"case":name,"hit":hit}));
    }
    let floor=TriMesh::new(vec![Vector::new(-1000.,0.,-1000.),Vector::new(1000.,0.,-1000.),Vector::new(1000.,0.,1000.),Vector::new(-1000.,0.,1000.)],vec![[0,2,1],[0,3,2]]).unwrap();
    let h=cast(&floor,Pose::IDENTITY,Vector::new(0.,0.2,0.),Vector::new(0.,-0.2,0.)).unwrap();
    near(component(&h,"point",1),0.);near(component(&h,"position",1),R);near(component(&h,"normal",1),1.);
    cases.push(json!({"case":"floor-mesh","hit":h}));
    let mut ordered = vec![];
    for reversed in [false,true] {
        let mut surfaces: Vec<(&str,&dyn Shape,Pose)> = vec![("floor",&floor,Pose::IDENTITY),("apple-b",&apple,pose),("apple-a",&apple,pose)];
        if reversed { surfaces.reverse(); }
        let mut hits: Vec<_> = surfaces.into_iter().filter_map(|(id,shape,pose)|cast(shape,pose,Vector::new(0.,0.2,0.),Vector::new(0.,-0.2,0.)).map(|hit|(id,hit))).collect();
        hits.sort_by(|(a,ha),(b,hb)|ha["fraction"].as_f64().unwrap().total_cmp(&hb["fraction"].as_f64().unwrap()).then(a.cmp(b)));
        assert_eq!(hits[0].0,"apple-a");
        ordered.push(json!({"id":hits[0].0,"hit":hits[0].1}));
    }
    assert_eq!(ordered[0],ordered[1]);
    cases.push(json!({"case":"scene-first-contact-order","selected":ordered[0]}));
    // A closed indexed curved mesh, translated into world metres; no procedural height correction.
    let (vertices, indices)=apple.to_trimesh(32,16);
    let mesh=TriMesh::with_flags(vertices,indices,TriMeshFlags::ORIENTED | TriMeshFlags::FIX_INTERNAL_EDGES).unwrap();
    for x in [-0.03,-0.015,0.,0.015,0.03] {
        let start=Vector::new(x,0.2,0.);
        let end=Vector::new(x,-0.1,0.);
        let h=cast(&mesh,pose,start,end).unwrap();
        let y=component(&h,"position",1);
        assert!(y>0.04 && y<=0.08+R+1e-9);
        assert!(component(&h,"normal",1)>0.5);
        let t=h["fraction"].as_f64().unwrap();
        // Split the same segment before contact: world hit position must agree.
        let split=start+(end-start)*(t*0.5);
        let again=cast(&mesh,pose,split,end).unwrap();
        for i in 0..3 { near(component(&again,"position",i),component(&h,"position",i)); }
        let landed = Vector::new(component(&h,"position",0),component(&h,"position",1),component(&h,"position",2));
        let away = cast(&mesh,pose,landed,landed+Vector::Y*0.1);
        assert!(away.is_none(), "mesh departure at {x}: {away:?}");
        cases.push(json!({"case":"curved-mesh-land","x":x,"hit":h,"departure":away}));
    }
    json!({"querySubject":"test ball; not adopted fly shape","radius":R,"queryUnitsPerMetre":QUERY_UNITS,"cases":cases})
}
#[wasm_bindgen]
pub fn report() -> String { serde_json::to_string(&run()).unwrap() }
#[test]
fn native_reproduction() { run(); }
