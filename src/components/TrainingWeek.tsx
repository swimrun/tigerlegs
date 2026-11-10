import { useEffect, useMemo, useRef, useState } from "react";
import { isLang, type Lang } from "../client/language.ts";
import {
  applyMoves,
  changedSessions,
  type Day,
  DAYS,
  type Discipline,
  PROTOTYPE_WEEK,
  type TrainingSession,
} from "../client/training-week.ts";
import { getLanguageModel, type LanguageModelStatic } from "../client/prompt-api.ts";
import { createTrainingAgent } from "../client/training-agent.ts";
import { setPageChat } from "../client/chat-store.ts";

interface Strings {
  prototypeNote: string;
  weekTitle: string;
  dayLabel: string;
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
        onApply: (moves) => {
          setWeek((current) => applyMoves(current, moves));
          setConfirmed(false);
        },
      }),
    [model, lang, t],
  );

  const changes = changedSessions(baseline, week);

  const moveSession = (id: string, toDay: Day) => {
    setWeek((current) => applyMoves(current, [{ id, toDay, reason: "" }]));
    setConfirmed(false);
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

      <ol
        aria-label={t.weekTitle}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7"
      >
        {DAYS.map((day) => (
          <li
            key={day}
            className="min-h-24 rounded border border-stone-300 bg-white p-2"
          >
            <h3 className="text-sm font-bold">{t.days[day]}</h3>
            <ul className="mt-2 space-y-2">
              {week.filter((session) => session.day === day).map((session) => (
                <li
                  key={session.id}
                  className={`rounded border px-2 py-1 text-xs ${
                    DISCIPLINE_STYLES[session.discipline]
                  }`}
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
                        <option key={option} value={option}>
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
        <button
          type="button"
          className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
          disabled={changes.length === 0}
          onClick={() => {
            setBaseline(week);
            setConfirmed(true);
          }}
        >
          {t.confirm}
        </button>
        {confirmed && <p role="status" className="text-sm">{t.confirmed}</p>}
      </section>
    </div>
  );
}
