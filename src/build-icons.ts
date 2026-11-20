import { mkdir } from "node:fs/promises";
import sharp from "sharp";

/**
 * Makes the icons of the installable app (issue #130, ADR-0021) from the square icon of the site and writes them
 * to public/img/icons/, where they have a fixed URL that the web manifest and the home screen link to. The PNGs are
 * committed; run this with `npm run icons` when the icon changes.
 */
const SOURCE = "src/assets/tigerlegs-icon.png";
const OUT = "public/img/icons";

/**
 * A maskable icon is cropped to a shape by the system, so the picture has to stay inside the safe zone, a circle
 * with 80% of the width as its diameter. The ears of the tiger are the corners of the picture, so the picture is
 * scaled to 70% on a white ground, the colour of the icon's own background.
 */
const MASKABLE_SCALE = 0.7;
const GROUND = "#ffffff";

const ICONS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  /** iOS rounds the corners itself and fills a transparent icon with black, so this one has no transparency. */
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

async function make({ file, size, maskable }: { file: string; size: number; maskable: boolean }): Promise<void> {
  const target = `${OUT}/${file}`;
  if (!maskable) {
    await sharp(SOURCE).resize(size, size).flatten({ background: GROUND }).png().toFile(target);
    return;
  }
  const inner = Math.round(size * MASKABLE_SCALE);
  const picture = await sharp(SOURCE).resize(inner, inner).flatten({ background: GROUND }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: GROUND } })
    .composite([{ input: picture, gravity: "center" }])
    .removeAlpha()
    .png()
    .toFile(target);
}

await mkdir(OUT, { recursive: true });
for (const icon of ICONS) await make(icon);
console.log(`Made ${ICONS.length} icons in ${OUT}`);
