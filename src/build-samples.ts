// Copies the sample tracks from test-data (the single source) into public/samples for the site.
const SAMPLES: Record<string, string> = {
  "rhederlaag-swimrun.gpx": "rhederlaag-swimrun.gpx",
  "Rondje_Eilanden_2025.gpx": "rondje-eilanden.gpx",
  "Twiske_Backyard_SwimRun_Experience.gpx": "twiske-backyard.gpx",
  "Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx": "ruegen-swimrun.gpx",
  "Frankrijk_SwimRun_Coros.gpx": "frankrijk-swimrun.gpx",
};

await Deno.mkdir("public/samples", { recursive: true });
for (const [source, target] of Object.entries(SAMPLES)) {
  await Deno.copyFile(`test-data/${source}`, `public/samples/${target}`);
}
console.log(`Copied ${Object.keys(SAMPLES).length} sample tracks to public/samples`);
