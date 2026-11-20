import type { ChatAgent, ChatEvent, ChatLink, ChatSuggestion } from "./chat-agent.ts";

/** The pages of the site, as the layout names them in `active`. */
export type PageKey = "extractor" | "training" | "pricing" | "about" | "guidebook" | "profile";

/** The pages that the answer to "what can I do" points to, in this order, minus the page you are on. */
export const GUIDE_PAGES = ["extractor", "training", "pricing", "about", "guidebook"] as const;
export type GuidePage = (typeof GUIDE_PAGES)[number];

const PATHS: Record<PageKey, string> = {
  extractor: "",
  training: "training.html",
  pricing: "pricing.html",
  about: "about.html",
  guidebook: "guidebook.html",
  profile: "profile.html",
};

/** The texts of the guide, per language (chat.strings.<lang>.ts). */
export interface GuideTexts {
  question: string;
  intro: string;
  pages: Record<PageKey, string>;
  descriptions: Record<GuidePage, string>;
}

export const isPageKey = (value: unknown): value is PageKey => typeof value === "string" && value in PATHS;

/** `base` is the folder of the site with a trailing slash, or "" for relative links. */
export const pageHref = (page: PageKey, base: string) => `${base || "./"}${PATHS[page]}`;

const GUIDE_ID = "page-guide";

/** The links of the guide: every page of the guide except the one you are on. */
export function guideLinks(texts: GuideTexts, current: PageKey | undefined, base: string): ChatLink[] {
  return GUIDE_PAGES.filter((page) => page !== current).map((page) => ({ label: texts.pages[page], href: pageHref(page, base) }));
}

/**
 * Puts one chip in front of the suggestions of any agent, on every page: "What can I do in this web app?".
 * Its answer says what the other pages are for and links to them. The guide answers by itself and never
 * calls the wrapped agent, so it also works where that agent is a model that is not available.
 */
export function withPageGuide(agent: ChatAgent, texts: GuideTexts, current: PageKey | undefined, base: string): ChatAgent {
  const normalize = (text: string) => text.trim().toLowerCase();
  return {
    suggestions: async (): Promise<ChatSuggestion[]> => [{ id: GUIDE_ID, label: texts.question }, ...(await agent.suggestions())],
    async *run(message: string): AsyncIterable<ChatEvent> {
      if (normalize(message) !== normalize(texts.question)) {
        yield* agent.run(message);
        return;
      }
      const links = guideLinks(texts, current, base);
      const items = GUIDE_PAGES.filter((page) => page !== current).map((page) => `- ${texts.descriptions[page]}`);
      yield { type: "run-started" };
      yield { type: "text", text: [texts.intro, ...items].join("\n"), links };
      yield { type: "run-finished" };
    },
  };
}
