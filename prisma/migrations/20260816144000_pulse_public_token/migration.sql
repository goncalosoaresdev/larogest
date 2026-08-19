-- AlterTable
ALTER TABLE "PulseSite" ADD COLUMN "publicToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PulseSite_publicToken_key" ON "PulseSite"("publicToken");
