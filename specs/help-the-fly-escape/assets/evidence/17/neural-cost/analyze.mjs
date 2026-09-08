// Aggregate a .cpuprofile into self-time by function and by subsystem bucket.
import { readFileSync } from 'node:fs';
const profile = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const self = new Map();
for (const n of profile.nodes) {
  const key = n.callFrame.functionName || `(anon)${n.callFrame.url}`;
  self.set(key, (self.get(key) || 0) + (n.hitCount || 0));
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
const bucket = (n) => {
  if (/compiler_builtins::math|^fmax$|^fmin$|^pow$|^exp$|^log$/.test(n)) return 'neural: Box-Muller trig (software libm)';
  if (/lif::Brain::step/.test(n)) return 'neural: Brain::step (noise loop + advance, inlined)';
  if (/lif::|Graph::pathway/.test(n)) return 'neural: other';
  if (/sim::sensory|environment::fields|FieldSet/.test(n)) return 'field/sensory';
  if (/sim::surface|parry3d|nalgebra|simba|ConvexPolyhedron|TriMesh|contact_hazards|Body::contacts/.test(n)) return 'contact/geometry';
  if (/sim::body|motion/.test(n)) return 'body/motion';
  if (/sim::record|AttemptChunk|encode/.test(n)) return 'record';
  if (/serde|json|Serializer|Deserializer/.test(n)) return 'serde-json';
  if (/attempt::Attempt|game_wasm|AttemptSession/.test(n)) return 'attempt glue';
  if (/malloc|free|alloc::|memcpy|memset|dlmalloc|RawVec/.test(n)) return 'alloc/memory';
  if (/^\(program\)|^\(idle\)|^\(garbage|^\(root\)/.test(n)) return 'v8 overhead';
  return 'other';
};
const buckets = new Map();
for (const [name, hits] of self) buckets.set(bucket(name), (buckets.get(bucket(name)) || 0) + hits);
const pct = (h) => +(100 * h / total).toFixed(2);
console.log('total samples', total, 'interval(us)', profile.timeDeltas ? 'see run' : '');
console.log('--- buckets ---');
for (const [b, h] of [...buckets].sort((a, b2) => b2[1] - a[1])) console.log(String(pct(h)).padStart(6), '%', String(h).padStart(7), b);
console.log('--- top functions (self) ---');
for (const [n, h] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[3] ?? 18))) {
  console.log(String(pct(h)).padStart(6), '%', String(h).padStart(7), n.replace(/::h[0-9a-f]{16}$/, '').slice(0, 110));
}
