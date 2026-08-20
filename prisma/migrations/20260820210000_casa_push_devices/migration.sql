-- CreateEnum
CREATE TYPE "CasaPushPlatform" AS ENUM ('WEB', 'IOS');

-- CreateTable
CREATE TABLE "CasaPushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "CasaPushPlatform" NOT NULL,
    "endpoint" TEXT,
    "p256dh" TEXT,
    "auth" TEXT,
    "apnsToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasaPushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CasaPushDevice_endpoint_key" ON "CasaPushDevice"("endpoint");
CREATE UNIQUE INDEX "CasaPushDevice_apnsToken_key" ON "CasaPushDevice"("apnsToken");
CREATE INDEX "CasaPushDevice_userId_idx" ON "CasaPushDevice"("userId");

ALTER TABLE "CasaPushDevice" ADD CONSTRAINT "CasaPushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CasaPushDevice" ("id", "userId", "platform", "endpoint", "p256dh", "auth", "createdAt", "updatedAt")
SELECT DISTINCT ON (s.endpoint)
  s.id,
  COALESCE(linked.id, matched.id),
  'WEB'::"CasaPushPlatform",
  s.endpoint,
  s.p256dh,
  s.auth,
  s."createdAt",
  CURRENT_TIMESTAMP
FROM "PulsePushSubscription" s
JOIN "PulseSite" ps ON ps.id = s."siteId"
JOIN "Property" pr ON pr.id = ps."propertyId"
JOIN "Person" pe ON pe.id = pr."personId"
LEFT JOIN "user" linked ON linked.id = pe."userId" AND linked.role = 'OWNER'
LEFT JOIN "user" matched ON pe.email IS NOT NULL AND LOWER(matched.email) = LOWER(pe.email) AND matched.role = 'OWNER'
WHERE COALESCE(linked.id, matched.id) IS NOT NULL
ORDER BY s.endpoint, s."createdAt" DESC;

DROP TABLE "PulsePushSubscription";
