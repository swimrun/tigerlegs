import { useEffect, useMemo, useRef, useState } from "react";
import { isLang, type Lang } from "../client/language.ts";
import {
  applyMoves,
  changedSessions,
  type Day,
  DAYS,
  type Discipline,
  planRestDay,
  PROTOTYPE_WEEK,
  type TrainingSession,
} from "../client/training-week.ts";
import type { IssueKind } from "../client/training-week.ts";
import { getLanguageModel, type LanguageModelStatic } from "../client/prompt-api.ts";
import { createTrainingAgent } from "../client/training-agent.ts";
import { setPageChat } from "../client/chat-store.ts";

interface Strings {
  prototypeNote: string;
  weekTitle: string;
  dayLabel: string;
  dragHint: string;
  assistAbsent: string;
  assistUnavailable: string;
  assistDownloadable: string;
  assistEnable: string;
  assistInstalled: string;
  chatTitle: string;
  applied: string;
  dismissed: string;
  assistDownloading: string;
  instructionPlaceholder: string;
  proposalTitle: string;
  proposalEmpty: string;
  apply: string;
  dismiss: string;
  assistFailed: string;
  changesTitle: string;
  noChanges: string;
  movedFromTo: (title: string, from: string, to: string) => string;
  restDay: string;
  restDayBlocked: (day: string) => string;
  nextStepsTitle: string;
  restDayBecomes: (day: string) => string;
  restDayReason: (day: string) => string;
  restDayAlready: (day: string) => string;
  leftOut: (title: string, day: string) => string;
  nextChip: (title: string, from: string, to: string) => string;
  fixReasons: Record<IssueKind, (day: string) => string>;
  confirm: string;
  confirmed: string;
  days: Record<Day, string>;
  disciplines: Record<Discipline, string>;
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    prototypeNote:
      "Design prototype: a hardcoded training week. Changes stay in your browser; nothing is sent to a server or coach yet.",
    weekTitle: "Training week",
    dayLabel: "Day",
    dragHint:
      "Drag a session to another day, or use the day selector of the session.",
    assistAbsent:
      "The assistant only works in Google Chrome on a desktop computer; this browser does not offer it. Rearranging by hand always works.",
    assistUnavailable:
      "Your Chrome cannot run the model on this device — it needs a recent computer and roughly 22 GB of free disk space. Rearranging by hand always works.",
    assistDownloadable:
      "Your Chrome can run Gemini Nano, but the model is not installed yet. Installing downloads it once (a few GB); Chrome requires about 22 GB of free disk space as headroom. Your schedule never leaves this device.",
    assistEnable: "Install Gemini Nano",
    assistInstalled: "Gemini Nano is installed. Ask again.",
    chatTitle: "Rearrange with the tiger",
    applied: "Applied. Confirm the new week below when you are happy.",
    dismissed: "Dismissed. Nothing was moved.",
    assistDownloading: "Downloading the model…",
    instructionPlaceholder: "e.g. I am travelling Thursday and Friday",
    proposalTitle: "Proposed moves",
    proposalEmpty: "The model proposed no moves for this instruction.",
    apply: "Apply proposal",
    dismiss: "Dismiss",
    assistFailed:
      "The assistant could not make a proposal. Rearranging by hand still works.",
    changesTitle: "Your changes",
    noChanges: "No changes yet.",
    movedFromTo: (title, from, to) => `${title}: ${from} → ${to}`,
    restDay: "Rest day",
    restDayBlocked: (day) => `${day} is a rest day: no session can go there.`,
    nextStepsTitle: "Possible next steps (one at a time)",
    restDayBecomes: (day) => `Rest day: ${day}`,
    restDayReason: (day) => `rest day on ${day}`,
    restDayAlready: (day) => `${day} is already a rest day.`,
    leftOut: (title, day) => `Left out: ${title} to ${day}, a rest day`,
    nextChip: (title, from, to) => `Next: ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `rest day on ${day}`,
      clash: (day) => `two sessions on ${day}`,
      "back-to-back-runs": (day) => `two runs in a row at ${day}`,
    },
    confirm: "Confirm new week",
    confirmed:
      "New week confirmed. Prototype: it stays in your browser; syncing to your coach is not built yet.",
    days: {
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
      Sun: "Sunday",
    },
    disciplines: {
      swim: "swim",
      run: "run",
      swimrun: "swimrun",
      strength: "strength",
      flexibility: "flexibility",
    },
  },
  nl: {
    prototypeNote:
      "Designprototype: een vaste trainingsweek. Wijzigingen blijven in je browser; er wordt nog niets naar een server of coach gestuurd.",
    weekTitle: "Trainingsweek",
    dayLabel: "Dag",
    dragHint:
      "Sleep een sessie naar een andere dag, of gebruik de dagkeuze van de sessie.",
    assistAbsent:
      "De assistent werkt alleen in Google Chrome op een desktopcomputer; deze browser biedt hem niet. Handmatig herschikken werkt altijd.",
    assistUnavailable:
      "Jouw Chrome kan het model niet draaien op dit apparaat — het vraagt een recente computer en ruwweg 22 GB vrije schijfruimte. Handmatig herschikken werkt altijd.",
    assistDownloadable:
      "Jouw Chrome kan Gemini Nano draaien, maar het model is nog niet geïnstalleerd. Installeren downloadt het eenmalig (enkele GB); Chrome eist zo'n 22 GB vrije schijfruimte als marge. Je schema verlaat dit apparaat nooit.",
    assistEnable: "Installeer Gemini Nano",
    assistInstalled: "Gemini Nano is geïnstalleerd. Vraag het opnieuw.",
    chatTitle: "Herschik met de tijger",
    applied: "Toegepast. Bevestig de nieuwe week hieronder als je tevreden bent.",
    dismissed: "Genegeerd. Er is niets verplaatst.",
    assistDownloading: "Model wordt gedownload…",
    instructionPlaceholder: "bijv. I am travelling Thursday and Friday",
    proposalTitle: "Voorgestelde verplaatsingen",
    proposalEmpty:
      "Het model stelde voor deze instructie geen verplaatsingen voor.",
    apply: "Voorstel toepassen",
    dismiss: "Verwerpen",
    assistFailed:
      "De assistent kon geen voorstel doen. Handmatig herschikken werkt nog steeds.",
    changesTitle: "Jouw wijzigingen",
    noChanges: "Nog geen wijzigingen.",
    movedFromTo: (title, from, to) => `${title}: ${from} → ${to}`,
    restDay: "Rustdag",
    restDayBlocked: (day) => `Op ${day} is het rustdag: daar kan geen sessie heen.`,
    nextStepsTitle: "Mogelijke vervolgstappen (één voor één)",
    restDayBecomes: (day) => `Rustdag: ${day}`,
    restDayReason: (day) => `rustdag op ${day}`,
    restDayAlready: (day) => `Op ${day} is al een rustdag.`,
    leftOut: (title, day) => `Weggelaten: ${title} naar ${day}, een rustdag`,
    nextChip: (title, from, to) => `Volgende: ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `rustdag op ${day}`,
      clash: (day) => `twee sessies op ${day}`,
      "back-to-back-runs": (day) => `twee keer achter elkaar hardlopen bij ${day}`,
    },
    confirm: "Bevestig nieuwe week",
    confirmed:
      "Nieuwe week bevestigd. Prototype: hij blijft in je browser; synchroniseren met je coach bestaat nog niet.",
    days: {
      Mon: "maandag",
      Tue: "dinsdag",
      Wed: "woensdag",
      Thu: "donderdag",
      Fri: "vrijdag",
      Sat: "zaterdag",
      Sun: "zondag",
    },
    disciplines: {
      swim: "zwemmen",
      run: "hardlopen",
      swimrun: "swimrun",
      strength: "kracht",
      flexibility: "lenigheid",
    },
  },
  fr: {
    prototypeNote:
      "Prototype de design : une semaine d'entraînement codée en dur. Les changements restent dans ton navigateur ; rien n'est encore envoyé à un serveur ou à un coach.",
    weekTitle: "Semaine d'entraînement",
    dayLabel: "Jour",
    dragHint:
      "Glisse une séance vers un autre jour, ou utilise le sélecteur de jour de la séance.",
    assistAbsent:
      "L'assistant ne fonctionne que dans Google Chrome sur un ordinateur de bureau ; ce navigateur ne le propose pas. La réorganisation manuelle fonctionne toujours.",
    assistUnavailable:
      "Ton Chrome ne peut pas exécuter le modèle sur cet appareil — il faut un ordinateur récent et environ 22 Go d'espace disque libre. La réorganisation manuelle fonctionne toujours.",
    assistDownloadable:
      "Ton Chrome peut exécuter Gemini Nano, mais le modèle n'est pas encore installé. L'installation le télécharge une seule fois (quelques Go) ; Chrome exige environ 22 Go d'espace disque libre en marge. Ton planning ne quitte jamais cet appareil.",
    assistEnable: "Installer Gemini Nano",
    assistInstalled: "Gemini Nano est installé. Redemande.",
    chatTitle: "Réorganise avec le tigre",
    applied: "Appliqué. Confirme la nouvelle semaine ci-dessous quand tu es satisfait·e.",
    dismissed: "Ignoré. Rien n'a été déplacé.",
    assistDownloading: "Téléchargement du modèle…",
    instructionPlaceholder: "p. ex. Je voyage jeudi et vendredi",
    proposalTitle: "Déplacements proposés",
    proposalEmpty:
      "Le modèle n'a proposé aucun déplacement pour cette instruction.",
    apply: "Appliquer la proposition",
    dismiss: "Rejeter",
    assistFailed:
      "L'assistant n'a pas pu faire de proposition. La réorganisation manuelle fonctionne toujours.",
    changesTitle: "Tes changements",
    noChanges: "Pas encore de changements.",
    movedFromTo: (title, from, to) => `${title} : ${from} → ${to}`,
    restDay: "Jour de repos",
    restDayBlocked: (day) => `Le ${day} est un jour de repos : aucune séance ne peut y aller.`,
    nextStepsTitle: "Étapes suivantes possibles (une à la fois)",
    restDayBecomes: (day) => `Jour de repos : ${day}`,
    restDayReason: (day) => `jour de repos le ${day}`,
    restDayAlready: (day) => `Le ${day} est déjà un jour de repos.`,
    leftOut: (title, day) => `Ignoré : ${title} vers ${day}, un jour de repos`,
    nextChip: (title, from, to) => `Ensuite : ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `jour de repos le ${day}`,
      clash: (day) => `deux séances le ${day}`,
      "back-to-back-runs": (day) => `deux courses de suite vers ${day}`,
    },
    confirm: "Confirmer la nouvelle semaine",
    confirmed:
      "Nouvelle semaine confirmée. Prototype : elle reste dans ton navigateur ; la synchronisation avec ton coach n'existe pas encore.",
    days: {
      Mon: "lundi",
      Tue: "mardi",
      Wed: "mercredi",
      Thu: "jeudi",
      Fri: "vendredi",
      Sat: "samedi",
      Sun: "dimanche",
    },
    disciplines: {
      swim: "natation",
      run: "course",
      swimrun: "swimrun",
      strength: "force",
      flexibility: "souplesse",
    },
  },
  de: {
    prototypeNote:
      "Design-Prototyp: eine fest einprogrammierte Trainingswoche. Änderungen bleiben in deinem Browser; nichts wird bisher an einen Server oder Coach gesendet.",
    weekTitle: "Trainingswoche",
    dayLabel: "Tag",
    dragHint:
      "Ziehe eine Einheit auf einen anderen Tag, oder nutze die Tagesauswahl der Einheit.",
    assistAbsent:
      "Der Assistent funktioniert nur in Google Chrome auf einem Desktop-Computer; dieser Browser bietet ihn nicht an. Manuelles Umplanen funktioniert immer.",
    assistUnavailable:
      "Dein Chrome kann das Modell auf diesem Gerät nicht ausführen — es braucht einen aktuellen Computer und rund 22 GB freien Speicherplatz. Manuelles Umplanen funktioniert immer.",
    assistDownloadable:
      "Dein Chrome kann Gemini Nano ausführen, aber das Modell ist noch nicht installiert. Die Installation lädt es einmalig herunter (einige GB); Chrome verlangt rund 22 GB freien Speicherplatz als Reserve. Dein Plan verlässt dieses Gerät nie.",
    assistEnable: "Gemini Nano installieren",
    assistInstalled: "Gemini Nano ist installiert. Frag noch einmal.",
    chatTitle: "Mit dem Tiger umplanen",
    applied: "Angewendet. Bestätige die neue Woche unten, wenn du zufrieden bist.",
    dismissed: "Verworfen. Nichts wurde verschoben.",
    assistDownloading: "Modell wird heruntergeladen…",
    instructionPlaceholder: "z. B. Ich bin Donnerstag und Freitag unterwegs",
    proposalTitle: "Vorgeschlagene Verschiebungen",
    proposalEmpty:
      "Das Modell hat für diese Anweisung keine Verschiebungen vorgeschlagen.",
    apply: "Vorschlag anwenden",
    dismiss: "Verwerfen",
    assistFailed:
      "Der Assistent konnte keinen Vorschlag machen. Manuelles Umplanen funktioniert weiterhin.",
    changesTitle: "Deine Änderungen",
    noChanges: "Noch keine Änderungen.",
    movedFromTo: (title, from, to) => `${title}: ${from} → ${to}`,
    restDay: "Ruhetag",
    restDayBlocked: (day) => `Am ${day} ist Ruhetag: dort kann keine Einheit hin.`,
    nextStepsTitle: "Mögliche nächste Schritte (einer nach dem anderen)",
    restDayBecomes: (day) => `Ruhetag: ${day}`,
    restDayReason: (day) => `Ruhetag am ${day}`,
    restDayAlready: (day) => `Am ${day} ist schon Ruhetag.`,
    leftOut: (title, day) => `Weggelassen: ${title} auf ${day}, einen Ruhetag`,
    nextChip: (title, from, to) => `Danach: ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `Ruhetag am ${day}`,
      clash: (day) => `zwei Einheiten am ${day}`,
      "back-to-back-runs": (day) => `zwei Läufe hintereinander bei ${day}`,
    },
    confirm: "Neue Woche bestätigen",
    confirmed:
      "Neue Woche bestätigt. Prototyp: sie bleibt in deinem Browser; die Synchronisierung mit deinem Coach gibt es noch nicht.",
    days: {
      Mon: "Montag",
      Tue: "Dienstag",
      Wed: "Mittwoch",
      Thu: "Donnerstag",
      Fri: "Freitag",
      Sat: "Samstag",
      Sun: "Sonntag",
    },
    disciplines: {
      swim: "Schwimmen",
      run: "Laufen",
      swimrun: "Swimrun",
      strength: "Kraft",
      flexibility: "Beweglichkeit",
    },
  },
};

const DISCIPLINE_STYLES: Record<Discipline, string> = {
  swim: "bg-sky-200 border-sky-900 text-sky-950",
  run: "bg-amber-200 border-amber-900 text-amber-950",
  swimrun: "bg-emerald-200 border-emerald-900 text-emerald-950",
  strength: "bg-rose-200 border-rose-900 text-rose-950",
  flexibility: "bg-violet-200 border-violet-900 text-violet-950",
};

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
  const [notice, setNotice] = useState("");
  const restRef = useRef(restDays);
  restRef.current = restDays;

  // The agent reads the week through a ref, so it always sees manual changes without being recreated.
  const weekRef = useRef(week);
  weekRef.current = week;
  const agent = useMemo(
    () =>
      createTrainingAgent({
        model,
        lang,
        strings: t,
        getWeek: () => weekRef.current,
        getRestDays: () => restRef.current,
        onApply: (moves, rest) => {
          setWeek((current) => applyMoves(current, moves));
          setRestDays(rest);
          setNotice("");
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
    setWeek((current) => applyMoves(current, [{ id, toDay, reason: "" }]));
    setConfirmed(false);
  };
  // Making a day a rest day moves its sessions out by the same rules the assistant uses.
  const toggleRestDay = (day: Day) => {
    setNotice("");
    if (restDays.includes(day)) {
      setRestDays(restDays.filter((candidate) => candidate !== day));
      return;
    }
    const plan = planRestDay(week, restDays, day);
    setWeek(applyMoves(week, plan.moves));
    setRestDays(plan.restDays);
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
            <button
              type="button"
              aria-pressed={restDays.includes(day)}
              data-rest-day={day}
              onClick={() => toggleRestDay(day)}
              className={`mt-1 rounded border px-2 py-0.5 text-xs font-medium ${
                restDays.includes(day) ? "border-stone-900 bg-stone-900 text-white" : "border-stone-400 bg-white text-stone-800"
              }`}
            >
              <span className="sr-only">{t.days[day]}: </span>
              {t.restDay}
            </button>
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
                  className={`cursor-grab rounded border px-2 py-1 text-xs active:cursor-grabbing ${
                    DISCIPLINE_STYLES[session.discipline]
                  } ${draggingId === session.id ? "opacity-50" : ""}`}
                >
                  <span className="font-semibold">
                    {t.disciplines[session.discipline]}
                  </span>
                  <p>{session.title}</p>
                  <label className="mt-1 block">
                    <span className="sr-only">
                      {`${t.dayLabel}: ${session.title}`}
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
                  <li key={session.id}>
                    {t.movedFromTo(
                      session.title,
                      t.days[fromDay],
                      t.days[session.day],
                    )}
                  </li>
                ))}
              </ul>
            )}
        </div>
        {changes.length > 0 && (
          <button
            type="button"
            className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setBaseline(week);
              setConfirmed(true);
            }}
          >
            {t.confirm}
          </button>
        )}
        {confirmed && <p role="status" className="text-sm">{t.confirmed}</p>}
      </section>
    </div>
  );
}
