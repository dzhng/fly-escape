import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Buffer assertion diffs can exhaust memory on a failed screenshot. Keep exact
 * equality while reporting only bounded hashes; saved images remain the review surface. */
export function equalPixels(actual, expected, message = 'rendered pixels are identical') {
  if (actual.equals(expected)) return;
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.fail(`${message}: actual ${hash(actual)}, expected ${hash(expected)}`);
}
