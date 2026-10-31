import {
  largeFileNotice,
  readFileAsText,
  validateFile,
} from "./file-upload.ts";
import { type Analysis, analyzeGpx } from "./analyze.ts";
import { importWarnings, requiresAnalysisWorker } from "./analysis-job.ts";
import { runWorkerJob } from "./worker-client.ts";
import { detectApplicableStrategies } from "./strategy-combiner.ts";
import { renderTable } from "./table-renderer.ts";
import { fetchWater, type WaterBody } from "./water.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";
import type {
  GPXData,
  Segment,
  StrategyName,
  Trackpoint,
} from "../shared/types.ts";
import denoConfig from "../../deno.json" with { type: "json" };
import {
  createHighlightController,
  type HighlightController,
} from "./highlight-controller.ts";

// Leaflet is loaded from a CDN <script> tag and exposed as a global.
// deno-lint-ignore no-explicit-any
declare const L: any;

const COLORS = { swim: "#1e88e5", run: "#2e7d32", unclassified: "#757575" };

const versionLabel = document.getElementById("app-version");
if (versionLabel) versionLabel.textContent = `v${denoConfig.version}`;

const input = document.getElementById("gpx-input") as HTMLInputElement;
const message = document.getElementById("message") as HTMLElement;
const table = document.getElementById("segments") as HTMLTableElement;
const swimFirstToggle = document.getElementById(
  "swim-first",
) as HTMLInputElement;
const cumulativeToggle = document.getElementById(
  "show-cumulative",
) as HTMLInputElement;
const breaksToggle = document.getElementById(
  "include-breaks",
) as HTMLInputElement;
const totals = document.getElementById("totals") as HTMLElement;
const terrainToggle = document.getElementById(
  "use-terrain",
) as HTMLInputElement;
const notice = document.getElementById("notice") as HTMLElement;
const terrainWarning = document.getElementById(
  "terrain-warning",
) as HTMLElement;
const speedToggle = document.getElementById("use-speed") as HTMLInputElement;
const waypointToggle = document.getElementById(
  "use-waypoints",
) as HTMLInputElement;
const trackSelect = document.getElementById(
  "track-select",
) as HTMLSelectElement;
const trackPicker = document.getElementById("track-picker") as HTMLElement;
const dropZone = document.getElementById("drop-zone") as HTMLElement;
const analysisStatus = document.getElementById(
  "analysis-status",
) as HTMLElement;
const pointWarning = document.getElementById("point-warning") as HTMLElement;

const map = L.map("map").setView([50, 5], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
let layer = L.layerGroup().addTo(map);
const waterLayer = L.layerGroup().addTo(map);
L.control.layers(null, { "Water (OpenStreetMap)": waterLayer }, {
  collapsed: false,
}).addTo(map);

let highlight: HighlightController | null = null;

interface SegmentPolyline {
  setStyle(style: { weight: number; opacity: number }): void;
  on(event: string, handler: () => void): void;
}

interface AppState {
  file: string;
  gpx: GPXData;
  trackIndex: number;
  water?: WaterBody[];
  analysis?: Analysis;
}
let current: AppState | null = null;
let fileRequest: AbortController | null = null;
let analysisRequest: AbortController | null = null;
let terrainRequest: AbortController | null = null;

function enabledStrategies(): StrategyName[] {
  const enabled: StrategyName[] = [];
  if (waypointToggle.checked) enabled.push("waypoint");
  if (speedToggle.checked) enabled.push("speed");
  if (terrainToggle.checked) enabled.push("landscape");
  return enabled;
}

function drawWater(water: WaterBody[]) {
  waterLayer.clearLayers();
  for (const body of water) {
    const ring = (r: { lat: number; lon: number }[]) =>
      r.map((c) => [c.lat, c.lon]);
    for (const outer of body.outer) {
      L.polygon([ring(outer), ...body.inner.map(ring)], {
        color: "#0288d1",
        weight: 1,
        fillColor: "#4fc3f7",
        fillOpacity: 0.35,
        interactive: false,
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
function timeSummary(
  points: Trackpoint[],
): { moving: string; event: string } | null {
  const times = points.map((
    p,
  ) => (p.timestamp ? Date.parse(p.timestamp) : NaN));
  if (times.some(Number.isNaN) || points.length < 2) return null;
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (times[i] - times[i - 1]) / 1000;
    const km = haversineDistance(
      points[i - 1].coordinate,
      points[i].coordinate,
    );
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

function renderSummary(
  file: string,
  name: string,
  times: ReturnType<typeof timeSummary>,
  strategies: string[],
) {
  const title = document.createElement("h2");
  title.className = "text-base font-semibold text-stone-900";
  title.textContent = name;
  const source = document.createElement("p");
  source.className = "truncate text-xs text-stone-500";
  source.title = file;
  source.textContent = file;
  const stats = document.createElement("dl");
  stats.className = "mt-2 flex flex-wrap gap-x-6 gap-y-2";
  if (times) {
    stats.append(
      stat("Moving time", times.moving),
      stat("Event time", times.event),
    );
  }
  const chips = document.createElement("div");
  chips.className = "flex flex-wrap gap-1";
  for (const s of strategies) {
    const chip = document.createElement("span");
    chip.className =
      "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800";
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

function show(target: AppState, analysis: Analysis) {
  const track = target.gpx.tracks[target.trackIndex];
  const latLngs = track.trackpoints.map((
    p,
  ) => [p.coordinate.lat, p.coordinate.lon]);
  const includeBreaks = breaksToggle.checked;

  highlight?.destroy();
  layer.remove();
  layer = L.layerGroup().addTo(map);

  const visible = analysis.segments.filter((seg: Segment) =>
    includeBreaks || seg.type !== "unclassified"
  );
  if (visible.length === 0) {
    L.polyline(latLngs, { color: COLORS.unclassified, weight: 4 }).addTo(layer);
  }
  const polylines: SegmentPolyline[] = visible.map((seg: Segment) => {
    const line: SegmentPolyline = L.polyline(
      latLngs.slice(seg.startTrackpointIndex, seg.endTrackpointIndex + 2),
      { color: COLORS[seg.type], weight: 4, opacity: 0.7 },
    ).addTo(layer);
    line.on("mouseover", () => highlight?.previewSegment(seg.number));
    line.on("mouseout", () => highlight?.previewSegment(null));
    line.on("click", () => highlight?.selectSegment(seg.number, "map"));

    return line;
  });
  const { rows, buttons } = renderTable(
    table,
    visible,
    analysis.totals,
    {
      swimFirst: swimFirstToggle.checked,
      showCumulative: cumulativeToggle.checked,
    },
    analysis.conflicts,
    {
      select: (number) => highlight?.selectSegment(number),
      preview: (number) => highlight?.previewSegment(number),
      clear: () => highlight?.clearSelection(),
    },
  );
  highlight = createHighlightController(visible.map((seg) => seg.number), {
    render(active, selected) {
      visible.forEach((seg, index) => {
        const isActive = active === seg.number;
        polylines[index].setStyle({
          weight: isActive ? 8 : 4,
          opacity: isActive ? 1 : 0.7,
        });
        buttons.get(seg.number)!.setAttribute(
          "aria-pressed",
          String(selected === seg.number),
        );
      });
      const activeRow = active === null ? null : rows.get(active);
      for (const row of new Set(rows.values())) {
        row.classList.toggle("active", row === activeRow);
      }
    },
    scrollToSegment(number) {
      rows.get(number)!.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
  });

  if (latLngs.length > 0) map.fitBounds(L.polyline(latLngs).getBounds());
  renderSummary(
    target.file,
    analysis.trackName || "Unnamed track",
    timeSummary(track.trackpoints),
    analysis.strategies,
  );
}

async function runAnalysis(target: AppState) {
  if (target.trackIndex < 0) {
    analysisStatus.textContent = "Choose a track before analysis begins.";
    return;
  }
  analysisRequest?.abort();
  const request = new AbortController();
  analysisRequest = request;
  const trackIndex = target.trackIndex;
  const track = target.gpx.tracks[trackIndex];
  const options = { trackIndex, enabledStrategies: enabledStrategies() };
  const water = terrainToggle.checked ? target.water ?? [] : [];
  const useWorker = requiresAnalysisWorker(track.trackpoints.length);
  analysisStatus.textContent = useWorker
    ? "Analysing in a background worker…"
    : "Analysing…";
  const started = performance.now();
  try {
    let analysis: Analysis;
    if (useWorker) {
      const reply = await runWorkerJob({
        kind: "analyze",
        gpx: target.gpx,
        water,
        options,
      }, request.signal);
      if (reply.kind !== "analyze") {
        throw new Error("Unexpected analysis worker response");
      }
      if (!reply.result.ok) throw new Error(reply.result.error);
      analysis = reply.result.value;
    } else {
      analysis = analyzeGpx(target.gpx, water, options);
    }
    if (
      request.signal.aborted || current !== target ||
      trackIndex !== target.trackIndex
    ) return;
    target.analysis = analysis;
    show(target, analysis);
    const applicable = detectApplicableStrategies({
      waypoints: target.gpx.waypoints,
      tracks: [track],
    });
    const inactive = options.enabledStrategies.filter((strategy) =>
      !applicable.includes(strategy) ||
      (strategy === "landscape" && water.length === 0)
    );
    analysisStatus.textContent =
      `Analysed ${track.trackpoints.length.toLocaleString()} trackpoints in ${
        ((performance.now() - started) / 1000).toFixed(1)
      } s${useWorker ? " (background worker)" : ""}.` +
      (inactive.length ? ` No usable data for: ${inactive.join(", ")}.` : "");
  } catch (error) {
    if (request.signal.aborted || current !== target) return;
    analysisStatus.textContent = "Analysis failed; previous results retained.";
    fail(error instanceof Error ? error.message : String(error));
  }
}

async function loadWater(target: AppState) {
  if (target.trackIndex < 0) return;
  terrainRequest?.abort();
  const request = new AbortController();
  terrainRequest = request;
  const trackIndex = target.trackIndex;
  message.textContent =
    "Loading water areas from OpenStreetMap (servers may take a while)…";
  try {
    const water = await fetchWater(
      target.gpx.tracks[trackIndex].trackpoints,
      request.signal,
    );
    if (
      request.signal.aborted || current !== target ||
      target.trackIndex !== trackIndex || !terrainToggle.checked
    ) return;
    target.water = water;
    drawWater(water);
    message.textContent = water.length === 0
      ? "No mapped water areas found. Speed/waypoint results remain available."
      : "";
    await runAnalysis(target);
  } catch (error) {
    if (request.signal.aborted || current !== target) return;
    fail(
      `Terrain data unavailable; local results retained (${
        error instanceof Error ? error.message : String(error)
      }).`,
    );
  }
}

function fail(error: string) {
  message.textContent = error;
  console.error(`[TigerLegs] ${error}`);
}

function showFileNotice(size: number, downloaded: boolean) {
  const text = largeFileNotice(size, downloaded);
  notice.textContent = text ?? "";
  notice.classList.toggle("hidden", text === null);
}

async function importText(file: string, xml: string, request: AbortController) {
  analysisStatus.textContent = "Reading GPX in a background worker…";
  const reply = await runWorkerJob({ kind: "parse", xml }, request.signal);
  if (reply.kind !== "parse") throw new Error("Unexpected GPX worker response");
  if (!reply.result.ok) throw new Error(reply.result.error);
  if (request.signal.aborted) return;
  const gpx = reply.result.value;
  const counts = importWarnings(gpx);
  if (
    counts.confirmationRequired &&
    !globalThis.confirm(
      `This file contains ${counts.trackpoints.toLocaleString()} trackpoints (more than 50,000). Processing may be slow and use battery. Continue?`,
    )
  ) {
    analysisStatus.textContent = "Import cancelled; previous results retained.";
    return;
  }
  analysisRequest?.abort();
  terrainRequest?.abort();
  const target: AppState = {
    file,
    gpx,
    trackIndex: counts.trackSelectionRequired ? -1 : 0,
  };
  current = target;
  waterLayer.clearLayers();
  trackSelect.replaceChildren();
  if (gpx.tracks.length > 1) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a track…";
    placeholder.disabled = true;
    trackSelect.append(placeholder);
  }
  gpx.tracks.forEach((track, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${
      track.name || `Track ${index + 1}`
    } (${track.trackpoints.length.toLocaleString()} points)`;
    option.disabled = track.trackpoints.length === 0;
    trackSelect.append(option);
  });
  trackSelect.value = target.trackIndex < 0 ? "" : String(target.trackIndex);
  trackPicker.classList.toggle("hidden", gpx.tracks.length < 2);
  pointWarning.textContent = counts.manyWaypoints
    ? `Unusually many waypoints (${counts.waypoints}). Analysis will continue; check the results carefully.`
    : "";
  pointWarning.classList.toggle(
    "hidden",
    !counts.manyWaypoints,
  );
  message.textContent = "";
  if (target.trackIndex < 0) {
    highlight?.destroy();
    highlight = null;
    layer.clearLayers();
    totals.replaceChildren();
    renderTable(
      table,
      [],
      { totalRunKm: "0.0", totalSwimM: "0" },
      {
        swimFirst: swimFirstToggle.checked,
        showCumulative: cumulativeToggle.checked,
      },
      [],
      { select() {}, preview() {}, clear() {} },
    );
    analysisStatus.textContent = "Choose a track before analysis begins.";
    return;
  }
  await runAnalysis(target);
  if (current === target && terrainToggle.checked) await loadWater(target);
}

function beginImport(): AbortController {
  fileRequest?.abort();
  analysisRequest?.abort();
  terrainRequest?.abort();
  const request = new AbortController();
  fileRequest = request;
  message.textContent = "";
  return request;
}

async function importFile(file: File) {
  const validation = validateFile(file);
  if (!validation.valid) return fail(validation.error ?? "Invalid file");
  const request = beginImport();
  showFileNotice(file.size, false);
  try {
    const xml = await readFileAsText(file);
    if (request.signal.aborted) return;
    await importText(file.name, xml, request);
  } catch (error) {
    if (request.signal.aborted) return;
    analysisStatus.textContent = "Import failed; previous results retained.";
    fail(error instanceof Error ? error.message : String(error));
  }
}

document.querySelectorAll<HTMLElement>("[data-sample]").forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    const request = beginImport();
    const name = link.dataset.sample!;
    analysisStatus.textContent = "Downloading sample GPX…";
    try {
      const response = await fetch(`samples/${name}`, {
        signal: request.signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load the sample track (${response.status})`);
      }
      showFileNotice(Number(response.headers.get("content-length") ?? 0), true);
      const xml = await response.text();
      if (request.signal.aborted) return;
      showFileNotice(new Blob([xml]).size, true);
      await importText(name, xml, request);
    } catch (error) {
      if (request.signal.aborted) return;
      analysisStatus.textContent = "Import failed; previous results retained.";
      fail(error instanceof Error ? error.message : String(error));
    }
  });
});

input.addEventListener("change", () => {
  const file = input.files?.[0];
  if (file) void importFile(file);
  input.value = "";
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drop-active");
});
dropZone.addEventListener("dragleave", (event) => {
  if (
    !(event.relatedTarget instanceof Node) ||
    !dropZone.contains(event.relatedTarget)
  ) {
    dropZone.classList.remove("drop-active");
  }
});
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drop-active");
  const files = event.dataTransfer?.files;
  if (!files || files.length !== 1) {
    return fail("Drop exactly one GPX file at a time");
  }
  void importFile(files[0]);
});

trackSelect.addEventListener("change", async () => {
  if (!current) return;
  const target = current;
  const index = Number(trackSelect.value);
  if (!target.gpx.tracks[index]?.trackpoints.length) {
    return fail("Select a track containing trackpoints");
  }
  terrainRequest?.abort();
  target.trackIndex = index;
  target.water = undefined;
  waterLayer.clearLayers();
  message.textContent = "";
  await runAnalysis(target);
  if (
    current === target && target.trackIndex === index && terrainToggle.checked
  ) await loadWater(target);
});

for (const toggle of [waypointToggle, speedToggle, terrainToggle]) {
  toggle.addEventListener("change", async () => {
    let restoredSpeed = false;
    if (enabledStrategies().length === 0) {
      if (toggle === terrainToggle) {
        speedToggle.checked = true;
        restoredSpeed = true;
      } else {
        toggle.checked = true;
        message.textContent =
          "At least one detection strategy must remain enabled. Previous results retained.";
        return;
      }
    }
    terrainWarning.classList.toggle("hidden", !terrainToggle.checked);
    message.textContent = "";
    if (!terrainToggle.checked) {
      terrainRequest?.abort();
      if (current) current.water = undefined;
      waterLayer.clearLayers();
    }
    const target = current;
    if (!target) return;
    await runAnalysis(target);
    if (restoredSpeed && current === target) {
      message.textContent =
        "Terrain disabled. Speed was re-enabled so at least one local strategy remains active.";
    }
    if (
      current === target && terrainToggle.checked && !target.water &&
      toggle === terrainToggle
    ) {
      await loadWater(target);
    }
  });
}

for (const toggle of [breaksToggle, swimFirstToggle, cumulativeToggle]) {
  toggle.addEventListener("change", () => {
    if (current?.analysis) show(current, current.analysis);
  });
}
