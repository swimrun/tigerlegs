import { parseGPX } from "./gpx-parser.ts";
import { readFileAsText, validateFile } from "./file-upload.ts";
import { analyzeGpx } from "./analyze.ts";
import { formatSegmentDistance } from "./segment-builder.ts";
import type { Segment } from "../shared/types.ts";

// Leaflet is loaded from a CDN <script> tag and exposed as a global.
// deno-lint-ignore no-explicit-any
declare const L: any;

const COLORS = { swim: "#1e88e5", run: "#2e7d32", unclassified: "#757575" };

const input = document.getElementById("gpx-input") as HTMLInputElement;
const message = document.getElementById("message") as HTMLElement;
const tbody = document.querySelector("#segments tbody") as HTMLElement;
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

function show(file: string, xml: string) {
  const parsed = parseGPX(xml);
  if (!parsed.ok) return fail(parsed.error);

  const analysis = analyzeGpx(parsed.value);
  const track = parsed.value.tracks.find((t) => t.trackpoints.length > 0)!;
  const latLngs = track.trackpoints.map((p) => [p.coordinate.lat, p.coordinate.lon]);

  layer.remove();
  layer = L.layerGroup().addTo(map);
  tbody.innerHTML = "";

  const polylines = analysis.segments.map((seg: Segment, i: number) => {
    const line = L.polyline(
      latLngs.slice(seg.startTrackpointIndex, seg.endTrackpointIndex + 2),
      { color: COLORS[seg.type], weight: 4, opacity: 0.7 },
    ).addTo(layer);
    line.on("mouseover click", () => highlight(i, polylines));

    const d = formatSegmentDistance(seg);
    const tr = document.createElement("tr");
    const cells = [
      String(seg.number),
      seg.type,
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
    show(file.name, await readFileAsText(file));
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
});
