// Reconsume the recorded physical eye bytes in a fresh WASM instance; never recapture history.
import init, { AttemptSession } from "../../packages/sim-client/src/wasm/game_wasm";
self.onmessage = async ({ data }) => {
  let core;
  try {
    await init();
    const [graph, manifest, mapText] = await Promise.all([
      fetch("/brain/graph.bin").then(r=>r.arrayBuffer()),
      fetch("/brain/manifest.json").then(r=>r.text()),
      fetch("/brain/retinal-map.json").then(r=>r.text()),
    ]);
    core = AttemptSession.new_retinal(new Uint8Array(graph),manifest,JSON.stringify(data.input),JSON.stringify(data.config),mapText);
    let comparedChunks=0;
    for(const frame of data.frames) {
      const requestText=core.prepare_tick(), request=JSON.parse(requestText);
      if(JSON.stringify(request)!==JSON.stringify(frame.retina.request)) throw Error(`Pre-neural pose changed at ${frame.tick}`);
      const status=JSON.parse(core.commit_tick(requestText,frame.retina.rgb));
      if(status.bufferedTicks===10 || status.complete) {
        const packed=core.take_chunk(), expected=data.chunks[comparedChunks++];
        try {
          for(const [field,take] of Object.entries({retinaRgb:"take_retina_rgb",values:"take_values",states:"take_states",events:"take_events",tickNeuralSteps:"take_tick_neural_steps",motionOffsets:"take_motion_offsets",motionValues:"take_motion_values",motionStates:"take_motion_states"})) {
            const actual=packed[take]();
            if(actual.length!==expected[field].length || actual.some((value,i)=>value!==expected[field][i]))
              throw Error(`Recorded-input reconsumption differs in ${field}`);
          }
        } finally { packed.free(); }
      }
    }
    self.postMessage({comparedChunks,exactRecordedInputReconsumption:true});
  } catch(error) { self.postMessage({error:String(error)}); }
  finally { core?.free(); }
};
