import type { ChatStrings } from "./chat.strings.ts";

export const fr: ChatStrings = {
  title: "ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun",
  prototype: "prototype",
  typing: "ROARRS est en train d'écrire…",
  suggested: "Questions suggérées",
  yourQuestion: "Ta question",
  placeholder: "Pose une question…",
  ask: "Demander",
  loadFailed: "ROARRS n'a pas pu charger ses questions. Recharge la page pour réessayer.",
  error: "Désolé, une erreur s'est produite. Réessaie.",
switchToChrome: "Les questions libres nécessitent Chrome sur ordinateur (Gemini Nano). Passe à Chrome pour les utiliser.",
  freeQuestionsOnTraining: "Les questions libres ne fonctionnent que sur la page Training, dans Chrome sur ordinateur. Ici, tu peux seulement choisir l'une des questions proposées.",
  youAreOn: "Vous êtes sur",
  guide: {
    question: "Que puis-je faire dans cette application TigerLegs ?",
    intro: "TigerLegs découpe un swimrun en segments de nage et de course. D'ici vous pouvez aller à :",
    pages: { extractor: "Extractorrr", training: "Training", pricing: "Pricing", about: "About", guidebook: "Guidebook", profile: "Profile" },
    descriptions: {
      extractor: "Extractorrr : chargez un fichier GPX et obtenez ses segments de nage et de course sur une carte et dans un tableau.",
      training: "Training : planifiez votre semaine d'entraînement, avec des propositions du chat.",
      pricing: "Pricing : ce qui est gratuit et ce qui sera payant.",
      about: "About : ce qu'est TigerLegs, comment il trouve les nages et les courses, et ce qui arrive à vos données.",
      guidebook: "Guidebook : comment TigerLegs est construit et pourquoi, avec l'architecture, les termes du domaine et comment contribuer.",
    },
  },
};
