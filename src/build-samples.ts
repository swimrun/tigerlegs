// Copies the sample tracks from test-data (the single source) into public/samples for the site.
// Which files, and under which names, is decided by the sample courses in src/client/sample-courses.ts.
import { sampleFiles } from "./client/sample-courses.ts";

const SAMPLES = sampleFiles();

await Deno.mkdir("public/samples", { recursive: true });
for (const [source, target] of SAMPLES) {
  await Deno.copyFile(`test-data/${source}`, `public/samples/${target}`);
}
console.log(`Copied ${SAMPLES.length} sample tracks to public/samples`);
