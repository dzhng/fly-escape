use parry3d_f64::{math::Vector,shape::ConvexPolyhedron};
fn main(){
let bytes=std::fs::read("/tmp/fly-native-hull-asset/assets/fly/contact-hull.json").unwrap();
let d:serde_json::Value=serde_json::from_slice(&bytes).unwrap();
let input:Vec<[f64;3]>=serde_json::from_value(d["vertices"].clone()).unwrap();
let hull=ConvexPolyhedron::from_convex_hull(&input.iter().map(|p|Vector::from_array(*p)*1000.).collect::<Vec<_>>()).unwrap();
let active:std::collections::BTreeSet<_>=hull.edges_adj_to_face().iter().copied().collect();
let (id,e)=hull.edges().iter().enumerate().find(|(_,e)|e.vertices.contains(&1084)&&e.vertices.contains(&1312)).unwrap();
let faces:Vec<_>=e.faces.iter().map(|&fi|{let f=&hull.faces()[fi as usize];let p=hull.points()[hull.vertices_adj_to_face()[f.first_vertex_or_edge as usize]as usize];let c=f.normal.dot(p);let ids=&hull.edges_adj_to_face()[f.first_vertex_or_edge as usize..(f.first_vertex_or_edge+f.num_vertices_or_edges)as usize];serde_json::json!({"face":fi,"containsEdgeIncidence":ids.contains(&(id as u32)),"maxPointHalfspaceViolationMm":hull.points().iter().map(|v|f.normal.dot(*v)-c).fold(0.,f64::max),"edgeEndpointPlaneResidualMm":e.vertices.map(|v|(f.normal.dot(hull.points()[v as usize])-c).abs()),"normal":f.normal.to_array()})}).collect();
println!("{}",serde_json::json!({"library":"parry3d-f64 0.30.2","asset":"assets/fly/contact-hull.json","queryScale":1000,"storedEdges":hull.edges().len(),"activeEdges":active.len(),"edgeId":id,"edgeVertices":e.vertices,"active":active.contains(&(id as u32)),"adjacentFaces":faces,"coneTripleProduct":hull.faces()[e.faces[0]as usize].normal.cross(hull.faces()[e.faces[1]as usize].normal).dot(e.dir)}));
}
