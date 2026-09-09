import React from "react";
import { createRoot } from "react-dom/client";
import { Campaign } from "../../apps/web/src/campaign";
import { campaignLevels } from "../../apps/web/src/campaign-content";
import observerUrl from "./retina-retry-observer-worker.mjs?worker&url";
import "../../apps/web/src/style.css";

type CaptureStats = { count: number; times: number[]; wasmTimes: number[]; maxActive: number; resources: Record<string, number> };
const evidence = { captures: {} as Record<string, CaptureStats>, cancellations: [] as {attemptId:string; acknowledgementMs:number; error?:string}[] };
declare global { interface Window { retinaRetries: typeof evidence } }
window.retinaRetries = evidence;
const NativeWorker = window.Worker;
/** Only the test substitutes the worker entry point; Campaign still owns every retry. */
window.Worker = class extends NativeWorker {
  private booted: boolean;
  private queued: unknown[] = [];
  private sequence = 0;
  private acknowledgements = new Map<number, {attemptId:string; began:number}>();
  constructor(url: string | URL, options?: WorkerOptions) {
    const observed = String(url).includes("attempt-worker");
    super(observed ? observerUrl : url, options);
    this.booted = !observed;
    if (!observed) return;
    this.addEventListener("message", ({data}) => {
      if (data.type === "retinaObserverReady") {
        this.booted = true;
        for (const message of this.queued) super.postMessage(message);
        this.queued = [];
      } else if (data.type === "retinaCaptureObservation") {
        const stats = evidence.captures[data.attemptId] ??= {count:0,times:[],wasmTimes:[],maxActive:0,resources:{}};
        stats.count++; stats.maxActive = Math.max(stats.maxActive, data.active);
        if (stats.times.length < 1000) stats.times.push(data.metrics.totalMs);
        for (const key of ["geometries","textures","stagingBytes","gpuReadbackBytes","diagnosticStagingBytes","sampleBytes"])
          stats.resources[key] = Math.max(stats.resources[key] ?? 0, data.metrics[key]);
      } else if (data.type === "retinaTransferObservation") {
        const stats = evidence.captures[data.attemptId];
        if (data.flies === 16 && stats.wasmTimes.length < 1000) stats.wasmTimes.push(data.totalMs);
      } else if (data.type === "setup") {
        const pending = this.acknowledgements.get(data.requestId);
        if (pending) {
          evidence.cancellations.push({attemptId:pending.attemptId,acknowledgementMs:performance.now()-pending.began,...(data.error ? {error:data.error} : {})});
          this.acknowledgements.delete(data.requestId);
        }
      }
    });
  }
  override postMessage(message: unknown, options: Transferable[] | StructuredSerializeOptions = []) {
    if (!this.booted) {
      this.queued.push(structuredClone(message, Array.isArray(options) ? {transfer:options} : options));
      return;
    }
    const command = message as {type?:string;attemptId?:string};
    if (command.type === "cancel" && command.attemptId) {
      const requestId = --this.sequence;
      this.acknowledgements.set(requestId,{attemptId:command.attemptId,began:performance.now()});
      if (Array.isArray(options)) super.postMessage(message, options); else super.postMessage(message, options);
      // A read-only catalog reply proves the worker processed cancellation and released the attempt.
      super.postMessage({type:"setup",requestId,command:{type:"catalog"}});
    } else if (Array.isArray(options)) super.postMessage(message, options); else super.postMessage(message, options);
  }
};
createRoot(document.getElementById("root")!).render(<Campaign levels={campaignLevels} />);
