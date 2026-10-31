import { type AnalysisJob, processAnalysisJob } from "./analysis-job.ts";

globalThis.addEventListener("message", (event: MessageEvent<AnalysisJob>) => {
  globalThis.postMessage(processAnalysisJob(event.data));
});
