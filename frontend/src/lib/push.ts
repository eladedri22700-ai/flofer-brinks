import { apiFetch } from "../api/client";

/**
 * Web Push: lets the server alert the crew (delay, deadline at risk, missing
 * arrival) even when the app is closed. iPhone needs iOS 16.4+ and the app
 * installed to the home screen.
 */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function b64urlToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/**
 * Make sure this device is subscribed and the server knows it. Safe to call on
 * every app open — no prompt unless `askPermission` is true.
 */
export async function ensurePushSubscription(askPermission = false): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission === "denied") return false;
  if (Notification.permission !== "granted") {
    if (!askPermission) return false;
    if ((await Notification.requestPermission()) !== "granted") return false;
  }
  const reg = await navigator.serviceWorker.ready;
  const { public_key } = await apiFetch<{ public_key: string }>("/api/push/public-key");
  const key = b64urlToBytes(public_key);

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  await apiFetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return true;
}

export function sendTestPush() {
  return apiFetch<{ ok: boolean; devices: number }>("/api/push/test", { method: "POST", body: "{}" });
}
