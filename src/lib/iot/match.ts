import type { ProviderLocation } from "@/lib/iot/types";

export type LocationHints = {
  address?: string | null;
  city?: string | null;
  ownerName?: string | null;
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hintValues(hints: LocationHints) {
  const address = hints.address?.trim() ?? "";
  const street = address.split(",")[0]?.trim() ?? "";
  return [hints.ownerName, hints.city, address, street, [hints.ownerName, hints.city].filter(Boolean).join(" ")]
    .map((value) => fold(value ?? ""))
    .filter((value) => value.length >= 3);
}

function scoreName(homeName: string, hints: LocationHints) {
  const home = fold(homeName);
  if (!home) return 0;

  let best = 0;
  for (const hint of hintValues(hints)) {
    if (home === hint) best = Math.max(best, 100);
    else if (home.includes(hint) || hint.includes(home)) best = Math.max(best, 82);
    else {
      const homeTokens = new Set(home.split(" "));
      const hintTokens = hint.split(" ").filter((token) => token.length > 2);
      const overlap = hintTokens.filter((token) => homeTokens.has(token)).length;
      if (hintTokens.length && overlap / hintTokens.length >= 0.6) {
        best = Math.max(best, Math.round(70 + 20 * (overlap / hintTokens.length)));
      }
    }
  }
  return best;
}

export function matchProviderLocation(
  locations: ProviderLocation[],
  hints: LocationHints,
  takenIds: Iterable<string> = [],
): ProviderLocation | null {
  const taken = new Set(takenIds);
  const ranked = locations
    .filter((location) => !taken.has(location.id))
    .map((location) => ({ location, score: scoreName(location.name, hints) }))
    .filter((item) => item.score >= 70)
    .sort((left, right) => right.score - left.score);

  const winner = ranked[0];
  if (!winner) return null;
  if (ranked[1] && ranked[1].score >= winner.score - 5) return null;
  return winner.location;
}

export function expectedLocationNames(hints: LocationHints) {
  return [...new Set([hints.ownerName, hints.city, hints.address].map((value) => value?.trim()).filter(Boolean))] as string[];
}
