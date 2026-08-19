-- CreateTable
CREATE TABLE "PulseSample" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "leak" BOOLEAN,
    "open" BOOLEAN,
    "batteryPct" INTEGER,
    "online" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PulseSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PulseSample_deviceId_recordedAt_idx" ON "PulseSample"("deviceId", "recordedAt");

-- AddForeignKey
ALTER TABLE "PulseSample" ADD CONSTRAINT "PulseSample_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PulseDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
