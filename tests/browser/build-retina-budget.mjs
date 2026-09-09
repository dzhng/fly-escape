import { build } from "../../apps/web/node_modules/vite/dist/node/index.js";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../..",import.meta.url));
// Time the generated binding after its real byte copies, before native computation.
// This transform exists only in the measurement build, never the product build.
const transferObserver = () => ({ name: "retina-transfer-observer", transform(code, id) {
  if (!id.endsWith("/sim-client/src/wasm/game_wasm.js")) return;
  const boundary = "const ret = wasm.attemptsession_commit_tick(this.__wbg_ptr, ptr0, len0, ptr1, len1);";
  if (code.split(boundary).length !== 2) throw new Error("Retinal WASM transfer boundary changed");
  return code.replace(boundary, "globalThis.__retinaBeforeNativeCommit?.(rgb.length);\n            " + boundary);
} });
await build({worker:{plugins:()=>[transferObserver()]},configFile:`${root}/apps/web/vite.config.ts`,root,publicDir:`${root}/apps/web/public`,
  resolve:{alias:{react:`${root}/apps/web/node_modules/react`,"react-dom":`${root}/apps/web/node_modules/react-dom`}},
  build:{outDir:process.env.RETINA_BUDGET_SITE ?? "/tmp/fly-retina-budget-site",emptyOutDir:true,
    rollupOptions:{input:[`${root}/tests/browser/retina-campaign.html`,`${root}/tests/browser/retina-retries-fixture.html`]}}});
