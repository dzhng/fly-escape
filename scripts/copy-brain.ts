import { assertRetinalProfile } from "../packages/game-renderer/src/retina-profile";
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
const source = new URL('../data/processed/brain/', import.meta.url);
const destination = new URL('../apps/web/public/brain/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
const binary = await readFile(new URL('graph.bin', source));
const hash = new Bun.CryptoHasher('sha256').update(binary).digest('hex');
if (manifest.synthetic || manifest.graphHash !== hash) throw new Error('Prepare and verify the real graph before building.');
await mkdir(destination, { recursive: true });
const retinal = JSON.parse(await readFile(new URL('retinal-map.json', source), 'utf8'));
assertRetinalProfile(retinal.profile);
if (retinal.identities.graphHash !== hash) throw new Error('Retinal map graph identity mismatch.');
await writeFile(new URL('../packages/game-renderer/src/retina-map-identities.json', import.meta.url),
  JSON.stringify(retinal.identities, null, 2) + '\n');
for (const file of ['graph.bin', 'manifest.json', 'retinal-map.json']) await cp(new URL(file, source), new URL(file, destination));
console.log(`Prepared ${manifest.neuronCount.toLocaleString()} mapped neurons for static browser loading.`);
