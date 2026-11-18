import { expect, it } from "vitest";
import { splitChatTitle } from "../../src/client/chat-title.ts";
import { STRINGS } from "../../src/client/chat.strings.ts";
import { LANGS } from "../../src/client/language.ts";

it("the name is what comes before the colon and the expansion what comes after it", () => {
  expect(splitChatTitle("ROARRS: Robotic Operating Agent that Responds to Requests about Swimrun")).toEqual({
    name: "ROARRS",
    expansion: "Robotic Operating Agent that Responds to Requests about Swimrun",
  });
});

it("only the first colon splits, and a title without one is all name", () => {
  expect(splitChatTitle("A: B: C")).toEqual({ name: "A", expansion: "B: C" });
  expect(splitChatTitle("ROARRS")).toEqual({ name: "ROARRS", expansion: "" });
  expect(splitChatTitle(": no name")).toEqual({ name: ": no name", expansion: "" });
  expect(splitChatTitle("")).toEqual({ name: "", expansion: "" });
});

it("the chat title of every language splits into the name and its expansion", () => {
  for (const lang of LANGS) {
    const { name, expansion } = splitChatTitle(STRINGS[lang].title);
    expect(name, lang).toBe("ROARRS");
    expect(expansion.length, lang).toBeGreaterThan(20);
  }
});
