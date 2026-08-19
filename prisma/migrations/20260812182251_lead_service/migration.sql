-- CreateEnum
CREATE TYPE "LeadService" AS ENUM ('SCHEDULED_VISITS', 'AL_MANAGEMENT');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "service" "LeadService" NOT NULL DEFAULT 'AL_MANAGEMENT';
