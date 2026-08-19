"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({ interval = 60_000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    async function loop() {
      if (!cancelled && document.visibilityState === "visible") {
        router.refresh();
      }
      if (!cancelled) timer = window.setTimeout(loop, interval);
    }

    timer = window.setTimeout(loop, interval);
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [interval, router]);

  return null;
}
