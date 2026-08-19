-- CreateEnum
CREATE TYPE "IoTProvider" AS ENUM ('TUYA');

-- AlterTable
ALTER TABLE "PulseSite" ADD COLUMN "provider" "IoTProvider" NOT NULL DEFAULT 'TUYA';
ALTER TABLE "PulseSite" RENAME COLUMN "tuyaHomeId" TO "locationId";

-- AlterTable
ALTER TABLE "PulseDevice" RENAME COLUMN "tuyaDeviceId" TO "providerDeviceId";
ALTER INDEX "PulseDevice_tuyaDeviceId_key" RENAME TO "PulseDevice_providerDeviceId_key";
