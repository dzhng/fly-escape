import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Read an offline clean snapshot: never ask InspectorDOMAgent to retain detached DOM.
const heap = JSON.parse(await readFile(process.argv[2], "utf8"));
const { nodes, edges, strings } = heap;
const { node_fields: nf, edge_fields: ef, node_types: nt, edge_types: et } = heap.snapshot.meta;
const N = nf.length, E = ef.length;
const nameIndex = nf.indexOf("name"), countIndex = nf.indexOf("edge_count");
const edgeName = ef.indexOf("name_or_index"), edgeTo = ef.indexOf("to_node");
const outgoing = new Map();
let cursor = 0;
for (let i = 0; i < nodes.length; i += N) {
  const list = [];
  for (let end = cursor + nodes[i + countIndex] * E; cursor < end; cursor += E) {
    const kind = et[0][edges[cursor]];
    list.push({ kind, name: ["element", "hidden"].includes(kind) ? edges[cursor + edgeName] : strings[edges[cursor + edgeName]], to: edges[cursor + edgeTo] });
  }
  outgoing.set(i, list);
}
const property = (node, name) => outgoing.get(node)?.find(edge => edge.kind === "property" && edge.name === name)?.to;
const luts = [...outgoing.keys()].filter(node => {
  const name = property(node, "name");
  return name !== undefined && strings[nodes[name + nameIndex]] === "DFG_LUT";
});
const textures = luts.map(node => {
  const listeners = property(property(node, "_listeners"), "dispose");
  return { id: nodes[node + nf.indexOf("id")], listeners: outgoing.get(listeners)?.filter(edge => edge.kind === "element").length ?? 0 };
});
const canvases = [...outgoing.keys()].filter(node => nt[0][nodes[node]] === "native" && strings[nodes[node + nameIndex]].startsWith('<canvas data-engine="three.js'));
const report = {
  textures, listenerCount: textures.reduce((sum, texture) => sum + texture.listeners, 0),
  detachedWorldCanvases: canvases.filter(node => nodes[node + nf.indexOf("detachedness")] === 2).length,
  attachedWorldCanvases: canvases.filter(node => nodes[node + nf.indexOf("detachedness")] === 1).length,
};
console.log(JSON.stringify(report, null, 2));
if (process.env.HEAP_ASSERT_STABLE === "1") {
  assert.equal(report.listenerCount, 1, "only the current renderer may retain a DFG LUT disposal listener");
  assert.equal(report.detachedWorldCanvases, 0, "retired world canvases must be collectible");
  assert.equal(report.attachedWorldCanvases, 1);
}
