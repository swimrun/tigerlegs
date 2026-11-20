import type { ChatStrings } from "./chat.strings.ts";

export const nl: ChatStrings = {
  title: "ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun",
  prototype: "prototype",
  typing: "ROARRS is aan het typen…",
  suggested: "Voorgestelde vragen",
  yourQuestion: "Jouw vraag",
  placeholder: "Vraag iets…",
  ask: "Vraag",
  loadFailed: "ROARRS kon zijn vragen niet laden. Herlaad de pagina om het opnieuw te proberen.",
  error: "Sorry, er ging iets mis. Probeer het opnieuw.",
switchToChrome: "Vrije vragen werken alleen in Chrome op een desktopcomputer (Gemini Nano). Schakel over naar Chrome om ze te gebruiken.",
useSupportedLanguage: "Gemini Nano begrijpt geen Nederlands. Gebruik Engels, Frans of Duits voor vrije vragen, of kies een van de vaste opties.",
  youAreOn: "Je bent op",
  guide: {
    question: "Wat kan ik doen in deze TigerLegs-webapp?",
    intro: "TigerLegs knipt een swimrun op in zwem- en loopsegmenten. Vanaf hier kun je naar:",
    pages: { extractor: "Extractorrr", training: "Training", pricing: "Pricing", about: "About", guidebook: "Guidebook", profile: "Profile" },
    descriptions: {
      extractor: "Extractorrr: laad een GPX-bestand en krijg de zwem- en loopsegmenten op een kaart en in een tabel.",
      training: "Training: plan je trainingsweek, met voorstellen uit de chat.",
      pricing: "Pricing: wat gratis is en wat gaat kosten.",
      about: "About: wat TigerLegs is, hoe het zwemmen en lopen vindt, en wat er met je gegevens gebeurt.",
      guidebook: "Guidebook: hoe TigerLegs is gebouwd en waarom, met de architectuur, de domeintermen en hoe je kunt bijdragen.",
    },
  },
};
