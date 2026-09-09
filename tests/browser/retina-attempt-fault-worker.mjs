// Fault injection stays in this probe; the imported worker is the production owner.
import { RetinaCapture } from "../../packages/game-renderer/src/retina-capture";
const original = RetinaCapture.prototype.acquire;
let injected = false;
RetinaCapture.prototype.acquire = function(poses,diagnostic) {
  if (!injected) {
    injected = true;
    if(new URL(self.location.href).searchParams.get("mode")==="context")
      setTimeout(()=>this.renderer.forceContextLoss(),0);
    else {
      const gl=this.renderer.getContext();
      gl.clientWaitSync=()=>gl.TIMEOUT_EXPIRED;
    }
  }
  return original.call(this,poses,diagnostic);
};
await import("../../packages/sim-client/src/attempt-worker.ts");

self.postMessage({type:"boot"});
