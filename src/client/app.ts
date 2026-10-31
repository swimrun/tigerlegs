import { parseGPX } from "./gpx-parser.ts";
import { largeFileNotice, readFileAsText, validateFile } from "./file-upload.ts";
import { analyzeGpx } from "./analyze.ts";
import { formatSegmentDistance } from "./segment-builder.ts";
import { fetchWater, type WaterBody } from "./water.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";
import type { Segment, Trackpoint } from "../shared/types.ts";
import denoConfig from "../../deno.json" with { type: "json" };

// Leaflet is loaded from a CDN <script> tag and exposed as a global.
// deno-lint-ignore no-explicit-any
declare const L: any;

const COLORS = { swim: "#1e88e5", run: "#2e7d32", unclassified: "#757575" };

const versionLabel = document.getElementById("app-version");
if (versionLabel) versionLabel.textContent = `v${denoConfig.version}`;

const input = document.getElementById("gpx-input") as HTMLInputElement;
const message = document.getElementById("message") as HTMLElement;
const tbody = document.querySelector("#segments tbody") as HTMLElement;
const breaksToggle = document.getElementById("include-breaks") as HTMLInputElement;
const totals = document.getElementById("totals") as HTMLElement;
const terrainToggle = document.getElementById("use-terrain") as HTMLInputElement;
const notice = document.getElementById("notice") as HTMLElement;
const terrainWarning = document.getElementById("terrain-warning") as HTMLElement;
const totalsRow = document.getElementById("totals-row") as HTMLElement;

const map = L.map("map").setView([50, 5], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
let layer = L.layerGroup().addTo(map);
const waterLayer = L.layerGroup().addTo(map);
L.control.layers(null, { "Water (OpenStreetMap)": waterLayer }, { collapsed: false }).addTo(map);

function highlight(index: number | null, polylines: unknown[]) {
  polylines.forEach((p, i) =>
    // deno-lint-ignore no-explicit-any
    (p as any).setStyle({ weight: i === index ? 8 : 4, opacity: i === index ? 1 : 0.7 })
  );
  tbody.querySelectorAll("tr").forEach((tr, i) =>
    tr.classList.toggle("active", i === index)
  );
}

let current: { file: string; xml: string; water?: WaterBody[] } | null = null;

function drawWater(water: WaterBody[]) {
  waterLayer.clearLayers();
  for (const body of water) {
    const ring = (r: { lat: number; lon: number }[]) => r.map((c) => [c.lat, c.lon]);
    for (const outer of body.outer) {
      L.polygon([ring(outer), ...body.inner.map(ring)], {
        color: "#0288d1", weight: 1, fillColor: "#4fc3f7", fillOpacity: 0.35, interactive: false,
      }).addTo(waterLayer);
    }
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Elapsed time is last minus first timestamp; moving time skips steps slower than 0.5 km/h.
function timeSummary(points: Trackpoint[]): { moving: string; event: string } | null {
  const times = points.map((p) => (p.timestamp ? Date.parse(p.timestamp) : NaN));
  if (times.some(Number.isNaN) || points.length < 2) return null;
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (times[i] - times[i - 1]) / 1000;
    const km = haversineDistance(points[i - 1].coordinate, points[i].coordinate);
    if (dt > 0 && (km / dt) * 3600 >= 0.5) moving += dt;
  }
  const elapsed = (times[times.length - 1] - times[0]) / 1000;
  return { moving: formatDuration(moving), event: formatDuration(elapsed) };
}

function stat(label: string, value: string): HTMLElement {
  const box = document.createElement("div");
  const dt = document.createElement("dt");
  dt.className = "text-xs uppercase tracking-wide text-stone-500";
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.className = "text-lg font-semibold tabular-nums text-stone-800";
  dd.textContent = value;
  box.append(dt, dd);
  return box;
}

function renderSummary(file: string, name: string, times: ReturnType<typeof timeSummary>, strategies: string[]) {
  const title = document.createElement("h2");
  title.className = "text-base font-semibold text-stone-900";
  title.textContent = name;
  const source = document.createElement("p");
  source.className = "truncate text-xs text-stone-500";
  source.title = file;
  source.textContent = file;
  const stats = document.createElement("dl");
  stats.className = "mt-2 flex flex-wrap gap-x-6 gap-y-2";
  if (times) stats.append(stat("Moving time", times.moving), stat("Event time", times.event));
  const chips = document.createElement("div");
  chips.className = "flex flex-wrap gap-1";
  for (const s of strategies) {
    const chip = document.createElement("span");
    chip.className = "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800";
    chip.textContent = s;
    chips.append(chip);
  }
  const method = document.createElement("div");
  const label = document.createElement("dt");
  label.className = "text-xs uppercase tracking-wide text-stone-500";
  label.textContent = "Detected by";
  method.append(label, chips);
  stats.append(method);
  totals.replaceChildren(title, source, stats);
}

function show(file: string, xml: string) {
  const parsed = parseGPX(xml);
  if (!parsed.ok) return fail(parsed.error);

  const analysis = analyzeGpx(parsed.value, current?.water);
  const track = parsed.value.tracks.find((t) => t.trackpoints.length > 0)!;
  const latLngs = track.trackpoints.map((p) => [p.coordinate.lat, p.coordinate.lon]);
  const includeBreaks = breaksToggle.checked;

  layer.remove();
  layer = L.layerGroup().addTo(map);
  tbody.innerHTML = "";

  const visible = analysis.segments.filter((seg: Segment) =>
    includeBreaks || seg.type !== "unclassified"
  );
  const polylines = visible.map((seg: Segment, i: number) => {
    const line = L.polyline(
      latLngs.slice(seg.startTrackpointIndex, seg.endTrackpointIndex + 2),
      { color: COLORS[seg.type], weight: 4, opacity: 0.7 },
    ).addTo(layer);
    line.on("mouseover click", () => highlight(i, polylines));

    const d = formatSegmentDistance(seg);
    const tr = document.createElement("tr");
    const cells = [
      String(seg.number),
      seg.type === "unclassified" ? "break" : seg.type,
      seg.type === "swim" ? `${d.swimDistanceM} m` : `${d.runDistanceKm} km`,
      d.detectedBy,
      seg.confidenceScore.toFixed(2),
    ];
    for (const text of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    tr.addEventListener("mouseenter", () => highlight(i, polylines));
    tbody.appendChild(tr);
    return line;
  });

  if (latLngs.length > 0) map.fitBounds(L.polyline(latLngs).getBounds());
  totalsRow.innerHTML = "";
  const label = document.createElement("td");
  label.colSpan = 2;
  label.textContent = "Total";
  const sums = document.createElement("td");
  sums.colSpan = 3;
  sums.textContent = `run ${analysis.totals.totalRunKm} km, swim ${analysis.totals.totalSwimM} m`;
  totalsRow.append(label, sums);
  renderSummary(file, analysis.trackName || "Unnamed track", timeSummary(track.trackpoints), analysis.strategies);
}

// Terrain refinement: fetch water polygons for the track, then re-run the analysis with them.
async function loadWater(target: NonNullable<typeof current>) {
  const parsed = parseGPX(target.xml);
  if (!parsed.ok) return;
  const points = parsed.value.tracks.find((t) => t.trackpoints.length > 0)!.trackpoints;
  message.textContent = "Loading water and land data from OpenStreetMap…";
  try {
    target.water = await fetchWater(points);
    if (current !== target) return;
    drawWater(target.water);
    show(target.file, target.xml);
    message.textContent = "";
  } catch (e) {
    message.textContent = `Terrain data unavailable, showing speed-based result only (${
      e instanceof Error ? e.message : String(e)
    }).`;
  }
}

function fail(error: string) {
  message.textContent = error;
}

/** Show the large-file notice before the heavy work starts, and keep it (with the duration) afterwards. */
async function withLargeFileNotice(sizeBytes: number, downloaded: boolean, work: () => Promise<void>) {
  const text = largeFileNotice(sizeBytes, downloaded);
  notice.classList.toggle("hidden", text === null);
  message.textContent = "";
  if (text === null) return work();
  notice.textContent = text;
  // Let the browser paint the notice before the synchronous analysis blocks the page.
  await new Promise((resolve) => setTimeout(resolve, 50));
  const started = performance.now();
  await work();
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  notice.textContent = `${text} Done in ${seconds} s.`;
}

document.querySelectorAll<HTMLElement>("[data-sample]").forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    const name = link.dataset.sample!;
    try {
      const response = await fetch(`samples/${name}`);
      if (!response.ok) throw new Error("Could not load the sample track");
      await withLargeFileNotice(Number(response.headers.get("content-length") ?? 0), true, async () => {
        current = { file: name, xml: await response.text() };
        waterLayer.clearLayers();
        show(current.file, current.xml);
        if (terrainToggle.checked) await loadWater(current);
      });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  });
});

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;
  const validation = validateFile(file);
  if (!validation.valid) return fail(validation.error ?? "Invalid file");
  try {
    await withLargeFileNotice(file.size, false, async () => {
      current = { file: file.name, xml: await readFileAsText(file) };
      waterLayer.clearLayers();
      show(current.file, current.xml);
      if (terrainToggle.checked) await loadWater(current);
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
});

terrainToggle.addEventListener("change", async () => {
  terrainWarning.classList.toggle("hidden", !terrainToggle.checked);
  if (!current) return;
  if (terrainToggle.checked) {
    await loadWater(current);
  } else {
    current.water = undefined;
    waterLayer.clearLayers();
    message.textContent = "";
    show(current.file, current.xml);
  }
});

breaksToggle.addEventListener("change", () => {
  if (current) show(current.file, current.xml);
});
