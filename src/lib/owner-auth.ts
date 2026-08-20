import type { Person, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PULSE_SITE_DISABLED } from "@/lib/pulse";
import { normalizeOwnerEmail } from "@/lib/owner-auth-core";

export {
  isOwnerEmailFormat,
  normalizeOwnerEmail,
  ownerCanAccessSite,
  personEmailMatches,
  rememberLocalOwnerOtp,
  safeCasaNext,
  siteOwnerLookup,
  takeLocalOwnerOtp,
} from "@/lib/owner-auth-core";

export async function findEligibleOwnerPersons(email: string): Promise<Person[]> {
  const normalized = normalizeOwnerEmail(email);
  if (!normalized) return [];
  return prisma.person.findMany({
    where: {
      email: { equals: normalized, mode: "insensitive" },
      properties: {
        some: {
          pulseSite: {
            is: { status: { not: PULSE_SITE_DISABLED } },
          },
        },
      },
    },
  });
}

export async function ensureOwnerUser(
  email: string,
): Promise<{ ok: true; user: User } | { ok: false; reason: "staff" | "none" }> {
  const normalized = normalizeOwnerEmail(email);
  const persons = await findEligibleOwnerPersons(normalized);
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (user) {
    if (user.role === "STAFF") return { ok: false, reason: "staff" };
    const unlinkedIds = persons.filter((person) => !person.userId).map((person) => person.id);
    if (unlinkedIds.length) {
      await prisma.person.updateMany({
        where: { id: { in: unlinkedIds } },
        data: { userId: user.id },
      });
    }
    return { ok: true, user };
  }

  if (persons.length === 0) return { ok: false, reason: "none" };

  const created = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: persons[0]?.name.trim() || "Proprietário",
      email: normalized,
      emailVerified: false,
      role: "OWNER",
    },
  });
  await prisma.person.updateMany({
    where: { id: { in: persons.filter((person) => !person.userId).map((person) => person.id) } },
    data: { userId: created.id },
  });
  return { ok: true, user: created };
}

export async function isStaffEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeOwnerEmail(email) },
    select: { role: true },
  });
  return user?.role === "STAFF";
}

export async function ownerHasSite(userId: string, siteId: string) {
  const site = await prisma.pulseSite.findFirst({
    where: {
      id: siteId,
      status: { not: PULSE_SITE_DISABLED },
      property: { person: { userId } },
    },
    select: { id: true },
  });
  return Boolean(site);
}


