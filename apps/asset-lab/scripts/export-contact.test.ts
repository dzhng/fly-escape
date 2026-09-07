import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../../..');
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

for (const food of ['apple', 'banana']) {
  test(`${food} contact geometry reproduces from its rendered asset`, async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'fly-contact-export-'));
    try {
      const output = join(temporary, 'contact.json');
      const asset = join(root, 'assets/food', food);
      const result = Bun.spawnSync([
        process.execPath, join(import.meta.dir, 'export-contact.ts'),
        join(asset, `${food}.glb`), output,
      ]);
      if (result.exitCode !== 0) throw new Error(result.stderr.toString());
      expect(digest(await readFile(output))).toBe(digest(await readFile(join(asset, 'contact.json'))));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}
