import type { ChatStrings } from "./chat.strings.ts";

export const de: ChatStrings = {
  title: "ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun",
  prototype: "Prototyp",
  typing: "ROARRS tippt…",
  suggested: "Vorgeschlagene Fragen",
  yourQuestion: "Deine Frage",
  placeholder: "Frag etwas…",
  ask: "Fragen",
  loadFailed: "ROARRS konnte seine Fragen nicht laden. Lade die Seite neu, um es erneut zu versuchen.",
  error: "Entschuldigung, etwas ist schiefgelaufen. Bitte versuche es erneut.",
switchToChrome: "Freie Fragen funktionieren nur in Chrome auf einem Desktop-Computer (Gemini Nano). Wechsle zu Chrome, um sie zu nutzen.",
  freeQuestionsOnTraining: "Freie Fragen funktionieren nur auf der Training-Seite, in Chrome auf einem Desktop-Computer. Hier kannst du nur eine der vorgeschlagenen Fragen wählen.",
  youAreOn: "Du bist auf",
  guide: {
    question: "Was kann ich in dieser TigerLegs-Web-App tun?",
    intro: "TigerLegs teilt einen Swimrun in Schwimm- und Laufsegmente. Von hier aus kannst du zu:",
    pages: { extractor: "Extractorrr", training: "Training", pricing: "Pricing", about: "About", guidebook: "Guidebook", profile: "Profile" },
    descriptions: {
      extractor: "Extractorrr: lade eine GPX-Datei und erhalte die Schwimm- und Laufsegmente auf einer Karte und in einer Tabelle.",
      training: "Training: plane deine Trainingswoche, mit Vorschlägen aus dem Chat.",
      pricing: "Pricing: was kostenlos ist und was etwas kosten wird.",
      about: "About: was TigerLegs ist, wie es Schwimm- und Laufabschnitte findet und was mit deinen Daten geschieht.",
      guidebook: "Guidebook: wie TigerLegs gebaut ist und warum, mit der Architektur, den Fachbegriffen und wie man beitragen kann.",
    },
  },
};
