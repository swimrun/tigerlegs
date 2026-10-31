import { parseGPX } from "./gpx-parser.ts";
import { readFileAsText, validateFile } from "./file-upload.ts";
import { analyzeGpx } from "./analyze.ts";
import { formatSegmentDistance } from "./segment-builder.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";
import type { Segment, Trackpoint } from "../shared/types.ts";

// Leaflet is loaded from a CDN <script> tag and exposed as a global.
// deno-lint-ignore no-explicit-any
declare const L: any;

const COLORS = { swim: "#1e88e5", run: "#2e7d32", unclassified: "#757575" };

const input = document.getElementById("gpx-input") as HTMLInputElement;
const message = document.getElementById("message") as HTMLElement;
const tbody = document.querySelector("#segments tbody") as HTMLElement;
const breaksToggle = document.getElementById("include-breaks") as HTMLInputElement;
const totals = document.getElementById("totals") as HTMLElement;

const map = L.map("map").setView([50, 5], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
let layer = L.layerGroup().addTo(map);

function highlight(index: number | null, polylines: unknown[]) {
  polylines.forEach((p, i) =>
    // deno-lint-ignore no-explicit-any
    (p as any).setStyle({ weight: i === index ? 8 : 4, opacity: i === index ? 1 : 0.7 })
  );
  tbody.querySelectorAll("tr").forEach((tr, i) =>
    tr.classList.toggle("active", i === index)
  );
}

let current: { file: string; xml: string } | null = null;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Elapsed time is last minus first timestamp; moving time skips steps slower than 0.5 km/h.
function timeSummary(points: Trackpoint[]): string {
  const times = points.map((p) => (p.timestamp ? Date.parse(p.timestamp) : NaN));
  if (times.some(Number.isNaN) || points.length < 2) return "";
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (times[i] - times[i - 1]) / 1000;
    const km = haversineDistance(points[i - 1].coordinate, points[i].coordinate);
    if (dt > 0 && (km / dt) * 3600 >= 0.5) moving += dt;
  }
  const elapsed = (times[times.length - 1] - times[0]) / 1000;
  return ` · moving time ${formatDuration(moving)}, event time ${formatDuration(elapsed)}`;
}

function show(file: string, xml: string) {
  const parsed = parseGPX(xml);
  if (!parsed.ok) return fail(parsed.error);

  const analysis = analyzeGpx(parsed.value);
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
  totals.textContent =
    `${file} — ${analysis.trackName || "unnamed track"}: run ${analysis.totals.totalRunKm} km, swim ${analysis.totals.totalSwimM} m` +
    timeSummary(track.trackpoints) +
    ` (strategies: ${analysis.strategies.join(", ") || "none"})`;
  message.textContent = "";
}

function fail(error: string) {
  message.textContent = error;
}

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;
  const validation = validateFile(file);
  if (!validation.valid) return fail(validation.error ?? "Invalid file");
  try {
    current = { file: file.name, xml: await readFileAsText(file) };
    show(current.file, current.xml);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
});

breaksToggle.addEventListener("change", () => {
  if (current) show(current.file, current.xml);
});
