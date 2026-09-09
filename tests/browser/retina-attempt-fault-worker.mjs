// Fault injection stays in this probe; the imported worker is the production owner.
import { RetinaCapture } from "../../packages/game-renderer/src/retina-capture";
const original = RetinaCapture.prototype.acquire;
let injected = false;
RetinaCapture.prototype.acquire = function(poses,diagnostic) {
  if (!injected) {
    injected = true;
    const mode = new URL(self.location.href).searchParams.get("mode");
    if(mode === "context")
      setTimeout(()=>this.renderer.forceContextLoss(),0);
    else {
      const gl=this.renderer.getContext();
      if (mode === "unresponsive") gl.clientWaitSync=()=>gl.TIMEOUT_EXPIRED;
      else {
        const wait = gl.clientWaitSync.bind(gl), now = performance.now.bind(performance);
        let offset = 0, polls = 0;
        performance.now = () => now() + offset;
        gl.clientWaitSync = (...args) => {
          if (mode === "suspended" && polls++ === 0) {
            this.setSuspended(true);
            offset = 6000;
            return gl.TIMEOUT_EXPIRED;
          }
          const state = wait(...args);
          if (mode === "late-complete" && (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED)) offset = 6000;
          if (mode === "suspended") this.setSuspended(false);
          return state;
        };
      }
    }
  }
  return original.call(this,poses,diagnostic);
};
await import("../../packages/sim-client/src/attempt-worker.ts");

self.postMessage({type:"boot"});
