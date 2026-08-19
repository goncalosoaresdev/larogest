"use client";

import { useSyncExternalStore } from "react";
import {
  casaText,
  readCasaLocale,
  subscribeCasaLocale,
  writeCasaLocale,
  type CasaLocale,
  type CasaTextKey,
} from "@/lib/casa-locale";

export function useCasaLocale() {
  const locale = useSyncExternalStore(subscribeCasaLocale, readCasaLocale, () => "pt" as CasaLocale);
  return {
    locale,
    t: (key: CasaTextKey, vars?: Record<string, string | number>) => casaText(locale, key, vars),
    setLocale: (next: CasaLocale) => writeCasaLocale(next),
  };
}
