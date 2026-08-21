CREATE TYPE "CareChecklistKey" AS ENUM ('DOORS', 'WINDOWS', 'MAIL', 'AIR', 'WATER', 'LIGHTS', 'WASTE', 'EXTERIOR');
CREATE TYPE "CareChecklistStatus" AS ENUM ('DONE', 'SKIPPED', 'ATTENTION');

CREATE TABLE "CareReportItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "key" "CareChecklistKey" NOT NULL,
    "status" "CareChecklistStatus" NOT NULL DEFAULT 'SKIPPED',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareReportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareReportItem_reportId_key_key" ON "CareReportItem"("reportId", "key");
CREATE INDEX "CareReportItem_reportId_sortOrder_idx" ON "CareReportItem"("reportId", "sortOrder");

ALTER TABLE "CareReportItem" ADD CONSTRAINT "CareReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CareReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CareReportItem" ("id", "reportId", "key", "status", "sortOrder", "createdAt", "updatedAt")
SELECT
  'item_' || r.id || '_' || k.key,
  r.id,
  k.key::"CareChecklistKey",
  'SKIPPED'::"CareChecklistStatus",
  k.ord,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CareReport" r
CROSS JOIN (
  VALUES
    ('DOORS', 0),
    ('WINDOWS', 1),
    ('MAIL', 2),
    ('AIR', 3),
    ('WATER', 4),
    ('LIGHTS', 5),
    ('WASTE', 6),
    ('EXTERIOR', 7)
) AS k(key, ord);

ALTER TABLE "CareReportPhoto" ADD COLUMN "itemId" TEXT;

UPDATE "CareReportPhoto" AS p
SET "itemId" = i.id
FROM "CareReportItem" AS i
WHERE i."reportId" = p."reportId" AND i."key" = 'DOORS';

DELETE FROM "CareReportPhoto" WHERE "itemId" IS NULL;

ALTER TABLE "CareReportPhoto" ALTER COLUMN "itemId" SET NOT NULL;
ALTER TABLE "CareReportPhoto" DROP CONSTRAINT "CareReportPhoto_reportId_fkey";
DROP INDEX "CareReportPhoto_reportId_sortOrder_idx";
ALTER TABLE "CareReportPhoto" DROP COLUMN "reportId";
CREATE INDEX "CareReportPhoto_itemId_sortOrder_idx" ON "CareReportPhoto"("itemId", "sortOrder");
ALTER TABLE "CareReportPhoto" ADD CONSTRAINT "CareReportPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CareReportItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
