-- CreateEnum
CREATE TYPE "PulseDeviceKind" AS ENUM ('GATEWAY', 'DOOR', 'TEMP_HUMIDITY', 'WATER');

-- CreateEnum
CREATE TYPE "PulseAlertType" AS ENUM ('WATER_LEAK', 'DOOR_OPEN', 'TEMP_HIGH', 'TEMP_LOW', 'HUMIDITY_HIGH', 'BATTERY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "PulseAlertStatus" AS ENUM ('OPEN', 'ACKED', 'RESOLVED');

-- CreateTable
CREATE TABLE "PulseSite" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tuyaHomeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PulseSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseDevice" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "PulseDeviceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tuyaDeviceId" TEXT,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "batteryPct" INTEGER,
    "lastPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PulseDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseAlert" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "deviceId" TEXT,
    "type" "PulseAlertType" NOT NULL,
    "status" "PulseAlertStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PulseAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PulseSite_propertyId_key" ON "PulseSite"("propertyId");

-- CreateIndex
CREATE INDEX "PulseDevice_siteId_kind_idx" ON "PulseDevice"("siteId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PulseDevice_siteId_kind_label_key" ON "PulseDevice"("siteId", "kind", "label");

-- CreateIndex
CREATE INDEX "PulseAlert_siteId_status_triggeredAt_idx" ON "PulseAlert"("siteId", "status", "triggeredAt");

-- AddForeignKey
ALTER TABLE "PulseSite" ADD CONSTRAINT "PulseSite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PulseDevice" ADD CONSTRAINT "PulseDevice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PulseSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PulseAlert" ADD CONSTRAINT "PulseAlert_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PulseSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PulseAlert" ADD CONSTRAINT "PulseAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PulseDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
