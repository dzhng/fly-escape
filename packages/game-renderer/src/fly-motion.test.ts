import { expect, test } from 'bun:test';
import { flyAnimation } from './fly-motion';

test('recorded airborne landing plays Land, touchdown immediately plays Walk', () => {
  const descending = {
    mode: 'landing',
    startedTick: 20,
    cursorTick: 23,
  } as const;
  const landing = flyAnimation(descending, 0.1);
  expect(landing.clip).toBe('Land');
  expect(landing.seconds).toBeCloseTo(0.3, 12);
  expect(
    flyAnimation(
      { ...descending, mode: 'walking', startedTick: 28, cursorTick: 28 },
      0.1,
    ),
  ).toEqual({ clip: 'Walk', seconds: 0 });
  expect(flyAnimation({ ...descending, mode: 'feeding' }, 0.1).clip).toBe('Feed');
  expect(flyAnimation({ ...descending, mode: 'flying' }, 0.1)).toEqual({ clip: 'Fly', seconds: (23 - 20) * 0.1 * 2.5 });
});

test('recorded orientation sampling is absolute, normalized and takes the short arc', async () => {
  const { interpolateRotation } = await import('./fly-motion');
  const a: [number, number, number, number] = [0, 0, 0, 1];
  const b: [number, number, number, number] = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  const middle = interpolateRotation(a, b, 0.5);
  expect(middle[0]).toBeCloseTo(Math.sin(Math.PI / 8), 12);
  expect(middle[3]).toBeCloseTo(Math.cos(Math.PI / 8), 12);
  interpolateRotation(a, b, 0.9);
  expect(interpolateRotation(a, b, 0.5)).toEqual(middle);
  expect(interpolateRotation(a, b.map(n => -n) as typeof b, 0.5)).toEqual(middle);
  expect(interpolateRotation(a, b, 0)).toEqual(a);
  expect(interpolateRotation(a, b, 1)).toEqual(b);
});
