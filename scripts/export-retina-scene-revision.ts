import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const sceneRevisionPath = "packages/game-renderer/src/retina-scene-revision.json";
const entrypoints = ["packages/game-renderer/package.json", "packages/game-renderer/src/retina-world.ts"];
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function runtimeImports(path: string, source: string): string[] {
  const imports: string[] = [];
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || (!clause?.name && named && ts.isNamedImports(named)
        && named.elements.length > 0 && named.elements.every(element => element.isTypeOnly));
      if (!onlyTypes && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const onlyTypes = node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly);
      if (!onlyTypes) imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (!argument || !ts.isStringLiteralLike(argument)) throw new Error(`Nonliteral dynamic import in ${path}`);
      imports.push(argument.text);
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "URL"
      && node.arguments?.[1]?.getText(tree) === "import.meta.url") {
      const argument = node.arguments[0];
      if (!ts.isStringLiteralLike(argument)) throw new Error(`Nonliteral asset URL in ${path}`);
      imports.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return imports;
}

/** Conservative scene provenance, separate from retinal optics and per-scene authoring. */
export async function createSceneRevision(root: string, roots: readonly string[] = entrypoints) {
  const base = resolve(root);
  const files = new Map<string, string>();
  function localPath(path: string): string {
    const local = relative(base, resolve(base, path));
    if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) throw new Error(`Scene dependency escapes repository: ${path}`);
    return local.split(sep).join("/");
  }
  async function collect(path: string): Promise<void> {
    path = localPath(path);
    if (path === sceneRevisionPath || files.has(path)) return;
    const bytes = await readFile(resolve(base, path));
    files.set(path, hash(bytes));
    if (![".ts", ".tsx", ".js", ".mjs"].includes(extname(path))) return;
    for (const specifier of runtimeImports(path, bytes.toString("utf8"))) {
      if (!specifier.startsWith(".")) {
        // External runtime implementations are pinned conservatively by the lockfile and patches.
        if (specifier.startsWith("@fly-escape/")) throw new Error(`Use a direct source dependency for scene provenance: ${specifier} in ${path}`);
        continue;
      }
      const target = resolve(base, dirname(path), specifier.split(/[?#]/)[0]);
      const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, resolve(target, "index.ts"), resolve(target, "index.tsx")];
      let found: string | undefined;
      for (const candidate of candidates) {
        if (await stat(candidate).then(info => info.isFile(), () => false)) { found = candidate; break; }
      }
      if (!found) throw new Error(`Missing scene dependency ${specifier} imported by ${path}`);
      await collect(found);
    }
  }
  // Lock/package edits may over-invalidate but cannot silently reuse a previous graphics pipeline.
  await collect("package.json");
  await collect("bun.lock");
  const packageInfo = JSON.parse(await readFile(resolve(base, "package.json"), "utf8")) as { patchedDependencies?: Record<string, string> };
  for (const patch of Object.values(packageInfo.patchedDependencies ?? {})) await collect(patch);
  for (const path of roots) await collect(path);
  const provenance = { schema: 1, files: [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, sha256]) => ({ path, sha256 })) };
  return { schema: provenance.schema, revision: hash(JSON.stringify(provenance)), files: provenance.files };
}

if (import.meta.main) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const manifest = await createSceneRevision(root);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const destination = resolve(root, sceneRevisionPath);
  if (process.argv.slice(2).includes("--check")) {
    if (await readFile(destination, "utf8") !== serialized) throw new Error("Scene revision is stale; run bun scripts/export-retina-scene-revision.ts");
  } else {
    await writeFile(destination, serialized);
  }
  console.log(`Scene revision ${manifest.revision} (${manifest.files.length} dependencies)`);
}
