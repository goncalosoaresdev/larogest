-- CreateEnum
CREATE TYPE "CareReportVerdict" AS ENUM ('OK', 'ATTENTION', 'URGENT');

-- CreateEnum
CREATE TYPE "CareReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "CareReport" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "visitId" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "visitedByName" TEXT NOT NULL,
    "verdict" "CareReportVerdict" NOT NULL,
    "summary" TEXT NOT NULL,
    "nextVisitAt" TIMESTAMP(3),
    "status" "CareReportStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareReport_visitId_key" ON "CareReport"("visitId");
CREATE INDEX "CareReport_propertyId_status_visitedAt_idx" ON "CareReport"("propertyId", "status", "visitedAt");

ALTER TABLE "CareReport" ADD CONSTRAINT "CareReport_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareReport" ADD CONSTRAINT "CareReport_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
