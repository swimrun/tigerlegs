import { useEffect, useMemo, useRef, useState } from "react";
import { largeFileNotice, readFileAsText, validateFile } from "../client/file-upload.ts";
import { analyzeGpx, type Analysis } from "../client/analyze.ts";
import { importWarnings, requiresAnalysisWorker } from "../client/analysis-job.ts";
import { runWorkerJob } from "../client/worker-client.ts";
import { detectApplicableStrategies } from "../client/strategy-combiner.ts";
import { fetchWater, type WaterBody } from "../client/water.ts";
import { SAMPLE_COURSES } from "../client/sample-courses.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";
import type { GPXData, StrategyName, Trackpoint } from "../shared/types.ts";
import CourseMap from "./CourseMap.tsx";
import SegmentTable from "./SegmentTable.tsx";

interface Course {
  file: string;
  gpx: GPXData;
  trackIndex: number;
  water?: WaterBody[];
  analysis?: Analysis;
}
const EMPTY_POINTS: Trackpoint[] = [];
const EMPTY_WATER: WaterBody[] = [];

function timeSummary(points: Trackpoint[]) {
  const times = points.map(p => Date.parse(p.timestamp ?? ""));
  if (points.length < 2 || times.some(Number.isNaN)) return null;
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const seconds = (times[i] - times[i - 1]) / 1000;
    if (seconds > 0 && haversineDistance(points[i - 1].coordinate, points[i].coordinate) / seconds * 3600 >= 0.5) moving += seconds;
  }
  const format = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
  return { moving: format(moving), event: format((times.at(-1)! - times[0]) / 1000) };
}

export default function Extractor({ base }: { base: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const current = useRef<Course | null>(null);
  const [strategies, setStrategies] = useState<StrategyName[]>(["waypoint", "speed"]);
  const enabled = useRef(strategies);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const [dragging, setDragging] = useState(false);
  const [includeBreaks, setIncludeBreaks] = useState(false);
  const [swimFirst, setSwimFirst] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const requests = useRef<{ file?: AbortController; analysis?: AbortController; terrain?: AbortController }>({});
  const results = useRef<HTMLDivElement>(null);
  const update = (target: Course) => {
    if (current.current !== target) return;
    setCourse({ ...target });
  };
  const fail = (error: string) => {
    setMessage(error);
    console.error(`[TigerLegs] ${error}`);
  };
  useEffect(() => () => {
    Object.values(requests.current).forEach(request => request?.abort());
    current.current = null;
  }, []);

  async function runAnalysis(target: Course) {
    if (target.trackIndex < 0) { setStatus("Choose a track before analysis begins."); return; }
    requests.current.analysis?.abort();
    const request = new AbortController();
    requests.current.analysis = request;
    const trackIndex = target.trackIndex;
    const track = target.gpx.tracks[trackIndex];
    const options = { trackIndex, enabledStrategies: [...enabled.current] };
    const water = enabled.current.includes("landscape") ? target.water ?? [] : [];
    const worker = requiresAnalysisWorker(track.trackpoints.length);
    setStatus(worker ? "Analysing in a background worker…" : "Analysing…");
    const started = performance.now();
    try {
      let analysis: Analysis;
      if (worker) {
        const reply = await runWorkerJob({ kind: "analyze", gpx: target.gpx, water, options }, request.signal);
        if (reply.kind !== "analyze") throw new Error("Unexpected analysis worker response");
        if (!reply.result.ok) throw new Error(reply.result.error);
        analysis = reply.result.value;
      } else analysis = analyzeGpx(target.gpx, water, options);
      if (request.signal.aborted || current.current !== target || trackIndex !== target.trackIndex) return;
      target.analysis = analysis;
      update(target);
      setSelected(null);
      setHovered(null);
      const applicable = detectApplicableStrategies({ waypoints: target.gpx.waypoints, tracks: [track] });
      const inactive = options.enabledStrategies.filter(s => !applicable.includes(s) || s === "landscape" && !water.length);
      setStatus(`Analysed ${track.trackpoints.length.toLocaleString()} trackpoints in ${((performance.now() - started) / 1000).toFixed(1)} s${worker ? " (background worker)" : ""}.` +
        (inactive.length ? ` No usable data for: ${inactive.join(", ")}.` : ""));
    } catch (error) {
      if (request.signal.aborted || current.current !== target) return;
      setStatus("Analysis failed; previous results retained.");
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadWater(target: Course) {
    if (target.trackIndex < 0) return;
    requests.current.terrain?.abort();
    const request = new AbortController();
    requests.current.terrain = request;
    const index = target.trackIndex;
    setMessage("Loading water areas from OpenStreetMap (servers may take a while)…");
    try {
      const water = await fetchWater(target.gpx.tracks[index].trackpoints, request.signal);
      if (request.signal.aborted || current.current !== target || target.trackIndex !== index || !enabled.current.includes("landscape")) return;
      target.water = water;
      update(target);
      setMessage(water.length ? "" : "No mapped water areas found. Speed/waypoint results remain available.");
      await runAnalysis(target);
    } catch (error) {
      if (request.signal.aborted || current.current !== target) return;
      fail(`Terrain data unavailable; local results retained (${error instanceof Error ? error.message : String(error)}).`);
    }
  }

  function beginImport() {
    Object.values(requests.current).forEach(request => request?.abort());
    const request = new AbortController();
    requests.current.file = request;
    setMessage("");
    return request;
  }
  async function importText(file: string, xml: string, request: AbortController) {
    setStatus("Reading GPX in a background worker…");
    const reply = await runWorkerJob({ kind: "parse", xml }, request.signal);
    if (reply.kind !== "parse") throw new Error("Unexpected GPX worker response");
    if (!reply.result.ok) throw new Error(reply.result.error);
    if (request.signal.aborted) return;
    const counts = importWarnings(reply.result.value);
    if (counts.confirmationRequired && !globalThis.confirm(`This file contains ${counts.trackpoints.toLocaleString()} trackpoints (more than 50,000). Processing may be slow and use battery. Continue?`)) {
      setStatus("Import cancelled; previous results retained.");
      return;
    }
    requests.current.analysis?.abort();
    requests.current.terrain?.abort();
    const target: Course = { file, gpx: reply.result.value, trackIndex: counts.trackSelectionRequired ? -1 : 0 };
    current.current = target;
    update(target);
    setSelected(null);
    setHovered(null);
    setWarning(counts.manyWaypoints ? `Unusually many waypoints (${counts.waypoints}). Analysis will continue; check the results carefully.` : "");
    setMessage("");
    await runAnalysis(target);
    if (current.current === target && enabled.current.includes("landscape")) await loadWater(target);
  }
  async function importFile(file: File) {
    const validation = validateFile(file);
    if (!validation.valid) { fail(validation.error ?? "Invalid file"); return; }
    const request = beginImport();
    setNotice(largeFileNotice(file.size, false));
    try {
      const xml = await readFileAsText(file);
      if (!request.signal.aborted) await importText(file.name, xml, request);
    } catch (error) {
      if (request.signal.aborted) return;
      setStatus("Import failed; previous results retained.");
      fail(error instanceof Error ? error.message : String(error));
    }
  }
  async function importSample(name: string) {
    const request = beginImport();
    setStatus("Downloading sample GPX…");
    setNotice(null);
    try {
      const response = await fetch(`${base}samples/${name}`, { signal: request.signal });
      if (!response.ok) throw new Error(`Could not load the sample track (${response.status})`);
      setNotice(largeFileNotice(Number(response.headers.get("content-length") ?? 0), true));
      const xml = await response.text();
      if (request.signal.aborted) return;
      setNotice(largeFileNotice(new Blob([xml]).size, true));
      await importText(name, xml, request);
    } catch (error) {
      if (request.signal.aborted) return;
      setStatus("Import failed; previous results retained.");
      fail(error instanceof Error ? error.message : String(error));
    }
  }
  async function changeTrack(index: number) {
    const target = current.current;
    if (!target) return;
    if (!target.gpx.tracks[index]?.trackpoints.length) { fail("Select a track containing trackpoints"); return; }
    requests.current.terrain?.abort();
    target.trackIndex = index;
    target.water = undefined;
    target.analysis = undefined;
    update(target);
    setMessage("");
    await runAnalysis(target);
    if (current.current === target && target.trackIndex === index && enabled.current.includes("landscape")) await loadWater(target);
  }
  async function toggleStrategy(strategy: StrategyName, checked: boolean) {
    let next = checked ? [...enabled.current, strategy] : enabled.current.filter(s => s !== strategy);
    let restored = false;
    if (!next.length) {
      if (strategy !== "landscape") {
        setMessage("At least one detection strategy must remain enabled. Previous results retained.");
        return;
      }
      next = ["speed"];
      restored = true;
    }
    enabled.current = next;
    setStrategies(next);
    setMessage("");
    const target = current.current;
    if (!next.includes("landscape")) {
      requests.current.terrain?.abort();
      if (target) { target.water = undefined; update(target); }
    }
    if (!target) return;
    await runAnalysis(target);
    if (restored && current.current === target) setMessage("Terrain disabled. Speed was re-enabled so at least one local strategy remains active.");
    if (current.current === target && next.includes("landscape") && !target.water && strategy === "landscape") await loadWater(target);
  }

  const points = course && course.trackIndex >= 0 ? course.gpx.tracks[course.trackIndex].trackpoints : EMPTY_POINTS;
  const visible = useMemo(() => course?.analysis?.segments.filter(s => includeBreaks || s.type !== "unclassified") ?? [], [course?.analysis, includeBreaks]);
  const times = useMemo(() => timeSummary(points), [points]);
  const active = selected ?? hovered;
  const select = (number: number) => setSelected(previous => previous === number ? null : number);
  const presentationChange = () => { setSelected(null); setHovered(null); };
  return <>
    <noscript><p>Enable JavaScript to analyse GPX files locally in your browser.</p></noscript>
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
    <nav aria-label="Sample swimruns" className="mb-6 lg:mb-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Try a sample</h2>
      <ul className="mt-2 space-y-3">
        {SAMPLE_COURSES.map(course => {
          const single = course.variants.length === 1 ? course.variants[0] : null;
          if (single?.file) return <li key={course.id}>
            <a href={`${base}samples/${single.file}`} data-sample={single.file} title={single.description}
              className="sample-link block rounded border border-stone-200 bg-white px-3 py-2 text-sm font-medium hover:border-amber-500 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              onClick={event => { event.preventDefault(); void importSample(single.file!); }}>{course.name}</a>
          </li>;
          return <li key={course.id} data-course={course.id}>
            <h3 className="text-sm font-semibold text-stone-800">{course.name}</h3>
            <ul className="mt-1 space-y-2">
              {course.variants.map(variant => <li key={variant.id} data-variant={variant.id}>
                {variant.file
                  ? <a href={`${base}samples/${variant.file}`} data-sample={variant.file}
                    className="sample-link block rounded border border-stone-200 bg-white px-3 py-2 text-sm font-medium hover:border-amber-500 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
                    onClick={event => { event.preventDefault(); void importSample(variant.file!); }}>{variant.label}</a>
                  : <span aria-disabled="true" className="block rounded border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600">{variant.label} <span className="font-normal">(GPX to be added)</span></span>}
                <p className="mt-1 text-xs text-stone-600">{variant.description}</p>
              </li>)}
            </ul>
          </li>;
        })}
      </ul>
    </nav>
    <div className="min-w-0">
    <section id="drop-zone" aria-label="GPX file drop zone"
      className={`mb-6 rounded-lg border border-stone-200 border-t-4 border-t-amber-500 bg-white p-4 shadow-sm${dragging ? " drop-active" : ""}`}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={event => {
        event.preventDefault(); setDragging(false);
        if (event.dataTransfer.files.length !== 1) { fail("Drop exactly one GPX file at a time"); return; }
        void importFile(event.dataTransfer.files[0]);
      }}>
      <label htmlFor="gpx-input" className="mb-2 block text-sm font-medium text-stone-700">Upload a .gpx file</label>
      <input id="gpx-input" type="file" accept=".gpx"
        className="block w-full text-sm text-stone-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-semibold file:text-stone-900 hover:file:bg-amber-400"
        onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />
      <p className="mt-2 text-xs text-stone-600">Or drop one GPX file here. Your file is read locally, not uploaded.</p>
      {course && course.gpx.tracks.length > 1 && <div id="track-picker" className="mt-3">
        <label htmlFor="track-select" className="text-sm font-medium">This file has multiple tracks. Choose a track:</label>
        <select id="track-select" value={course.trackIndex < 0 ? "" : course.trackIndex}
          className="rounded border border-stone-300 bg-white p-2 text-sm" onChange={event => void changeTrack(Number(event.target.value))}>
          <option value="" disabled>Choose a track…</option>
          {course.gpx.tracks.map((track, index) => <option key={index} value={index} disabled={!track.trackpoints.length}>
            {track.name || `Track ${index + 1}`} ({track.trackpoints.length.toLocaleString()} points)
          </option>)}
        </select>
      </div>}
      <fieldset className="mt-3 space-y-2"><legend className="text-sm font-semibold">Detection strategies</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["waypoint", "speed"] as const).map(strategy => <label key={strategy}>
            <input id={strategy === "waypoint" ? "use-waypoints" : "use-speed"} type="checkbox" checked={strategies.includes(strategy)}
              onChange={event => void toggleStrategy(strategy, event.target.checked)} /> {strategy === "waypoint" ? "Waypoints" : "Speed"}
          </label>)}
        </div>
        <div className="rounded border-2 border-stone-900 bg-amber-50 p-3 text-sm">
          <label className="flex cursor-pointer items-start gap-2">
            <input id="use-terrain" type="checkbox" className="mt-1 h-4 w-4" checked={strategies.includes("landscape")}
              onChange={event => void toggleStrategy("landscape", event.target.checked)} />
            <span><strong>Use terrain data</strong> <span className="rounded bg-stone-950 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-400">Recommended</span>
              <span className="mt-1 block">This is what makes TigerLegs <em>terrain-informed</em>: lakes and rivers from OpenStreetMap show where your track is really in the water, for more accurate swims. Switched off, the analysis only uses speed and waypoints, locally.</span></span>
          </label>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-700">
            <a href="https://overpass-api.de" className="inline-flex items-center" aria-label="Overpass API">
              <img src={`${base}img/overpass-api-logo.svg`} alt="" width="60" height="24" className="h-6 w-auto" />
            </a>
            <span>Terrain data © <a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL), served by the <a className="underline" href="https://overpass-api.de">Overpass API</a>. Logo: <a className="underline" href="https://wiki.openstreetmap.org/wiki/File:Overpass_API_logo.svg">OpenStreetMap Wiki</a>, CC BY-SA 2.0.</span>
          </p>
        </div>
        {strategies.includes("landscape") && <p id="terrain-warning" className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-stone-800">Warning: with terrain data on, the rough area of the track (a coarse bounding box, not the track itself) and your IP address are sent to OpenStreetMap's Overpass service to look up lakes and rivers. Your GPX file is never uploaded.</p>}
      </fieldset>
      <p id="analysis-status" role="status" className="mt-2 text-sm text-stone-700">{status}</p>
      {warning && <p id="point-warning" role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-stone-800">{warning}</p>}
      {notice && <p id="notice" role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-stone-800">{notice}</p>}
      <p id="message" role="alert" className="mt-2 text-sm font-medium text-red-700">{message}</p>
    </section>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <CourseMap points={points} segments={visible} water={course?.water ?? EMPTY_WATER} active={active}
        preview={setHovered} select={number => {
          select(number);
          results.current?.querySelectorAll<HTMLTableRowElement>("[data-segment-numbers]").forEach(row => {
            if (row.dataset.segmentNumbers?.split(",").includes(String(number))) row.scrollIntoView({ block: "nearest", inline: "nearest" });
          });
        }} />
      <div id="results" ref={results} className="overflow-y-auto rounded-lg border border-stone-200 border-t-4 border-t-stone-950 bg-white shadow-sm lg:col-span-2 lg:max-h-[75vh]">
        <label className="flex cursor-pointer items-center justify-end gap-2 border-b border-stone-100 px-3 py-2 text-sm text-stone-700">
          <span>Include breaks</span><input id="include-breaks" type="checkbox" className="peer sr-only" checked={includeBreaks} onChange={event => { setIncludeBreaks(event.target.checked); presentationChange(); }} />
          <span className="relative h-6 w-11 rounded-full bg-stone-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-amber-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2" />
        </label>
        <div id="totals" className="border-b border-stone-100 px-4 py-3">
          {course?.analysis && <>
            <h2 className="text-base font-semibold text-stone-900">{course.analysis.trackName || "Unnamed track"}</h2>
            <p className="truncate text-xs text-stone-500" title={course.file}>{course.file}</p>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {times && [["Moving time", times.moving], ["Event time", times.event]].map(([label, value]) => <div key={label}><dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{value}</dd></div>)}
              <div><dt className="text-xs uppercase tracking-wide text-stone-500">Detected by</dt>
                <dd className="flex flex-wrap gap-1">{course.analysis.strategies.map(strategy => <span key={strategy} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{strategy}</span>)}</dd></div>
            </dl>
          </>}
        </div>
        <div className="flex flex-wrap gap-4 px-3 py-2 text-sm">
          <label><input id="swim-first" type="checkbox" checked={swimFirst} onChange={event => { setSwimFirst(event.target.checked); presentationChange(); }} /> Swim first</label>
          <label><input id="show-cumulative" type="checkbox" checked={showCumulative} onChange={event => { setShowCumulative(event.target.checked); presentationChange(); }} /> Cumulative distance</label>
        </div>
        <p id="segment-help" className="px-3 py-2 text-xs text-stone-600">Click a map line or table row to select a segment; click it again to deselect. Use Tab to reach segment buttons and Enter or Space to select. Escape clears the selection.</p>
        <SegmentTable segments={visible} totals={course?.analysis?.totals ?? { totalRunKm: "0.0", totalSwimM: "0" }}
          conflicts={course?.analysis?.conflicts ?? []} config={{ swimFirst, showCumulative }}
          active={active} selected={selected} select={select} preview={setHovered} clear={() => { setSelected(null); setHovered(null); }} />
      </div>
    </div>
    </div>
    </div>
  </>;
}
