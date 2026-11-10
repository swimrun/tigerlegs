import type { AnalysisJob, AnalysisReply } from "./analysis-job.ts";

export function runWorkerJob(
  job: AnalysisJob,
  signal: AbortSignal,
): Promise<AnalysisReply> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(new URL("analysis-worker.js", document.baseURI), {
      type: "module",
    });
    function cleanup() {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    }
    function abort() {
      cleanup();
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<AnalysisReply>) => {
      cleanup();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      cleanup();
      reject(new Error(event.message
          ? `Analysis worker failed: ${event.message}`
          : "Analysis worker could not start (script missing or stale). Run `deno task build:js` or start with `deno task dev`."));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("Could not read the analysis worker response"));
    };
    try {
      worker.postMessage(job);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
