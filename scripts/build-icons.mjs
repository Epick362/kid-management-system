#!/usr/bin/env node
/**
 * Generates PNG icons from public/icon.svg. Run once (or whenever the SVG
 * changes) via: pnpm dlx tsx scripts/build-icons.mjs
 * (Or just `node scripts/build-icons.mjs` — pure ESM, no deps beyond sharp.)
 *
 * Outputs to public/icons/ and public/apple-touch-icon.png.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "public/icon.svg");
const OUT_DIR = resolve(ROOT, "public/icons");

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, padding: 0.1 },
];

await mkdir(OUT_DIR, { recursive: true });
const svg = await readFile(SRC);

for (const { name, size, padding = 0 } of targets) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  const buf = await sharp(svg)
    .resize(inner, inner)
    .extend({
      top: offset, bottom: offset, left: offset, right: offset,
      background: { r: 0xa8, g: 0xe0, b: 0xc8, alpha: 1 },
    })
    .png()
    .toBuffer();
  await writeFile(resolve(OUT_DIR, name), buf);
  console.log(`✓ ${name} (${size}×${size}${padding ? `, ${padding * 100}% safe-area` : ""})`);
}

// Apple touch icon (180×180) at the root for iOS shortcuts
const apple = await sharp(svg).resize(180, 180).png().toBuffer();
await writeFile(resolve(ROOT, "public/apple-touch-icon.png"), apple);
console.log("✓ apple-touch-icon.png (180×180)");

// Favicon ICO replacement: write a 32×32 PNG that browsers will accept
const fav = await sharp(svg).resize(32, 32).png().toBuffer();
await writeFile(resolve(ROOT, "public/favicon-32.png"), fav);
console.log("✓ favicon-32.png");
