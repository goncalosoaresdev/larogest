import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  deleteCarePhoto,
  pdfObjectKey,
  photoObjectKey,
  readCarePhoto,
  readPdf,
  resolveObjectStore,
  saveCarePhoto,
  savePdf,
  StorageError,
} from "./storage";

const R2_KEYS = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ACCOUNT_ID",
  "R2_ENDPOINT",
] as const;

async function withLocalStore<T>(fn: () => Promise<T>) {
  const previous = Object.fromEntries(R2_KEYS.map((key) => [key, process.env[key]]));
  for (const key of R2_KEYS) delete process.env[key];
  try {
    return await fn();
  } finally {
    for (const key of R2_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

describe("resolveObjectStore", () => {
  it("uses R2 when bucket credentials and an endpoint can be resolved", () => {
    assert.deepEqual(
      resolveObjectStore({
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "larogest",
        CLOUDFLARE_ACCOUNT_ID: "abc123",
        NODE_ENV: "production",
      }),
      {
        mode: "r2",
        endpoint: "https://abc123.r2.cloudflarestorage.com",
        bucket: "larogest",
        accessKeyId: "key",
        secretAccessKey: "secret",
      },
    );
  });

  it("prefers an explicit R2 endpoint and account id", () => {
    assert.deepEqual(
      resolveObjectStore({
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "larogest",
        R2_ACCOUNT_ID: "euacct",
        R2_ENDPOINT: "https://euacct.eu.r2.cloudflarestorage.com",
        CLOUDFLARE_ACCOUNT_ID: "other",
        NODE_ENV: "development",
      }),
      {
        mode: "r2",
        endpoint: "https://euacct.eu.r2.cloudflarestorage.com",
        bucket: "larogest",
        accessKeyId: "key",
        secretAccessKey: "secret",
      },
    );
  });

  it("allows local fallback only in development with R2 vars empty", () => {
    assert.deepEqual(
      resolveObjectStore({
        CLOUDFLARE_ACCOUNT_ID: "email-only",
        NODE_ENV: "development",
      }),
      { mode: "local" },
    );
  });

  it("fails closed in production without R2 credentials", () => {
    assert.throws(
      () => resolveObjectStore({ NODE_ENV: "production" }),
      (error: unknown) => error instanceof StorageError && error.code === "not_configured",
    );
  });

  it("treats partial R2 credentials as a misconfiguration", () => {
    assert.throws(
      () =>
        resolveObjectStore({
          R2_ACCESS_KEY_ID: "key",
          R2_BUCKET_NAME: "larogest",
          NODE_ENV: "development",
        }),
      (error: unknown) => error instanceof StorageError && error.code === "not_configured",
    );
  });
});

describe("object keys", () => {
  it("prefixes stored relative paths", () => {
    assert.equal(pdfObjectKey("LARO-P-2026-001.pdf"), "pdfs/LARO-P-2026-001.pdf");
    assert.equal(photoObjectKey("reportid1/photoid12.jpg"), "care-photos/reportid1/photoid12.jpg");
  });

  it("rejects pdf path traversal", async () => {
    await assert.rejects(() => readPdf("../secret.pdf"), StorageError);
    await assert.rejects(() => readPdf("/tmp/secret.pdf"), StorageError);
    await assert.rejects(() => savePdf("../secret", Buffer.from("x")), StorageError);
  });

  it("rejects care photo path traversal", async () => {
    await assert.rejects(() => readCarePhoto("../secret.jpg"), StorageError);
    await assert.rejects(() => readCarePhoto("/tmp/secret.jpg"), StorageError);
    await assert.rejects(() => saveCarePhoto("../x", "photoid12", "jpg", Buffer.from("x")), StorageError);
  });
});

describe("local object store", () => {
  it("round-trips pdfs and care photos on disk when R2 is unset", async () => {
    await withLocalStore(async () => {
      const pdf = Buffer.from("%PDF-1.4 test");
      const photo = Buffer.from("fake-jpeg");
      const pdfPath = await savePdf("larogest-storage-test", pdf);
      const photoPath = await saveCarePhoto("storagetestreport", "storagetestphoto1", "jpg", photo);

      assert.equal(pdfPath, "larogest-storage-test.pdf");
      assert.equal(photoPath, "storagetestreport/storagetestphoto1.jpg");
      assert.deepEqual(await readPdf(pdfPath), pdf);
      assert.deepEqual(await readCarePhoto(photoPath), photo);

      await deleteCarePhoto(photoPath);
      await assert.rejects(() => readCarePhoto(photoPath));
      await unlink(path.join(process.cwd(), "storage", "pdfs", pdfPath));
    });
  });
});
