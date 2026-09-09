import { build } from "../../apps/web/node_modules/vite/dist/node/index.js";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../..",import.meta.url));
await build({configFile:`${root}/apps/web/vite.config.ts`,root,publicDir:`${root}/apps/web/public`,
  resolve:{alias:{react:`${root}/apps/web/node_modules/react`,"react-dom":`${root}/apps/web/node_modules/react-dom`}},
  build:{outDir:process.env.RETINA_BUDGET_SITE ?? "/tmp/fly-retina-budget-site",emptyOutDir:true,
    rollupOptions:{input:`${root}/tests/browser/retina-campaign.html`}}});
