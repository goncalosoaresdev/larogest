export type CasaPushStatus = "hidden" | "ready" | "ios" | "granted" | "denied";

export function getCasaPushStatus(): CasaPushStatus {
  if (typeof window === "undefined") return "hidden";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "hidden";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && !standalone) return "ios";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "ready";
}

export async function subscribeCasaPush(
  siteId: string,
): Promise<{ ok: boolean; error?: string; host?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "push.unavailable" };
  if (!window.isSecureContext) {
    return { ok: false, error: "push.insecure", host: window.location.host };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "push.unsupported" };
  }

  try {
    const config = await fetch(`/api/casa/${siteId}/push`);
    if (!config.ok) return { ok: false, error: "push.unconfigured" };
    const { publicKey } = (await config.json()) as { publicKey: string };
    if (!publicKey) return { ok: false, error: "push.vapid" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, error: "push.permission" };

    const registration = await navigator.serviceWorker.register("/casa-sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await waitForWorker(registration);

    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toApplicationServerKey(publicKey),
    });
    const raw = subscription.toJSON();
    const response = await fetch(`/api/casa/${siteId}/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
    });
    if (!response.ok) return { ok: false, error: "push.save" };
    return { ok: true };
  } catch {
    return { ok: false, error: pushFailureKey(), host: window.location.hostname };
  }
}

export async function unsubscribeCasaPush(siteId: string) {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  const endpoint = subscription?.endpoint;
  await subscription?.unsubscribe();
  await fetch(`/api/casa/${siteId}/push`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

function pushFailureKey() {
  const host = window.location.hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  if ("brave" in navigator) return "push.brave";
  if (!local && window.location.protocol === "http:") return "push.http";
  return "push.failed";
}

async function waitForWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) return;
  if (worker.state === "activated") return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("service worker timeout")), 8000);
    const done = () => {
      if (worker.state === "activated") {
        window.clearTimeout(timer);
        worker.removeEventListener("statechange", done);
        resolve();
      }
      if (worker.state === "redundant") {
        window.clearTimeout(timer);
        worker.removeEventListener("statechange", done);
        reject(new Error("service worker redundant"));
      }
    };
    worker.addEventListener("statechange", done);
  });
}

function toApplicationServerKey(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
