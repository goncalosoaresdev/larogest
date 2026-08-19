-- CreateTable
CREATE TABLE "PulsePushSubscription" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulsePushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PulsePushSubscription_endpoint_key" ON "PulsePushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PulsePushSubscription_siteId_idx" ON "PulsePushSubscription"("siteId");

-- AddForeignKey
ALTER TABLE "PulsePushSubscription" ADD CONSTRAINT "PulsePushSubscription_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PulseSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
