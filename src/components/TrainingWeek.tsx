import { useEffect, useMemo, useRef, useState } from "react";
import { isLang, type Lang } from "../client/language.ts";
import {
  applyMoves,
  changedSessions,
  type Day,
  DAYS,
  DEFAULT_LEVERS,
  type Discipline,
  generateWeek,
  LEVER_LIMITS,
  type PlanLevers,
  planRestDay,
  PROTOTYPE_WEEK,
  type Surface,
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
  applied: (summary: string) => string;
  sessionTitles: Record<string, string>;
  revert: string;
  resetAll: string;
  resetDone: string;
  undoReset: string;
  surfaces: Record<Surface, string>;
  leversTitle: string;
  leversHint: string;
  leverLabels: Record<keyof PlanLevers, string>;
  generate: string;
  generated: string;
  notPlaced: (count: number) => string;
  undoGenerate: string;
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
  restDaysLabel: string;
  restDaysNone: string;
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
    applied: (summary) => `Applied: ${summary}. Confirm or revert the changes under "Your changes" below.`,
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
    sessionTitles: {
      "swimrun-1": "Swimrun brick, 2 h",
      "swimrun-2": "Swimrun, 90 min",
      "run-1": "Trail run, 75 min Z2",
      "run-2": "Run intervals, 6×400 m",
      "run-3": "Road run, 45 min Z2",
      "run-4": "Trail run, 60 min Z2",
      "swim-1": "Open-water swim, 2 km",
      "swim-2": "Pool swim, 1.5 km",
      "swim-3": "Open-water swim, 3 km",
      "strength-1": "Strength: legs, 15 min",
      "strength-2": "Strength: core, 15 min",
      "strength-3": "Strength: upper body, 15 min",
      "mobility-1": "Mobility: dynamic, 15 min",
      "mobility-2": "Mobility: static, 15 min",
      "mobility-3": "Mobility: hips and ankles, 15 min",
    },
    revert: "Revert",
    resetAll: "Reset all changes",
    resetDone: "All changes were reset to the confirmed week.",
    undoReset: "Undo reset",
    surfaces: { trail: "trail", road: "road" },
    leversTitle: "Plan levers",
    leversHint: "Set how many sessions a week holds, then generate it. A sports rest day is a day without sessions, for example because it is a busy work day.",
    leverLabels: { runs: "Runs", swims: "Swims", swimruns: "Swimruns", strength: "Short strength", mobility: "Short mobility" },
    generate: "Generate week",
    generated: "Week generated from the levers.",
    notPlaced: (count) => `${count} session(s) did not fit on the free days.`,
    undoGenerate: "Undo generate",
    restDay: "Sports rest day",
    restDaysLabel: "Sports rest days",
    restDaysNone: "none",
    restDayBlocked: (day) => `${day} is a sports rest day: no session can go there.`,
    nextStepsTitle: "Possible next steps (one at a time)",
    restDayBecomes: (day) => `Sports rest day: ${day}`,
    restDayReason: (day) => `sports rest day on ${day}`,
    restDayAlready: (day) => `${day} is already a sports rest day.`,
    leftOut: (title, day) => `Left out: ${title} to ${day}, a sports rest day`,
    nextChip: (title, from, to) => `Next: ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `sports rest day on ${day}`,
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
    applied: (summary) => `Toegepast: ${summary}. Bevestig of draai de wijzigingen terug onder "Jouw wijzigingen" hieronder.`,
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
    sessionTitles: {
      "swimrun-1": "Swimrun-koppeltraining, 2 uur",
      "swimrun-2": "Swimrun, 90 min",
      "run-1": "Trailrun, 75 min Z2",
      "run-2": "Hardloopintervallen, 6×400 m",
      "run-3": "Duurloop op de weg, 45 min Z2",
      "run-4": "Trailrun, 60 min Z2",
      "swim-1": "Zwemmen in open water, 2 km",
      "swim-2": "Zwembadtraining, 1,5 km",
      "swim-3": "Zwemmen in open water, 3 km",
      "strength-1": "Kracht: benen, 15 min",
      "strength-2": "Kracht: core, 15 min",
      "strength-3": "Kracht: bovenlichaam, 15 min",
      "mobility-1": "Mobiliteit: dynamisch, 15 min",
      "mobility-2": "Mobiliteit: statisch, 15 min",
      "mobility-3": "Mobiliteit: heupen en enkels, 15 min",
    },
    revert: "Terugdraaien",
    resetAll: "Alle wijzigingen terugdraaien",
    resetDone: "Alle wijzigingen zijn teruggezet naar de bevestigde week.",
    undoReset: "Terugdraaien ongedaan maken",
    surfaces: { trail: "trail", road: "weg" },
    leversTitle: "Planinstellingen",
    leversHint: "Stel in hoeveel sessies een week heeft en genereer de week. Een sportrustdag is een dag zonder sessies, bijvoorbeeld omdat het een drukke werkdag is.",
    leverLabels: { runs: "Hardloopsessies", swims: "Zwemsessies", swimruns: "Swimrunsessies", strength: "Korte krachtsessies", mobility: "Korte mobiliteitssessies" },
    generate: "Genereer week",
    generated: "Week gegenereerd uit de instellingen.",
    notPlaced: (count) => `${count} sessie(s) pasten niet op de vrije dagen.`,
    undoGenerate: "Genereren ongedaan maken",
    restDay: "Sportrustdag",
    restDaysLabel: "Sportrustdagen",
    restDaysNone: "geen",
    restDayBlocked: (day) => `Op ${day} is het sportrustdag: daar kan geen sessie heen.`,
    nextStepsTitle: "Mogelijke vervolgstappen (één voor één)",
    restDayBecomes: (day) => `Sportrustdag: ${day}`,
    restDayReason: (day) => `sportrustdag op ${day}`,
    restDayAlready: (day) => `Op ${day} is al sportrustdag.`,
    leftOut: (title, day) => `Weggelaten: ${title} naar ${day}, een sportrustdag`,
    nextChip: (title, from, to) => `Volgende: ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `sportrustdag op ${day}`,
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
    applied: (summary) => `Appliqué : ${summary}. Confirme ou annule les changements sous « Tes changements » ci-dessous.`,
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
    sessionTitles: {
      "swimrun-1": "Enchaînement swimrun, 2 h",
      "swimrun-2": "Swimrun, 90 min",
      "run-1": "Course en sentier, 75 min Z2",
      "run-2": "Fractionné de course, 6×400 m",
      "run-3": "Course sur route, 45 min Z2",
      "run-4": "Course en sentier, 60 min Z2",
      "swim-1": "Nage en eau libre, 2 km",
      "swim-2": "Natation en piscine, 1,5 km",
      "swim-3": "Nage en eau libre, 3 km",
      "strength-1": "Renforcement : jambes, 15 min",
      "strength-2": "Renforcement : gainage, 15 min",
      "strength-3": "Renforcement : haut du corps, 15 min",
      "mobility-1": "Mobilité : dynamique, 15 min",
      "mobility-2": "Mobilité : statique, 15 min",
      "mobility-3": "Mobilité : hanches et chevilles, 15 min",
    },
    revert: "Annuler",
    resetAll: "Tout annuler",
    resetDone: "Tous les changements ont été annulés : la semaine confirmée est rétablie.",
    undoReset: "Rétablir mes changements",
    surfaces: { trail: "sentier", road: "route" },
    leversTitle: "Réglages du plan",
    leversHint: "Choisis combien de séances compte une semaine, puis génère-la. Un jour sans sport est un jour sans séance, par exemple parce que c'est une journée de travail chargée.",
    leverLabels: { runs: "Courses", swims: "Nages", swimruns: "Swimruns", strength: "Renforcement court", mobility: "Mobilité courte" },
    generate: "Générer la semaine",
    generated: "Semaine générée à partir des réglages.",
    notPlaced: (count) => `${count} séance(s) ne tiennent pas sur les jours libres.`,
    undoGenerate: "Annuler la génération",
    restDay: "Jour sans sport",
    restDaysLabel: "Jours sans sport",
    restDaysNone: "aucun",
    restDayBlocked: (day) => `Le ${day} est un jour sans sport : aucune séance ne peut y aller.`,
    nextStepsTitle: "Étapes suivantes possibles (une à la fois)",
    restDayBecomes: (day) => `Jour sans sport : ${day}`,
    restDayReason: (day) => `jour sans sport le ${day}`,
    restDayAlready: (day) => `Le ${day} est déjà un jour sans sport.`,
    leftOut: (title, day) => `Ignoré : ${title} vers ${day}, un jour sans sport`,
    nextChip: (title, from, to) => `Ensuite : ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `jour sans sport le ${day}`,
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
    applied: (summary) => `Angewendet: ${summary}. Bestätige oder verwirf die Änderungen unter „Deine Änderungen“ unten.`,
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
    sessionTitles: {
      "swimrun-1": "Swimrun-Koppeleinheit, 2 Std.",
      "swimrun-2": "Swimrun, 90 Min.",
      "run-1": "Traillauf, 75 Min. Z2",
      "run-2": "Lauf-Intervalle, 6×400 m",
      "run-3": "Straßenlauf, 45 Min. Z2",
      "run-4": "Traillauf, 60 Min. Z2",
      "swim-1": "Freiwasserschwimmen, 2 km",
      "swim-2": "Schwimmen im Becken, 1,5 km",
      "swim-3": "Freiwasserschwimmen, 3 km",
      "strength-1": "Kraft: Beine, 15 Min.",
      "strength-2": "Kraft: Rumpf, 15 Min.",
      "strength-3": "Kraft: Oberkörper, 15 Min.",
      "mobility-1": "Mobilität: dynamisch, 15 Min.",
      "mobility-2": "Mobilität: statisch, 15 Min.",
      "mobility-3": "Mobilität: Hüfte und Sprunggelenke, 15 Min.",
    },
    revert: "Rückgängig",
    resetAll: "Alle Änderungen zurücksetzen",
    resetDone: "Alle Änderungen wurden auf die bestätigte Woche zurückgesetzt.",
    undoReset: "Zurücksetzen widerrufen",
    surfaces: { trail: "Trail", road: "Straße" },
    leversTitle: "Planeinstellungen",
    leversHint: "Lege fest, wie viele Einheiten eine Woche hat, und erzeuge sie. Ein Sportruhetag ist ein Tag ohne Einheiten, zum Beispiel weil es ein voller Arbeitstag ist.",
    leverLabels: { runs: "Läufe", swims: "Schwimmeinheiten", swimruns: "Swimruns", strength: "Kurze Krafteinheiten", mobility: "Kurze Mobilitätseinheiten" },
    generate: "Woche erzeugen",
    generated: "Woche aus den Einstellungen erzeugt.",
    notPlaced: (count) => `${count} Einheit(en) passten nicht auf die freien Tage.`,
    undoGenerate: "Erzeugen widerrufen",
    restDay: "Sportruhetag",
    restDaysLabel: "Sportruhetage",
    restDaysNone: "keine",
    restDayBlocked: (day) => `Am ${day} ist Sportruhetag: dort kann keine Einheit hin.`,
    nextStepsTitle: "Mögliche nächste Schritte (einer nach dem anderen)",
    restDayBecomes: (day) => `Sportruhetag: ${day}`,
    restDayReason: (day) => `Sportruhetag am ${day}`,
    restDayAlready: (day) => `Am ${day} ist schon Sportruhetag.`,
    leftOut: (title, day) => `Weggelassen: ${title} auf ${day}, einen Sportruhetag`,
    nextChip: (title, from, to) => `Danach: ${title} ${from} → ${to}`,
    fixReasons: {
      "rest-day": (day) => `Sportruhetag am ${day}`,
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
          <details className="relative text-sm" data-rest-days>
            <summary className="cursor-pointer rounded border border-stone-900 bg-white px-2 py-1">
              <span className="font-medium">{t.restDaysLabel}: </span>
              {restDays.length > 0 ? DAYS.filter((day) => restDays.includes(day)).map((day) => t.days[day]).join(", ") : t.restDaysNone}
            </summary>
            <fieldset className="absolute z-10 mt-1 space-y-1 rounded border border-stone-900 bg-white p-2 shadow">
              <legend className="sr-only">{t.restDaysLabel}</legend>
              {DAYS.map((day) => (
                <label key={day} className="flex items-center gap-2">
                  <input type="checkbox" checked={restDays.includes(day)} onChange={() => toggleRestDay(day)} />
                  {t.days[day]}
                </label>
              ))}
            </fieldset>
          </details>
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
