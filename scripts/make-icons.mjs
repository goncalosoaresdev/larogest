import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const appDir = join(root, "src/app");

const HOUSE = "M14 51V27l18-16 18 16v24M25 51V36h14v15";

function markSvg({ size, pad = 0 }) {
  const box = 64 + pad * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${box} ${box}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${-pad}" y="${-pad}" width="${box}" height="${box}" fill="#394237"/>
  <path d="${HOUSE}" fill="none" stroke="#FFFDF8" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>`;
}

async function png(path, size, pad = 0) {
  const buffer = await sharp(Buffer.from(markSvg({ size, pad }))).png().toBuffer();
  writeFileSync(path, buffer);
  return buffer;
}

const [ico16, ico32, ico48] = await Promise.all([
  png(join(publicDir, "casa-icon-180.png"), 180),
  png(join(publicDir, "casa-icon-192.png"), 192),
  png(join(publicDir, "casa-icon-512.png"), 512),
  png(join(publicDir, "casa-icon-512-maskable.png"), 512, 8),
  png(join(appDir, "apple-icon.png"), 180),
  sharp(Buffer.from(markSvg({ size: 16 }))).png().toBuffer(),
  sharp(Buffer.from(markSvg({ size: 32 }))).png().toBuffer(),
  sharp(Buffer.from(markSvg({ size: 48 }))).png().toBuffer(),
]).then((all) => all.slice(-3));

const tmp16 = join(root, ".tmp-ico-16.png");
const tmp32 = join(root, ".tmp-ico-32.png");
const tmp48 = join(root, ".tmp-ico-48.png");
writeFileSync(tmp16, ico16);
writeFileSync(tmp32, ico32);
writeFileSync(tmp48, ico48);

const icoPath = join(appDir, "favicon.ico");
const py = `
from PIL import Image
imgs = [Image.open(r"${tmp16}"), Image.open(r"${tmp32}"), Image.open(r"${tmp48}")]
imgs[0].save(r"${icoPath}", format="ICO", sizes=[(16,16),(32,32),(48,48)], append_images=imgs[1:])
imgs[0].save(r"${join(publicDir, "favicon.ico")}", format="ICO", sizes=[(16,16),(32,32),(48,48)], append_images=imgs[1:])
`;
const result = spawnSync("python3", ["-c", py], { encoding: "utf8" });
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(1);
}

const { rmSync } = await import("node:fs");
rmSync(tmp16, { force: true });
rmSync(tmp32, { force: true });
rmSync(tmp48, { force: true });

console.log("Wrote Laro house icons: favicon.ico, apple-icon, 180/192/512, maskable 512");
