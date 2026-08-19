-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('KNOWLEDGE', 'PROPERTY_CARE', 'OPERATION');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "propertyId" TEXT,
    "kind" "VisitKind" NOT NULL DEFAULT 'KNOWLEDGE',
    "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_scheduledAt_status_idx" ON "Visit"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "Visit_leadId_scheduledAt_idx" ON "Visit"("leadId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
