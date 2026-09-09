import { RetinaCapture } from "../../packages/game-renderer/src/retina-capture.ts";
import { retinaFixtureScene } from "../../apps/asset-lab/src/retina-fixture.ts";
self.onmessage = async () => {
  console.log("Retina probe: loading failure scene");
  const fixture = await retinaFixtureScene();
  console.log("Retina probe: loaded failure scene");
  const pose = {position:[1,.45,2.5],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2]};
  const result = {retries:[]};
  try {
    const bounded = new RetinaCapture(fixture.scene);
    try {
      const pending = bounded.acquire([pose]);
      try { await bounded.acquire([pose]); result.overlap = "accepted"; }
      catch (error) { result.overlap = String(error); }
      result.originalCompleted = (await pending).samples.length > 0;
      try { await bounded.acquire(Array.from({length:20}, () => pose)); result.overload = "accepted"; }
      catch (error) { result.overload = String(error); }
    } finally { bounded.dispose(); }
    for (const failure of ["cancel", "context", "unresponsive", "copy"]) {
      console.log("Retina probe: " + failure);
      const capture = new RetinaCapture(fixture.scene);
      await capture.acquire([pose]);
      if (failure === "unresponsive") {
        const gl = capture.renderer.getContext();
        gl.clientWaitSync = () => gl.TIMEOUT_EXPIRED;
      }
      if (failure === "copy") {
        const gl = capture.renderer.getContext();
        gl.getBufferSubData = () => gl.bindBuffer(-1, null);
      }
      const began = performance.now();
      const pending = capture.acquire([pose]);
      if (failure === "cancel") capture.dispose();
      if (failure === "context") capture.renderer.forceContextLoss();
      try { await pending; result[failure] = {returnedFrame:true,ms:performance.now()-began}; }
      catch (error) { result[failure] = {ms:performance.now()-began, error:String(error)}; }
      capture.dispose();
    }
    for(let i=0;i<10;i++) {
      const capture = new RetinaCapture(fixture.scene);
      const frame = await capture.acquire([pose]);
      result.retries.push(frame.metrics);
      capture.dispose();
    }
    self.postMessage({result});
  } catch(error) { self.postMessage({error:String(error)}); }
  finally { fixture.dispose(); }
};
