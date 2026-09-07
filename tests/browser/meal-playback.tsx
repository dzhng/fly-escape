import { createRoot } from 'react-dom/client';
import { AttemptClient, type StartAttempt } from '../../packages/sim-client/src';
import { AttemptPlayback } from '../../apps/web/src/playback';

/** Mount the production player with a controlled, core-validated meal opportunity. */
export async function renderMeal(input: StartAttempt) {
  const client = new AttemptClient(() => {});
  const catalog = await client.setup({ type: 'catalog' });
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  createRoot(host).render(<AttemptPlayback input={input} client={client} catalog={catalog} />);
}
