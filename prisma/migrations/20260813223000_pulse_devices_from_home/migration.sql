-- AlterEnum
ALTER TYPE "PulseDeviceKind" ADD VALUE 'OTHER';

-- DropIndex
DROP INDEX "PulseDevice_siteId_kind_label_key";

-- CreateIndex
CREATE UNIQUE INDEX "PulseDevice_tuyaDeviceId_key" ON "PulseDevice"("tuyaDeviceId");
