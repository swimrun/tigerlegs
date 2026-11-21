import { afterEach, expect, it, vi } from "vitest";
import { LANGUAGE_CHIP, setPageLanguage, STORAGE_KEY } from "../../src/client/language.ts";

afterEach(() => vi.unstubAllGlobals());

it("setting the page language saves it, sets lang on the page and moves the switch", () => {
  const stored: Record<string, string> = {};
  const select = { value: "nl" };
  const root = { lang: "nl", dataset: {} as Record<string, string> };
  vi.stubGlobal("localStorage", { setItem: (key: string, value: string) => (stored[key] = value) });
  vi.stubGlobal("document", { documentElement: root, querySelector: (selector: string) => (selector === "#language-switch" ? select : null) });
  setPageLanguage("en");
  expect(stored[STORAGE_KEY]).toBe("en");
  expect(root.lang).toBe("en");
  expect(root.dataset.lang).toBe("en");
  expect(select.value).toBe("en");
  expect(LANGUAGE_CHIP).toBe("lang:");
});

it("a browser without storage still switches the page", () => {
  const root = { lang: "nl", dataset: {} as Record<string, string> };
  vi.stubGlobal("localStorage", { setItem: () => { throw new Error("blocked"); } });
  vi.stubGlobal("document", { documentElement: root, querySelector: () => null });
  setPageLanguage("fr");
  expect(root.lang).toBe("fr");
});
