import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "storage", "pdfs");

export async function savePdf(filename: string, buffer: Buffer) {
  await mkdir(root, { recursive: true });
  const relative = `${filename}.pdf`;
  await writeFile(path.join(root, relative), buffer);
  return relative;
}

export async function readPdf(relative: string) {
  if (!relative || relative.includes("\0") || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) {
    throw new Error("invalid pdf path");
  }
  const absolute = path.resolve(root, relative);
  const base = path.resolve(root);
  if (absolute !== base && !absolute.startsWith(base + path.sep)) {
    throw new Error("invalid pdf path");
  }
  return readFile(absolute);
}

export function pdfAbsolutePath(relative: string) {
  return path.join(root, relative);
}
