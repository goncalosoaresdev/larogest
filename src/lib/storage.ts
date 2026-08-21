import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeStorageSegment } from "@/lib/care-report";

const root = path.join(process.cwd(), "storage", "pdfs");
const photosRoot = path.join(process.cwd(), "storage", "care-photos");

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

function resolvePhotoPath(relative: string) {
  if (!relative || relative.includes("\0") || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) {
    throw new Error("invalid photo path");
  }
  const absolute = path.resolve(photosRoot, relative);
  const base = path.resolve(photosRoot);
  if (absolute !== base && !absolute.startsWith(base + path.sep)) {
    throw new Error("invalid photo path");
  }
  return absolute;
}

export async function saveCarePhoto(reportId: string, photoId: string, ext: string, buffer: Buffer) {
  if (!isSafeStorageSegment(reportId) || !isSafeStorageSegment(photoId) || !["jpg", "png", "webp"].includes(ext)) {
    throw new Error("invalid photo path");
  }
  const relative = `${reportId}/${photoId}.${ext}`;
  await mkdir(path.join(photosRoot, reportId), { recursive: true });
  await writeFile(path.join(photosRoot, relative), buffer);
  return relative;
}

export async function readCarePhoto(relative: string) {
  return readFile(resolvePhotoPath(relative));
}

export async function deleteCarePhoto(relative: string) {
  await unlink(resolvePhotoPath(relative));
}

