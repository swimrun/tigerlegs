import { useEffect, useMemo, useRef, useState } from "react";
import { isLang, type Lang } from "../client/language.ts";
import {
  applyMoves,
  changedSessions,
  type Day,
  DAYS,
  DEFAULT_LEVERS,
  generateWeek,
  LEVER_LIMITS,
  type PlanLevers,
  planRestDay,
  PROTOTYPE_WEEK,
  type TrainingSession,
} from "../client/training-week.ts";
import { getLanguageModel, type LanguageModelStatic } from "../client/prompt-api.ts";
import { createTrainingAgent } from "../client/training-agent.ts";
import { setPageChat } from "../client/chat-store.ts";
import { STRINGS } from "./TrainingWeek.strings.ts";

/** The colour classes of styles.css, shared with the extractor: a trail run is green, a road run grey. */
const toneOf = (session: TrainingSession): string =>
  session.discipline === "run"
    ? session.surface === "trail" ? "tone-trail" : "tone-road"
    : {
      swim: "tone-swim",
      swimrun: "tone-swimrun",
      strength: "tone-strength",
      flexibility: "tone-mobility",
    }[session.discipline];

/** The page language, which the language switch keeps on the `lang` attribute of `<html>`. */
function usePageLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const read = () => {
      const value = document.documentElement.lang;
      setLang(isLang(value) ? value : "en");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    return () => observer.disconnect();
  }, []);
  return lang;
}

interface Props {
  /** Overridable for tests and stories; defaults to the browser's Prompt API. */
  languageModel?: LanguageModelStatic | null;
}

export default function TrainingWeek({ languageModel }: Props) {
  const model = useMemo(
    () => languageModel !== undefined ? languageModel : getLanguageModel(),
    [languageModel],
  );
  const lang = usePageLang();
  const t = STRINGS[lang];

  const [baseline, setBaseline] = useState<readonly TrainingSession[]>(
    PROTOTYPE_WEEK,
  );
  const [week, setWeek] = useState<readonly TrainingSession[]>(PROTOTYPE_WEEK);
  const [confirmed, setConfirmed] = useState(false);
  // Fixed rest days: days on which no session may be planned (a plan lever, spec 003).
  const [restDays, setRestDays] = useState<readonly Day[]>([]);
  const [baselineRest, setBaselineRest] = useState<readonly Day[]>([]);
  // What a reset replaced, so that it can be undone until something else changes.
  const [undo, setUndo] = useState<
    { kind: "reset" | "generate"; week: readonly TrainingSession[]; baseline: readonly TrainingSession[]; restDays: readonly Day[]; baselineRest: readonly Day[] } | null
  >(null);
  const [levers, setLevers] = useState<PlanLevers>(DEFAULT_LEVERS);
  const [notice, setNotice] = useState("");
  const restRef = useRef(restDays);
  restRef.current = restDays;

  // The agent reads the week through a ref, so it always sees manual changes without being recreated.
  const weekRef = useRef(week);
  weekRef.current = week;
  const titleOf = (session: TrainingSession) => t.sessionTitles[session.id] ?? session.title;
  const agent = useMemo(
    () =>
      createTrainingAgent({
        model,
        lang,
        strings: { ...t, sessionTitle: (session: TrainingSession) => t.sessionTitles[session.id] ?? session.title },
        getWeek: () => weekRef.current,
        getRestDays: () => restRef.current,
        onApply: (moves, rest) => {
          setWeek((current) => applyMoves(current, moves));
          setRestDays(rest);
          setNotice("");
          setUndo(null);
          setConfirmed(false);
        },
      }),
    [model, lang, t],
  );

  const changes = changedSessions(baseline, week);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<Day | null>(null);
  const moveSession = (id: string, toDay: Day) => {
    if (restDays.includes(toDay)) {
      setNotice(t.restDayBlocked(t.days[toDay]));
      return;
    }
    setNotice("");
    setUndo(null);
    setWeek((current) => applyMoves(current, [{ id, toDay, reason: "" }]));
    setConfirmed(false);
  };
  // Choosing a sports rest day moves its sessions out by the same rules the assistant uses.
  const toggleRestDay = (day: Day) => {
    setNotice("");
    setUndo(null);
    if (restDays.includes(day)) {
      setRestDays(restDays.filter((candidate) => candidate !== day));
      return;
    }
    const plan = planRestDay(week, restDays, day);
    setWeek(applyMoves(week, plan.moves));
    setRestDays(plan.restDays);
    setConfirmed(false);
  };

  const restChanged = restDays.length !== baselineRest.length || restDays.some((day) => !baselineRest.includes(day));
  const dirty = changes.length > 0 || restChanged;
  const resetAll = () => {
    setUndo({ kind: "reset", week, baseline, restDays, baselineRest });
    setWeek(baseline);
    setRestDays(baselineRest);
    setNotice(t.resetDone);
    setConfirmed(false);
  };
  const undoReset = () => {
    if (!undo) return;
    setWeek(undo.week);
    setBaseline(undo.baseline);
    setRestDays(undo.restDays);
    setBaselineRest(undo.baselineRest);
    setUndo(null);
    setNotice("");
  };
  // The levers set the plan at the top: the generated week becomes the confirmed one.
  const generate = () => {
    const { week: generated, unplaced } = generateWeek(levers, restDays);
    setUndo({ kind: "generate", week, baseline, restDays, baselineRest });
    setWeek(generated);
    setBaseline(generated);
    setBaselineRest(restDays);
    setNotice(unplaced.length > 0 ? t.notPlaced(unplaced.length) : t.generated);
    setConfirmed(false);
  };

  const endDrag = () => {
    setDraggingId(null);
    setOverDay(null);
  };

  // The chat lives in the site layout; while this page is shown, it moves training sessions.
  useEffect(() => {
    setPageChat({ agent, title: t.chatTitle, placeholder: t.instructionPlaceholder });
    return () => setPageChat(null);
  }, [agent, t]);

  return (
    <div className="space-y-6">
      <p className="rounded border-2 border-stone-900 bg-amber-50 p-3 text-sm">
        {t.prototypeNote}
      </p>

      <section aria-labelledby="levers-title" className="space-y-2 rounded border border-stone-300 bg-white p-3">
        <h2 id="levers-title" className="text-lg font-bold">{t.leversTitle}</h2>
        <p className="text-sm text-stone-600">{t.leversHint}</p>
        <div className="flex flex-wrap items-end gap-3">
          {(Object.keys(LEVER_LIMITS) as (keyof PlanLevers)[]).map((key) => (
            <label key={key} className="block text-sm">
              <span className="block font-medium">{t.leverLabels[key]}</span>
              <input
                type="number"
                min={0}
                max={LEVER_LIMITS[key]}
                value={levers[key]}
                onChange={(event) => setLevers({ ...levers, [key]: Number(event.target.value) })}
                className="w-20 rounded border border-stone-900 bg-white px-2 py-1"
              />
            </label>
          ))}
          <button
            type="button"
            className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={generate}
          >
            {t.generate}
          </button>
          <details className="relative ml-auto text-sm" data-rest-days>
            <summary className="cursor-pointer rounded border border-stone-900 bg-white px-2 py-1">
              <span className="font-medium">{t.restDaysLabel}: </span>
              {restDays.length > 0 ? DAYS.filter((day) => restDays.includes(day)).map((day) => t.days[day]).join(", ") : t.restDaysNone}
            </summary>
            <fieldset className="absolute right-0 z-10 mt-1 space-y-1 rounded border border-stone-900 bg-white p-2 shadow">
              <legend className="sr-only">{t.restDaysLabel}</legend>
              {DAYS.map((day) => (
                <label key={day} className="flex items-center gap-2">
                  <input type="checkbox" checked={restDays.includes(day)} onChange={() => toggleRestDay(day)} />
                  {t.days[day]}
                </label>
              ))}
            </fieldset>
          </details>
        </div>
      </section>

      <p className="text-sm text-stone-600">{t.dragHint}</p>
      <p role="status" className="text-sm font-medium text-amber-900">{notice}</p>

      <ol
        aria-label={t.weekTitle}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7"
      >
        {DAYS.map((day) => (
          <li
            key={day}
            data-day={day}
            className={`min-h-24 rounded border p-2 ${restDays.includes(day) ? "bg-stone-100" : "bg-white"} ${
              overDay === day && draggingId
                ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500"
                : "border-stone-300"
            }`}
            onDragOver={(event) => {
              if (!draggingId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverDay(day);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverDay(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = draggingId || event.dataTransfer.getData("text/plain");
              if (id) moveSession(id, day);
              endDrag();
            }}
          >
            <h3 className="text-sm font-bold">{t.days[day]}</h3>
            {restDays.includes(day) && (
              <p data-rest-day={day} className="mt-1 inline-block rounded bg-stone-900 px-2 py-0.5 text-xs font-medium text-white">
                {t.restDay}
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {week.filter((session) => session.day === day).map((session) => (
                <li
                  key={session.id}
                  data-session={session.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", session.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingId(session.id);
                  }}
                  onDragEnd={endDrag}
                  className={`cursor-grab rounded border px-2 py-1 text-xs active:cursor-grabbing tone ${toneOf(session)} ${
                    draggingId === session.id ? "opacity-50" : ""
                  }`}
                >
                  <span className="font-semibold">
                    {t.disciplines[session.discipline]}
                    {session.discipline === "run" && ` · ${t.surfaces[session.surface ?? "road"]}`}
                  </span>
                  <p>{titleOf(session)}</p>
                  <label className="mt-1 block">
                    <span className="sr-only">
                      {`${t.dayLabel}: ${titleOf(session)}`}
                    </span>
                    <select
                      className="w-full rounded border border-stone-900 bg-white px-1 py-0.5 text-xs"
                      value={session.day}
                      onChange={(event) =>
                        moveSession(session.id, event.target.value as Day)}
                    >
                      {DAYS.map((option) => (
                        <option key={option} value={option} disabled={restDays.includes(option)}>
                          {t.days[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section aria-labelledby="changes-title" className="space-y-2">
        <h2 id="changes-title" className="text-lg font-bold">
          {t.changesTitle}
        </h2>
        {/* A live region that is always there, so that a screen reader announces a move, by hand or by drag. */}
        <div aria-live="polite">
          {changes.length === 0
            ? <p className="text-sm text-stone-600">{t.noChanges}</p>
            : (
              <ul className="space-y-1 text-sm">
                {changes.map(({ session, fromDay }) => (
                  <li key={session.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {t.movedFromTo(
                        titleOf(session),
                        t.days[fromDay],
                        t.days[session.day],
                      )}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-stone-900 bg-white px-2 py-0.5 text-xs font-medium"
                      onClick={() => moveSession(session.id, fromDay)}
                    >
                      {t.revert}
                      <span className="sr-only">{`: ${titleOf(session)}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty && (
            <button
              type="button"
              className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setBaseline(week);
                setBaselineRest(restDays);
                setUndo(null);
                setConfirmed(true);
              }}
            >
              {t.confirm}
            </button>
          )}
          {dirty && (
            <button
              type="button"
              className="rounded border border-stone-900 bg-white px-4 py-2 text-sm font-semibold"
              onClick={resetAll}
            >
              {t.resetAll}
            </button>
          )}
          {undo && (
            <button
              type="button"
              className="rounded border border-stone-900 bg-amber-200 px-4 py-2 text-sm font-semibold"
              onClick={undoReset}
            >
              {undo.kind === "generate" ? t.undoGenerate : t.undoReset}
            </button>
          )}
        </div>
        {confirmed && <p role="status" className="text-sm">{t.confirmed}</p>}
      </section>
    </div>
  );
}
