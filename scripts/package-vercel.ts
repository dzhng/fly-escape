import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import config from '../vercel.json';

const output = new URL('../.vercel/output/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../apps/web/dist/', import.meta.url), new URL('static/', output), { recursive: true });
await writeFile(new URL('config.json', output), JSON.stringify({
  version: 3,
  routes: config.routes,
}, null, 2) + '\n');
console.log('Packaged static game in .vercel/output');
