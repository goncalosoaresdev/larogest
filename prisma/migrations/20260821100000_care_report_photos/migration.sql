-- CreateTable
CREATE TABLE "CareReportPhoto" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareReportPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareReportPhoto_reportId_sortOrder_idx" ON "CareReportPhoto"("reportId", "sortOrder");

ALTER TABLE "CareReportPhoto" ADD CONSTRAINT "CareReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CareReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
