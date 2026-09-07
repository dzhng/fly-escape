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
  expect(flyAnimation({ ...descending, mode: 'flying' }, 0.1).clip).toBe('Fly');
});
