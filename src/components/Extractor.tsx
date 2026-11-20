import { useEffect, useMemo, useRef, useState } from "react";
import { largeFileMegabytes, readFileAsText, validateFile } from "../client/file-upload.ts";
import { analyzeGpx, type Analysis } from "../client/analyze.ts";
import { importWarnings, requiresAnalysisWorker } from "../client/analysis-job.ts";
import { runWorkerJob } from "../client/worker-client.ts";
import { detectApplicableStrategies } from "../client/strategy-combiner.ts";
import { fetchWater, type WaterBody } from "../client/water.ts";
import { haversineDistance } from "../shared/distance-calculator.ts";
import { Trans } from "react-i18next";
import { i18nInstance } from "../client/i18n.ts";
import { localizeNumber } from "../client/numbers.ts";
import type { GPXData, StrategyName, Trackpoint } from "../shared/types.ts";
import CourseMap from "./CourseMap.tsx";
import LegsBar from "./LegsBar.tsx";
import SampleMenu from "./SampleMenu.tsx";
import Toggle from "./Toggle.tsx";
import { useExtractorT } from "./useExtractorT.ts";
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
  const { t, lang } = useExtractorT();
  const num = (text: string) => localizeNumber(text, lang);
  const largeNotice = (sizeBytes: number, downloaded: boolean) => {
    const mb = largeFileMegabytes(sizeBytes);
    return mb === null ? null : t("largeFile", { mb, downloaded: String(downloaded) });
  };
  const [course, setCourse] = useState<Course | null>(null);
  const current = useRef<Course | null>(null);
  const [strategies, setStrategies] = useState<StrategyName[]>(["waypoint", "speed"]);
  const enabled = useRef(strategies);
  const [status, setStatus] = useState("");
  // The question whether to use terrain data, asked when it matters: after an own file was analysed, or on request.
  const [terrainAsk, setTerrainAsk] = useState(false);
  const terrainDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = terrainDialog.current;
    if (!dialog) return;
    if (terrainAsk && !dialog.open) dialog.showModal();
    if (!terrainAsk && dialog.open) dialog.close();
  }, [terrainAsk]);
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
    if (target.trackIndex < 0) { setStatus(t("statusChooseTrack")); return; }
    requests.current.analysis?.abort();
    const request = new AbortController();
    requests.current.analysis = request;
    const trackIndex = target.trackIndex;
    const track = target.gpx.tracks[trackIndex];
    const options = { trackIndex, enabledStrategies: [...enabled.current] };
    const water = enabled.current.includes("landscape") ? target.water ?? [] : [];
    const worker = requiresAnalysisWorker(track.trackpoints.length);
    setStatus(worker ? t("statusAnalysingWorker") : t("statusAnalysing"));
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
      setStatus(t("statusAnalysed", { count: track.trackpoints.length, seconds: (performance.now() - started) / 1000, worker: String(worker) }) +
        (inactive.length ? t("noUsableData", { strategies: inactive.join(", ") }) : ""));
    } catch (error) {
      if (request.signal.aborted || current.current !== target) return;
      setStatus(t("analysisFailed"));
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadWater(target: Course) {
    if (target.trackIndex < 0) return;
    requests.current.terrain?.abort();
    const request = new AbortController();
    requests.current.terrain = request;
    const index = target.trackIndex;
    setMessage(t("loadingWater"));
    try {
      const water = await fetchWater(target.gpx.tracks[index].trackpoints, request.signal);
      if (request.signal.aborted || current.current !== target || target.trackIndex !== index || !enabled.current.includes("landscape")) return;
      target.water = water;
      update(target);
      setMessage(water.length ? "" : t("noWater"));
      await runAnalysis(target);
    } catch (error) {
      if (request.signal.aborted || current.current !== target) return;
      fail(t("terrainUnavailable", { reason: error instanceof Error ? error.message : String(error) }));
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
    setStatus(t("readingGpx"));
    const reply = await runWorkerJob({ kind: "parse", xml }, request.signal);
    if (reply.kind !== "parse") throw new Error("Unexpected GPX worker response");
    if (!reply.result.ok) throw new Error(reply.result.error);
    if (request.signal.aborted) return;
    const counts = importWarnings(reply.result.value);
    if (counts.confirmationRequired && !globalThis.confirm(t("confirmLarge", { count: counts.trackpoints }))) {
      setStatus(t("importCancelled"));
      return;
    }
    requests.current.analysis?.abort();
    requests.current.terrain?.abort();
    const target: Course = { file, gpx: reply.result.value, trackIndex: counts.trackSelectionRequired ? -1 : 0 };
    current.current = target;
    update(target);
    setSelected(null);
    setHovered(null);
    setWarning(counts.manyWaypoints ? t("manyWaypoints", { count: counts.waypoints }) : "");
    setMessage("");
    await runAnalysis(target);
    if (current.current === target && enabled.current.includes("landscape")) await loadWater(target);
  }
  async function importFile(file: File) {
    const validation = validateFile(file);
    if (!validation.valid) { fail(validation.code === "notGpx" ? t("onlyGpx") : validation.code === "tooLarge" ? t("fileTooLarge") : t("invalidFile")); return; }
    const request = beginImport();
    setNotice(largeNotice(file.size, false));
    try {
      const xml = await readFileAsText(file);
      if (!request.signal.aborted) await importText(file.name, xml, request);
      if (!request.signal.aborted && current.current?.file === file.name && current.current.analysis && !enabled.current.includes("landscape")) setTerrainAsk(true);
    } catch (error) {
      if (request.signal.aborted) return;
      setStatus(t("importFailed"));
      fail(error instanceof Error ? error.message : String(error));
    }
  }
  async function importSample(name: string) {
    const request = beginImport();
    setStatus(t("downloadingSample"));
    setNotice(null);
    try {
      const response = await fetch(`${base}samples/${name}`, { signal: request.signal });
      if (!response.ok) throw new Error(t("sampleLoadFailed", { status: response.status }));
      setNotice(largeNotice(Number(response.headers.get("content-length") ?? 0), true));
      const xml = await response.text();
      if (request.signal.aborted) return;
      setNotice(largeNotice(new Blob([xml]).size, true));
      await importText(name, xml, request);
    } catch (error) {
      if (request.signal.aborted) return;
      setStatus(t("importFailed"));
      fail(error instanceof Error ? error.message : String(error));
    }
  }
  async function changeTrack(index: number) {
    const target = current.current;
    if (!target) return;
    if (!target.gpx.tracks[index]?.trackpoints.length) { fail(t("selectTrackWithPoints")); return; }
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
        setMessage(t("atLeastOneStrategy"));
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
    if (restored && current.current === target) setMessage(t("terrainDisabled"));
    if (current.current === target && next.includes("landscape") && !target.water && strategy === "landscape") await loadWater(target);
  }

  const points = course && course.trackIndex >= 0 ? course.gpx.tracks[course.trackIndex].trackpoints : EMPTY_POINTS;
  const visible = useMemo(() => course?.analysis?.segments.filter(s => includeBreaks || s.type !== "unclassified") ?? [], [course?.analysis, includeBreaks]);
  const times = useMemo(() => timeSummary(points), [points]);
  // The date of the first timestamp: a date that each language writes in its own way.
  const recordedAt = useMemo(() => {
    const first = Date.parse(points[0]?.timestamp ?? "");
    return Number.isNaN(first) ? null : new Date(first);
  }, [points]);
  const active = selected ?? hovered;
  const select = (number: number) => setSelected(previous => previous === number ? null : number);
  const presentationChange = () => { setSelected(null); setHovered(null); };
  return <>
    <noscript><p>{t("noscript")}</p></noscript>
    <SampleMenu base={base} load={file => void importSample(file)} />
    <div className="min-w-0">
    <section id="drop-zone" aria-label={t("dropZone")}
      className={`mb-4 rounded-lg border border-stone-200 border-t-4 border-t-amber-500 bg-white p-4 shadow-sm${dragging ? " drop-active" : ""}`}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={event => {
        event.preventDefault(); setDragging(false);
        if (event.dataTransfer.files.length !== 1) { fail(t("dropOne")); return; }
        void importFile(event.dataTransfer.files[0]);
      }}>
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
      <div>
      <label htmlFor="gpx-input" className="mb-2 block text-sm font-medium text-stone-700">{t("upload")}</label>
      <input id="gpx-input" type="file" accept=".gpx"
        className="block w-full text-sm text-stone-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-semibold file:text-stone-900 hover:file:bg-amber-400"
        onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />
      <p className="mt-2 text-xs text-stone-600">{t("dropHint")}</p>
      {course && course.gpx.tracks.length > 1 && <div id="track-picker" className="mt-3">
        <label htmlFor="track-select" className="text-sm font-medium">{t("multipleTracks")}</label>
        <select id="track-select" value={course.trackIndex < 0 ? "" : course.trackIndex}
          className="rounded border border-stone-300 bg-white p-2 text-sm" onChange={event => void changeTrack(Number(event.target.value))}>
          <option value="" disabled>{t("chooseTrack")}</option>
          {course.gpx.tracks.map((track, index) => <option key={index} value={index} disabled={!track.trackpoints.length}>
            {t("trackOption", { name: track.name || t("trackName", { number: index + 1 }), count: track.trackpoints.length })}
          </option>)}
        </select>
      </div>}
      </div>
      <fieldset className="mt-3 space-y-2 lg:mt-0"><legend className="text-sm font-semibold">{t("howSwimsFound")}</legend>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t("localStrategies")}</summary>
          <div className="mt-1 flex flex-wrap gap-4">
            {(["waypoint", "speed"] as const).map(strategy => <label key={strategy}>
              <input id={strategy === "waypoint" ? "use-waypoints" : "use-speed"} type="checkbox" checked={strategies.includes(strategy)}
                onChange={event => void toggleStrategy(strategy, event.target.checked)} /> {strategy === "waypoint" ? t("waypoints") : t("speed")}
            </label>)}
          </div>
        </details>
        {strategies.includes("landscape") && <p id="terrain-warning" className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-stone-800">{t("terrainWarning")} <a className="underline" href="#terrain-details" onClick={() => { const details = document.getElementById("terrain-details") as HTMLDetailsElement | null; if (details) details.open = true; }}>{t("more")}</a></p>}
      </fieldset>
      </div>
      <p id="analysis-status" role="status" className="mt-2 text-sm text-stone-700">{status}</p>
      {course?.analysis && <p className="mt-1 text-sm">
        {strategies.includes("landscape")
          ? <button type="button" id="terrain-off" className="underline" onClick={() => void toggleStrategy("landscape", false)}>{t("terrainOff")}</button>
          : <button type="button" id="terrain-ask" className="underline" onClick={() => setTerrainAsk(true)}>{t("terrainAsk")}</button>}
      </p>}
      {warning && <p id="point-warning" role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-stone-800">{warning}</p>}
      {notice && <p id="notice" role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-stone-800">{notice}</p>}
      <p id="message" role="alert" className="mt-2 text-sm font-medium text-red-700">{message}</p>
    </section>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">
        <CourseMap points={points} segments={visible} water={course?.water ?? EMPTY_WATER} active={active}
          preview={setHovered} select={number => {
            select(number);
            results.current?.querySelectorAll<HTMLTableRowElement>("[data-segment-numbers]").forEach(row => {
              if (row.dataset.segmentNumbers?.split(",").includes(String(number))) row.scrollIntoView({ block: "nearest", inline: "nearest" });
            });
          }} />
        <LegsBar segments={visible} points={points} active={active} selected={selected} select={select} preview={setHovered} />
      </div>
      <div id="results" ref={results} className="overflow-y-auto rounded-lg border border-stone-200 border-t-4 border-t-stone-950 bg-white shadow-sm lg:col-span-2 lg:max-h-[75vh]">
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-stone-100 px-3 py-2">
          <Toggle id="include-breaks" label={t("showBreaks")} checked={includeBreaks} onChange={checked => { setIncludeBreaks(checked); presentationChange(); }} />
          <fieldset className="flex items-center gap-4 text-sm text-stone-700"><legend className="sr-only">{t("tableOrder")}</legend>
            <label className="flex cursor-pointer items-center gap-1"><input id="run-first" type="radio" name="table-order" checked={!swimFirst} onChange={() => { setSwimFirst(false); presentationChange(); }} /> {t("runFirst")}</label>
            <label className="flex cursor-pointer items-center gap-1"><input id="swim-first" type="radio" name="table-order" checked={swimFirst} onChange={() => { setSwimFirst(true); presentationChange(); }} /> {t("swimFirst")}</label>
          </fieldset>
          <Toggle id="show-cumulative" label={t("showCumulative")} checked={showCumulative} onChange={checked => { setShowCumulative(checked); presentationChange(); }} />
        </div>
        <div id="totals" className="border-b border-stone-100 px-4 py-3">
          {course?.analysis && <>
            <h2 className="text-base font-semibold text-stone-900">{course.analysis.trackName || t("unnamedTrack")}</h2>
            <p className="truncate text-xs text-stone-500" title={course.file}>{course.file}</p>
            {recordedAt && <p className="text-xs text-stone-500">{t("recorded", { date: recordedAt })}</p>}
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {times && [[t("movingTime"), times.moving], [t("eventTime"), times.event]].map(([label, value]) => <div key={label}><dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{value}</dd></div>)}
              <div><dt className="text-xs uppercase tracking-wide text-stone-500">{t("detectedBy")}</dt>
                <dd className="flex flex-wrap gap-1">{course.analysis.strategies.map(strategy => <span key={strategy} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{strategy}</span>)}</dd></div>
            </dl>
          </>}
        </div>
        <p id="segment-help" className="px-3 py-2 text-xs text-stone-600">{t("segmentHelp")}</p>
        <SegmentTable segments={visible} totals={course?.analysis?.totals ?? { totalRunKm: "0.0", totalSwimM: "0" }}
          conflicts={course?.analysis?.conflicts ?? []} config={{ swimFirst, showCumulative }}
          active={active} selected={selected} select={select} preview={setHovered} clear={() => { setSelected(null); setHovered(null); }} />
      </div>
    </div>
    </div>
    <dialog ref={terrainDialog} id="terrain-dialog" aria-labelledby="terrain-title" onClose={() => setTerrainAsk(false)}
      className="m-auto max-w-md rounded-lg border-2 border-stone-900 bg-amber-50 p-4 text-sm text-stone-800 shadow-lg backdrop:bg-stone-900/50">
      <h2 id="terrain-title" className="text-base font-bold">{t("terrainTitle")}</h2>
      <p className="mt-2"><Trans i18n={i18nInstance()} t={t} i18nKey="terrainIntro" components={{ em: <em /> }} /></p>
      <p id="terrain-sent" className="mt-2 rounded border border-amber-300 bg-white p-2 text-xs">{t("terrainSent")}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-700">
        <a href="https://overpass-api.de" className="inline-flex items-center" aria-label={t("overpassLabel")}>
          <img src={`${base}img/overpass-api-logo.svg`} alt="" width="60" height="24" className="h-6 w-auto" />
        </a>
        <span><Trans i18n={i18nInstance()} t={t} i18nKey="terrainCredits" components={{
          osm: <a className="underline" href="https://www.openstreetmap.org/copyright" />,
          overpass: <a className="underline" href="https://overpass-api.de" />,
          wiki: <a className="underline" href="https://wiki.openstreetmap.org/wiki/File:Overpass_API_logo.svg" />,
        }} /></span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" id="use-terrain" className="rounded bg-stone-900 px-4 py-2 font-semibold text-white" onClick={() => { setTerrainAsk(false); void toggleStrategy("landscape", true); }}>{t("terrainYes")}</button>
        <button type="button" id="keep-local" className="rounded border border-stone-900 bg-white px-4 py-2 font-semibold" onClick={() => setTerrainAsk(false)}>{t("terrainNo")}</button>
      </div>
    </dialog>
  </>;
}
