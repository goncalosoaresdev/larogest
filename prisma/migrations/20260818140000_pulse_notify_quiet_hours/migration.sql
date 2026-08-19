-- AlterTable
ALTER TABLE "PulseNotifySettings" ADD COLUMN "quietEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PulseNotifySettings" ADD COLUMN "quietStart" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "PulseNotifySettings" ADD COLUMN "quietEnd" TEXT NOT NULL DEFAULT '08:00';
