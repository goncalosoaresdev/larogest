-- AlterEnum
ALTER TYPE "PulseDeviceKind" ADD VALUE 'MOTION';

-- AlterEnum
ALTER TYPE "PulseAlertType" ADD VALUE 'MOTION';

-- AlterTable
ALTER TABLE "PulseSample" ADD COLUMN "motion" BOOLEAN;
ALTER TABLE "PulseSample" ADD COLUMN "lux" DOUBLE PRECISION;
