# Shading seams must not open contact geometry

The banana's flat cap normals split its GLB into 5,001 attribute vertices at
4,842 distinct positions. The original contact exporter preserved those separate
indices, leaving 240 unpaired edges. The prepared geometric skin was closed,
but the query owner classified its indexed contact mesh as open. A root supported
by a diagnostic patch wholly inside the banana incorrectly returned `End` instead
of an immediate `OtherSurface` stop. That actual consumer regression was red before
the exporter change and green afterward.

The shared exporter now interns exactly equal transformed positions across
primitives, validates local indices before remapping, and preserves every triangle
and its winding. The canonical banana has 4,842 vertices, 9,680 triangles and zero
unpaired edges. Expanding every indexed triangle before/after gives identical
coordinate triples. No tolerance, coordinate adjustment, triangle removal or
overlap repair is introduced. The earlier split-index bake remains preserved in
the banana terminal evidence as the failed input.

Both actual asset CLI reproductions pass; the apple output remains byte-identical.
The asset checks are part of the default test command. All ten support-path
consumer tests and eleven surface tests pass, along with a strict targeted
TypeScript check. Independent source review found no index, geometry-preservation
or ownership defect, independently reran both CLI tests and checked the closed
banana edge inventory. Exact coincident separate components also share geometric
identity; duplicate/overlapping faces remain for downstream topology validation
to reject. The existing closed-food restriction is unchanged.

This prepares the banana for contact evaluation. It does not register food,
accept moving contact, or change the currently upright/null-support game body.
