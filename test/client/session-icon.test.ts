import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import SessionIcon, { OPEN_WATER_BLUE, sessionIconKind } from "../../src/components/SessionIcon.tsx";
import { generateWeek, LEVER_LIMITS, PROTOTYPE_WEEK } from "../../src/client/training-week.ts";

const render = (session: Parameters<typeof sessionIconKind>[0]) => renderToStaticMarkup(createElement(SessionIcon, { session }));

it("every discipline has its own icon: a swimmer, the same swimmer on open water, a runner, both, a dumbbell and a stretching figure", () => {
  expect(sessionIconKind({ discipline: "swim", water: "pool" })).toBe("swim-pool");
  expect(sessionIconKind({ discipline: "swim", water: "open" })).toBe("swim-open");
  expect(sessionIconKind({ discipline: "swim" }), "a swim of which the water is not known is a pool swim").toBe("swim-pool");
  expect(sessionIconKind({ discipline: "run" })).toBe("run");
  expect(sessionIconKind({ discipline: "swimrun" })).toBe("swimrun");
  expect(sessionIconKind({ discipline: "strength" })).toBe("strength");
  expect(sessionIconKind({ discipline: "flexibility" })).toBe("mobility");
});

it("open water has the dark blue waves and a pool has not, so that the two swims differ", () => {
  const open = render({ discipline: "swim", water: "open" });
  const pool = render({ discipline: "swim", water: "pool" });
  expect(open.split(OPEN_WATER_BLUE).length - 1, "two waves in dark blue").toBe(2);
  expect(pool).not.toContain(OPEN_WATER_BLUE);
  expect(open).not.toEqual(pool);
  expect(render({ discipline: "run" })).not.toContain(OPEN_WATER_BLUE);
});

it("the icon is decoration: hidden from a screen reader, with no title or role, and not focusable", () => {
  for (const discipline of ["swim", "run", "swimrun", "strength", "flexibility"] as const) {
    const html = render({ discipline });
    expect(html, discipline).toContain('aria-hidden="true"');
    expect(html, discipline).toContain('focusable="false"');
    expect(html, discipline).not.toMatch(/<title|role=/);
  }
});

it("a swimrun shows the swimmer and the runner, and every other discipline one drawing", () => {
  const count = (html: string) => html.split("<svg").length - 1;
  expect(count(render({ discipline: "swimrun" }))).toBe(2);
  for (const discipline of ["swim", "run", "strength", "flexibility"] as const) expect(count(render({ discipline }))).toBe(1);
});

/** Contrast as the WCAG defines it, from the relative luminance of two colours. */
const channel = (value: number) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const rgb = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const contrast = (a: number[], b: number[]) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

it("the dark blue waves keep their contrast on the light blue of a swim card, which mixes 18% of the swim colour with white", () => {
  const css = readFileSync("src/client/styles.css", "utf8");
  const swim = /--color-swim:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
  const mixShare = Number(/background:\s*color-mix\(in srgb, var\(--tone\) (\d+)%, white\)/.exec(css)?.[1]);
  expect(swim, "the swim colour is in styles.css").toBeTruthy();
  expect(mixShare, "the card mix is in styles.css").toBeGreaterThan(0);
  const card = rgb(swim!).map((value) => Math.round(value * (mixShare / 100) + 255 * (1 - mixShare / 100)));
  // 3:1 is what WCAG asks of a graphic; this is far above it.
  expect(contrast(rgb(OPEN_WATER_BLUE), card)).toBeGreaterThanOrEqual(4.5);
});

it("every swim that the generator can place says where it is swum, so that it gets the right icon", () => {
  const swims = [...PROTOTYPE_WEEK, ...generateWeek(LEVER_LIMITS).week].filter((session) => session.discipline === "swim");
  expect(swims.length).toBeGreaterThan(0);
  for (const swim of swims) expect(["open", "pool"], swim.id).toContain(swim.water);
  expect(swims.find((swim) => swim.id === "swim-2")?.water, "the pool swim").toBe("pool");
  expect(swims.find((swim) => swim.id === "swim-1")?.water, "the open-water swim").toBe("open");
});
