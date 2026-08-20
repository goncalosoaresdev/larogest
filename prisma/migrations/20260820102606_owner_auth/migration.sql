-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STAFF', 'OWNER');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STAFF';

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
