import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, cp, readdir, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../..", import.meta.url));
const baseline = resolve(process.env.RETINAL_BASELINE_CORE ?? "/tmp/fly-retinal-baseline-core");
const scratch = resolve(process.env.RETINAL_BASELINE_BUILD ?? "/tmp/fly-retinal-baseline-build");
const site = resolve(process.env.RETINAL_BASELINE_SITE ?? "/tmp/fly-retinal-baseline-site");
const git = (cwd, ...args) => execFileSync("git", args, {cwd,encoding:"utf8"}).trim();
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const currentRevision = git(root,"rev-parse","HEAD");
const revision = git(root,"rev-parse","88813fe5c552e42269ba63858fe0e0057fbfcb43^{commit}");
if (!existsSync(baseline)) execFileSync("git",["worktree","add","--detach",baseline,revision],{cwd:root,stdio:"inherit"});
if (git(baseline,"rev-parse","HEAD") !== revision || git(baseline,"status","--porcelain","--untracked-files=no"))
  throw Error("Baseline worktree must be a clean detached 88813fe checkout");
if (git(root,"diff","--name-only","HEAD","--","crates","packages","apps/web/src","assets","patches","Cargo.lock","bun.lock"))
  throw Error("Commit production changes before building comparative evidence");
await mkdir(scratch,{recursive:true});
// Both WASMs are built from their own untouched source; no tree-shaken site exports are reused.
for (const cwd of [baseline,root]) {
  execFileSync("bun",["install","--frozen-lockfile"],{cwd,stdio:"inherit"});
  execFileSync("bun",["run","build:wasm"],{cwd,stdio:"inherit"});
}
const original = execFileSync("git",["show",`${revision}:packages/sim-client/src/attempt-worker.ts`],{cwd:root,encoding:"utf8"});
const once = (text,from,to) => {
  if (text.split(from).length !== 2) throw Error(`Pinned worker patch no longer matches: ${from}`);
  return text.replace(from,to);
};
let worker = once(original,'from "./wasm/game_wasm"',`from ${JSON.stringify(join(baseline,"packages/sim-client/src/wasm/game_wasm.js"))}`);
worker = once(worker,'fetch("/brain/graph.bin")','fetch("/baseline-brain/graph.bin")');
worker = once(worker,'fetch("/brain/manifest.json")','fetch("/baseline-brain/manifest.json")');
await writeFile(join(scratch,"baseline-worker.ts"),worker);
let control = `import { configureCaptureControl, beforeBaselineStep, captureControlReport } from ${JSON.stringify(join(root,"tests/browser/retinal-baseline-control.ts"))};\n` + worker;
control = once(control,'        status = JSON.parse(run.core.step()) as AttemptStep;',
  '        await beforeBaselineStep();\n        if (active !== run) return;\n        status = JSON.parse(run.core.step()) as AttemptStep;');
control = once(control,'  const message = event.data;',`  const message = event.data;
  if (message.type === "baselineCaptureConfig") {
    try { await configureCaptureControl(message); self.postMessage({type:"baselineCaptureReady"}); }
    catch (error) { self.postMessage({type:"baselineCaptureError",message:String(error)}); }
    return;
  }`);
control = once(control,'        send({ type: "complete", attemptId: run.id, result });',
  '        self.postMessage({type:"baselineCaptureDone",report:captureControlReport()});\n        send({ type: "complete", attemptId: run.id, result });');
await writeFile(join(scratch,"capture-worker.ts"),control);
const currentWorker = relative(await realpath(scratch),join(root,"packages/sim-client/src/attempt-worker.ts"));
await writeFile(join(scratch,"entry.ts"),`import { runBaselineComparison } from ${JSON.stringify(join(root,"tests/browser/retinal-baseline-page.ts"))};
const q=new URLSearchParams(location.search);
window.retinalBaseline={done:false};
runBaselineComparison({
 baseline:()=>new Worker(new URL("./baseline-worker.ts",import.meta.url),{type:"module"}),
 captureOnly:()=>new Worker(new URL("./capture-worker.ts",import.meta.url),{type:"module"}),
 final:()=>new Worker(new URL(${JSON.stringify(currentWorker)},import.meta.url),{type:"module"})
},Number(q.get("level")),Number(q.get("ticks"))).then(report=>window.retinalBaseline={done:true,report},error=>window.retinalBaseline={done:true,error:String(error)});`);
await writeFile(join(scratch,"index.html"),'<!doctype html><meta charset="utf-8"><title>Retinal baseline control</title><p>Worker production and exact capture-only control.</p><script type="module" src="./entry.ts"></script>');
const { build } = await import(join(root,"apps/web/node_modules/vite/dist/node/index.js"));
await build({configFile:join(root,"apps/web/vite.config.ts"),root:scratch,publicDir:false,
  build:{outDir:site,emptyOutDir:true,rollupOptions:{input:join(scratch,"index.html")}}});
await cp(join(baseline,"data/processed/brain"),join(site,"baseline-brain"),{recursive:true});
await cp(join(root,"data/processed/brain"),join(site,"brain"),{recursive:true});
async function sourceIdentity(cwd) {
  const files=git(cwd,"ls-files").split("\n").filter(path=>/^(crates\/|packages\/|apps\/web\/src\/|assets\/|patches\/|Cargo\.|bun.lock$|package.json$|rust-toolchain)/.test(path));
  const hashes={};
  for (const path of files) hashes[path]=hash(await readFile(join(cwd,path)));
  return {revision:git(cwd,"rev-parse","HEAD"),sourceHash:hash(JSON.stringify(hashes)),files:hashes,
    graphHash:hash(await readFile(join(cwd,"data/processed/brain/graph.bin"))),
    manifestHash:hash(await readFile(join(cwd,"data/processed/brain/manifest.json"))),
    wasmHash:hash(await readFile(join(cwd,"packages/sim-client/src/wasm/game_wasm_bg.wasm")))};
}
async function treeHashes(directory,prefix="") {
  const result={};
  for (const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const name=prefix+entry.name,path=join(directory,entry.name);
    if(entry.isDirectory()) Object.assign(result,await treeHashes(path,name+"/"));
    else result[name]=hash(await readFile(path));
  }
  return result;
}
if (git(root,"rev-parse","HEAD") !== currentRevision || git(root,"diff","--name-only","HEAD","--","crates","packages","apps/web/src","assets","patches","Cargo.lock","bun.lock"))
  throw Error("Production source changed during the comparative build");
const manifest={baseline:await sourceIdentity(baseline),current:await sourceIdentity(root),
  originalWorkerHash:hash(original),baselineWorkerHash:hash(worker),captureWorkerHash:hash(control),
  harnessSources:Object.fromEntries(await Promise.all((await readdir(join(root,"tests/browser"))).filter(name=>name.startsWith("retinal-baseline-")).sort().map(async name=>[name,hash(await readFile(join(root,"tests/browser",name)))]))),
  buildCommand:"bun tests/browser/retinal-baseline-build.mjs",toolchain:{bun:execFileSync("bun",["--version"],{encoding:"utf8"}).trim(),rust:execFileSync("rustc",["--version"],{cwd:root,encoding:"utf8"}).trim()},
  outputFiles:await treeHashes(site)};
manifest.buildHash=hash(JSON.stringify(manifest));
await writeFile(join(site,"build-identity.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({site,buildHash:manifest.buildHash,baseline:manifest.baseline.revision,current:manifest.current.revision}));
