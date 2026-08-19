-- CreateTable
CREATE TABLE "PulseNotifySettings" (
    "siteId" TEXT NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "water" BOOLEAN NOT NULL DEFAULT true,
    "offline" BOOLEAN NOT NULL DEFAULT true,
    "battery" BOOLEAN NOT NULL DEFAULT true,
    "climate" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PulseNotifySettings_pkey" PRIMARY KEY ("siteId")
);

-- AddForeignKey
ALTER TABLE "PulseNotifySettings" ADD CONSTRAINT "PulseNotifySettings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PulseSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
