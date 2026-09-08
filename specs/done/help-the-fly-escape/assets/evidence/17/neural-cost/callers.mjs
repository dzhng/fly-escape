// Attribute a function's self samples to its callers (parent chain) in a .cpuprofile.
import { readFileSync } from 'node:fs';
const profile = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const target = new RegExp(process.argv[3]);
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const name = (id) => (byId.get(id)?.callFrame.functionName || '?').replace(/::h[0-9a-f]{16}$/, '');
const agg = new Map();
let total = 0;
for (const n of profile.nodes) {
  if (!target.test(n.callFrame.functionName || '') || !n.hitCount) continue;
  total += n.hitCount;
  const chain = [];
  let id = parent.get(n.id);
  while (id !== undefined && chain.length < 6) { chain.push(name(id)); id = parent.get(id); }
  const key = chain.join(' <- ') || '(root)';
  agg.set(key, (agg.get(key) || 0) + n.hitCount);
}
console.log(`target ${process.argv[3]} self samples ${total}`);
for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(String(+(100 * v / total).toFixed(1)).padStart(6), '%', String(v).padStart(6), k.slice(0, 160));
