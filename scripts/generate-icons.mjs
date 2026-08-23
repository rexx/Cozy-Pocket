#!/usr/bin/env node
// Rasterises every icon in public/ from a single source, public/icon.svg.
// Workflow: edit public/icon.svg -> npm run icons:generate -> commit the output.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = path.resolve(fileURLToPath(new URL('../public', import.meta.url)));

// Matches theme_color / background_color in public/manifest.json.
const BACKDROP = '#1A1C2C';

// Rasterise well above the target size, then downscale, so thin strokes stay
// smooth at 16x16.
const RASTER_DENSITY = 384;

// `flatten` decides who paints the background behind the mark:
//   false - ship transparent pixels. A web clip cannot declare icon layers, so
//           iOS 26 derives them from alpha: opaque pixels become the foreground
//           and the system generates its own backdrop plus Liquid Glass lighting.
//           Baking in an opaque background leaves nothing to separate, and the
//           icon renders flat.
//   true  - bake BACKDROP in. Browser tab bars and Android's adaptive-icon mask
//           provide no generated backdrop, so the line art needs its own.
//
// `scale` insets the mark within its canvas, defaulting to 1. Only the maskable
// output needs it: an Android adaptive icon may be cropped to a circle of
// r = 0.4 * side, and at full size the upper sparkle reaches r=243 of the 512
// canvas. Shrinking icon.svg instead would fix the crop but move every other
// output's geometry, so the inset stays per-output. MASKABLE_SAFE_RATIO below
// checks the result rather than trusting this number.
const OUTPUTS = [
  { out: 'favicon-16x16.png', size: 16, flatten: true },
  { out: 'favicon-32x32.png', size: 32, flatten: true },
  { out: 'apple-touch-icon.png', size: 180, flatten: false },
  { out: 'android-chrome-192x192.png', size: 192, flatten: false },
  { out: 'android-chrome-512x512.png', size: 512, flatten: false },
  { out: 'icon-maskable-512.png', size: 512, flatten: true, scale: 0.83 },
];

// The share of the side a maskable icon's safe circle spans, from the spec.
const MASKABLE_SAFE_RATIO = 0.4;
const MASKABLE_PROBE = 'icon-maskable-512.png';

// favicon.ico carries several sizes in one file, for the surfaces that still
// request it (bookmarks, some browser chrome).
const ICO_SIZES = [16, 32, 48];

// The best predictor found for whether iOS 26 applies Liquid Glass to a web clip
// icon: the boundary length between the mark and the transparent regions it walls
// off, measured in units of the canvas side. Enlarging a hollow mark lengthens
// that boundary, and so does subdividing one cavity into many, which is why it
// tracks both failure modes that a plain transparency ratio misses. Across
// fifteen samples from three unrelated icons, 2.71 is the highest value still
// observed to get the treatment and 3.20 the lowest observed to lose it - with
// one sample passing at 3.24, so the boundary is a band rather than a line.
// A solid mark walls off nothing, scores 0 and is the safest shape available.
//
// A tripwire, not a spec: no mechanism explains the boundary, so read a pass as
// "worth testing on device". See docs/app-icon-ios-liquid-glass.md.
const MAX_CAVITY_PERIMETER = 2.71;
const CAVITY_PROBE = 'apple-touch-icon.png';

const SOURCE = 'icon.svg';

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// libvips does not run these in call order - `flatten` executes before `extend`,
// so an extend padded with transparency survives a later flatten and yields an
// otherwise opaque icon ringed by transparent pixels. Nothing errors and the
// console output looks right. So the padding carries the final background itself
// and flatten is only left to cover the artwork's own transparency.
function render({ size, flatten, scale = 1 }) {
  const padding = flatten ? BACKDROP : TRANSPARENT;
  const inner = Math.round(size * scale);
  const pad = size - inner;

  let pipeline = sharp(path.join(publicDir, SOURCE), { density: RASTER_DENSITY })
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT });

  if (pad > 0) {
    pipeline = pipeline.extend({
      top: Math.floor(pad / 2),
      bottom: Math.ceil(pad / 2),
      left: Math.floor(pad / 2),
      right: Math.ceil(pad / 2),
      background: padding,
    });
  }

  return (flatten ? pipeline.flatten({ background: BACKDROP }) : pipeline).png();
}

// ICO is a directory header followed by the image payloads. sharp cannot write
// .ico, but PNG payloads are legal entries and every current browser decodes
// them, so no extra dependency is needed.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let payloadOffset = header.length + directory.length;

  images.forEach(({ size, data }, i) => {
    const entry = i * 16;
    // A 256px side is encoded as 0; nothing here is that large, but keep the rule explicit.
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2); // palette size: none
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(payloadOffset, entry + 12);
    payloadOffset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

for (const output of OUTPUTS) {
  await render(output).toFile(path.join(publicDir, output.out));
  const backdrop = output.flatten ? BACKDROP : 'transparent';
  console.log(`${output.out.padEnd(28)} ${String(output.size).padStart(3)}px  ${backdrop}`);
}

const icoImages = await Promise.all(
  ICO_SIZES.map(async (size) => ({
    size,
    data: await render({ size, flatten: true }).toBuffer(),
  })),
);

await writeFile(path.join(publicDir, 'favicon.ico'), buildIco(icoImages));
console.log(`${'favicon.ico'.padEnd(28)} ${ICO_SIZES.join('/')}px  ${BACKDROP}`);

// An alpha channel alone proves nothing here - `sips -g hasAlpha` reports yes
// for icons that have no transparent pixel at all - so work from the actual
// values. Transparency is 4-connected and ink is alpha >= 128, which keeps a
// translucent area fill on the transparent side: a version filled at 15% opacity
// lost the treatment on device, and a stricter threshold would score it as ink
// and leave that result unexplained.
const probeImage = await sharp(path.join(publicDir, CAVITY_PROBE))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const side = probeImage.info.width;
const pixels = side * probeImage.info.height;
const isClear = new Uint8Array(pixels);
for (let p = 0; p < pixels; p += 1) {
  if (probeImage.data[p * probeImage.info.channels + 3] < 128) isClear[p] = 1;
}

// Transparency reachable from the canvas border is the backdrop iOS will replace.
// Whatever it cannot reach is a cavity the mark has closed around.
const reached = new Uint8Array(pixels);
const frontier = [];
const visit = (p) => {
  if (isClear[p] && !reached[p]) {
    reached[p] = 1;
    frontier.push(p);
  }
};
for (let x = 0; x < side; x += 1) {
  visit(x);
  visit(pixels - side + x);
}
for (let y = 0; y < side; y += 1) {
  visit(y * side);
  visit(y * side + side - 1);
}
while (frontier.length) {
  const p = frontier.pop();
  const x = p % side;
  const y = (p - x) / side;
  if (x > 0) visit(p - 1);
  if (x < side - 1) visit(p + 1);
  if (y > 0) visit(p - side);
  if (y < side - 1) visit(p + side);
}

let cavityEdge = 0;
for (let p = 0; p < pixels; p += 1) {
  if (!isClear[p] || reached[p]) continue;
  const x = p % side;
  const y = (p - x) / side;
  const touchesInk =
    (x > 0 && !isClear[p - 1]) ||
    (x < side - 1 && !isClear[p + 1]) ||
    (y > 0 && !isClear[p - side]) ||
    (y < side - 1 && !isClear[p + side]);
  if (touchesInk) cavityEdge += 1;
}

const perimeter = cavityEdge / side;

if (perimeter > MAX_CAVITY_PERIMETER) {
  console.log(
    `\n${CAVITY_PROBE} cavity perimeter is ${perimeter.toFixed(2)} canvas widths, above the ${MAX_CAVITY_PERIMETER}\n` +
      `         still observed to get the iOS 26 Liquid Glass treatment.\n\n` +
      `WARNING  the mark walls off too much transparency. Filling an enclosed area drops this\n` +
      `         straight to 0; shrinking the mark or merging subdivided cavities also helps.\n` +
      `         Verify on device before shipping. See docs/app-icon-ios-liquid-glass.md.`,
  );
} else {
  console.log(
    `${CAVITY_PROBE} cavity perimeter is ${perimeter.toFixed(2)} canvas widths - at or below the ${MAX_CAVITY_PERIMETER} observed to get Liquid Glass.`,
  );
}

// The maskable output is flattened, so its own alpha cannot separate ink from
// backdrop. Comparing colours would work today only because the mark happens not
// to use BACKDROP; re-rendering the same geometry unflattened keeps the check
// independent of the artwork's palette.
const maskable = OUTPUTS.find((output) => output.out === MASKABLE_PROBE);
const probe = await render({ ...maskable, flatten: false })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const maskableSide = probe.info.width;
const centre = maskableSide / 2;
const safeRadius = MASKABLE_SAFE_RATIO * maskableSide;
let inkRadius = 0;
for (let i = 0, p = 0; i < probe.data.length; i += probe.info.channels, p += 1) {
  if (probe.data[i + 3] === 0) continue;
  const x = p % maskableSide;
  const y = (p - x) / maskableSide;
  const r = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
  if (r > inkRadius) inkRadius = r;
}

console.log(
  `${MASKABLE_PROBE} ink reaches r=${inkRadius.toFixed(0)} of the r=${safeRadius.toFixed(0)} safe circle.`,
);

if (inkRadius > safeRadius) {
  // Scale compounds, so the fix is relative to whatever inset is already applied.
  const needed = (maskable.scale ?? 1) * (safeRadius / inkRadius);
  console.log(
    `\nWARNING  the mark reaches outside the maskable safe circle, so a circular Android mask\n` +
      `         would clip it. Set scale to ${Math.floor(needed * 100) / 100} or below for ${MASKABLE_PROBE} in OUTPUTS.\n` +
      `         Do not shrink icon.svg instead - that moves every other output's geometry,\n` +
      `         including the apple-touch-icon the iOS treatment is tuned against.`,
  );
}
