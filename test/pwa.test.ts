import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * The web app manifest and its icons (issue #130, ADR-0021). The criteria for Chromium browsers are those of MDN,
 * "Making PWAs installable": a name or short name, icons of 192 and 512 pixels, a start URL, a display mode, and
 * no preference for a related native app. A service worker is not one of them.
 */
const MANIFEST = "public/manifest.webmanifest";
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  prefer_related_applications?: boolean;
  background_color?: string;
  theme_color?: string;
  icons?: { src: string; sizes: string; type: string; purpose?: string }[];
};

/** Where the manifest is served from, so that its relative URLs resolve as they do in a browser. */
const SERVED_AT = "https://swimrun.group/tigerlegs/manifest.webmanifest";

/** The width and height that a PNG file declares in its header. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii"), `${path} is a PNG file`).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const pathOf = (src: string) => `public${new URL(src, SERVED_AT).pathname.replace("/tigerlegs", "")}`;

it("the manifest has what Chromium browsers need to make the site installable", () => {
  expect(manifest.name ?? manifest.short_name, "a name or a short name").toBeTruthy();
  expect(manifest.start_url, "a start URL").toBeTruthy();
  expect(["standalone", "fullscreen", "minimal-ui"], "a display mode that is an app").toContain(manifest.display);
  expect(manifest.prefer_related_applications ?? false).toBe(false);
});

it("the app starts inside its scope, which is the site and not the whole host", () => {
  const start = new URL(manifest.start_url ?? "", SERVED_AT);
  const scope = new URL(manifest.scope ?? "", SERVED_AT);
  expect(scope.pathname).toBe("/tigerlegs/");
  expect(start.href.startsWith(scope.href)).toBe(true);
});

it("the icons include 192 and 512 pixels and a maskable one, and every file exists with the size that it claims", () => {
  const icons = manifest.icons ?? [];
  const sizes = icons.map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(icons.some((icon) => icon.purpose === "maskable"), "a maskable icon, for the shapes of Android").toBe(true);
  for (const icon of icons) {
    expect(icon.type).toBe("image/png");
    const path = pathOf(icon.src);
    expect(existsSync(path), `${icon.src} is at ${path}`).toBe(true);
    const [width, height] = icon.sizes.split("x").map(Number);
    expect(pngSize(path), icon.src).toEqual({ width, height });
  }
});

it("iOS has its own icon of 180 pixels, with no transparency, which iOS would fill with black", () => {
  const path = "public/img/icons/apple-touch-icon.png";
  expect(pngSize(path)).toEqual({ width: 180, height: 180 });
  // The colour type of a PNG is at byte 25: 2 is RGB, 6 is RGB with alpha.
  expect(readFileSync(path)[25], "RGB, without an alpha channel").toBe(2);
});

it("the colours are hexadecimal colours that a browser reads", () => {
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
});
