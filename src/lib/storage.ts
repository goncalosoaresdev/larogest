import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CARE_REPORT_PHOTO_TYPES, isSafeStorageSegment } from "@/lib/care-report";

const PHOTO_EXT = new Set<string>(Object.values(CARE_REPORT_PHOTO_TYPES));
const PHOTO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class StorageError extends Error {
  readonly code: "not_configured" | "invalid_key" | "not_found";

  constructor(code: StorageError["code"], message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export type ObjectStoreConfig =
  | {
      mode: "r2";
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    }
  | { mode: "local" };

const MISSING_STORAGE = "Configuração de armazenamento em falta.";

export function resolveObjectStore(env: NodeJS.ProcessEnv = process.env): ObjectStoreConfig {
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = env.R2_BUCKET_NAME?.trim() ?? "";
  const accountId = (env.R2_ACCOUNT_ID ?? env.CLOUDFLARE_ACCOUNT_ID)?.trim() ?? "";
  const endpoint = env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const present = [accessKeyId, secretAccessKey, bucket].map((value) => value.length > 0);
  const some = present.some(Boolean);
  const all = present.every(Boolean);

  if (all && endpoint) {
    return { mode: "r2", endpoint, bucket, accessKeyId, secretAccessKey };
  }
  if (some || all || env.NODE_ENV === "production") {
    throw new StorageError("not_configured", MISSING_STORAGE);
  }
  return { mode: "local" };
}

export function pdfObjectKey(relative: string) {
  return `pdfs/${assertPdfRelative(relative)}`;
}

export function photoObjectKey(relative: string) {
  return `care-photos/${assertPhotoRelative(relative)}`;
}

export async function savePdf(filename: string, buffer: Buffer) {
  const relative = pdfRelativeFromFilename(filename);
  await putObject(pdfObjectKey(relative), buffer, "application/pdf");
  return relative;
}

export async function readPdf(relative: string) {
  return getObject(pdfObjectKey(relative));
}

export async function saveCarePhoto(reportId: string, photoId: string, ext: string, buffer: Buffer) {
  if (!isSafeStorageSegment(reportId) || !isSafeStorageSegment(photoId) || !PHOTO_EXT.has(ext)) {
    throw new StorageError("invalid_key", "invalid photo path");
  }
  const relative = `${reportId}/${photoId}.${ext}`;
  await putObject(photoObjectKey(relative), buffer, PHOTO_MIME[ext] ?? "application/octet-stream");
  return relative;
}

export async function readCarePhoto(relative: string) {
  return getObject(photoObjectKey(relative));
}

export async function deleteCarePhoto(relative: string) {
  await deleteObject(photoObjectKey(relative));
}

function pdfRelativeFromFilename(filename: string) {
  if (!filename || filename.endsWith(".pdf") || !/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes("..")) {
    throw new StorageError("invalid_key", "invalid pdf path");
  }
  return `${filename}.pdf`;
}

function assertPdfRelative(relative: string) {
  if (
    !relative ||
    relative.includes("\0") ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes("..") ||
    !/^[A-Za-z0-9._-]+\.pdf$/.test(relative)
  ) {
    throw new StorageError("invalid_key", "invalid pdf path");
  }
  return relative;
}

function assertPhotoRelative(relative: string) {
  if (!relative || relative.includes("\0") || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) {
    throw new StorageError("invalid_key", "invalid photo path");
  }
  const [reportId, filename, ...rest] = relative.split("/");
  const match = filename?.match(/^(.+)\.(jpg|png|webp)$/);
  if (rest.length || !match || !isSafeStorageSegment(reportId) || !isSafeStorageSegment(match[1])) {
    throw new StorageError("invalid_key", "invalid photo path");
  }
  return relative;
}

let cachedClient: S3Client | null = null;
let cachedClientKey = "";

function r2Client(store: Extract<ObjectStoreConfig, { mode: "r2" }>) {
  const key = `${store.endpoint}\0${store.bucket}\0${store.accessKeyId}\0${store.secretAccessKey}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: store.endpoint,
    credentials: {
      accessKeyId: store.accessKeyId,
      secretAccessKey: store.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cachedClientKey = key;
  return cachedClient;
}

function storageRoot() {
  return path.join(process.cwd(), "storage");
}

function localPath(key: string) {
  const base = path.resolve(storageRoot());
  const absolute = path.resolve(base, key);
  if (absolute !== base && !absolute.startsWith(base + path.sep)) {
    throw new StorageError("invalid_key", "invalid object path");
  }
  return absolute;
}

async function putObject(key: string, body: Buffer, contentType: string) {
  const store = resolveObjectStore();
  if (store.mode === "r2") {
    await r2Client(store).send(
      new PutObjectCommand({
        Bucket: store.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const absolute = localPath(key);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, body);
}

async function getObject(key: string) {
  const store = resolveObjectStore();
  if (store.mode === "r2") {
    try {
      const result = await r2Client(store).send(
        new GetObjectCommand({
          Bucket: store.bucket,
          Key: key,
        }),
      );
      if (!result.Body) throw new StorageError("not_found", "object not found");
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof StorageError) throw error;
      if (isMissingObject(error)) throw new StorageError("not_found", "object not found");
      throw error;
    }
  }
  return readFile(localPath(key));
}

async function deleteObject(key: string) {
  const store = resolveObjectStore();
  if (store.mode === "r2") {
    await r2Client(store).send(
      new DeleteObjectCommand({
        Bucket: store.bucket,
        Key: key,
      }),
    );
    return;
  }
  await unlink(localPath(key));
}

function isMissingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const code = "Code" in error ? String(error.Code) : "";
  return name === "NoSuchKey" || name === "NotFound" || code === "NoSuchKey" || code === "NotFound";
}
