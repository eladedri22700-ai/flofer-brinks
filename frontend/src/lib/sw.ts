import { registerSW } from "virtual:pwa-register";

/**
 * Single service-worker registration for the whole app — from the very first
 * screen (login / onboarding), not only once the main layout mounts.
 * Notifications and Web Push depend on it.
 */
type UpdateFn = (reload?: boolean) => Promise<void>;

let update: UpdateFn | null = null;
let needRefresh = false;
const listeners = new Set<() => void>();

export function startServiceWorker(): void {
  if (update || typeof window === "undefined") return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      listeners.forEach((l) => l());
    },
  });
}

export function onNeedRefresh(listener: () => void): () => void {
  listeners.add(listener);
  if (needRefresh) listener();
  return () => listeners.delete(listener);
}

export function applyUpdate(): Promise<void> | undefined {
  return update?.(true);
}

/**
 * navigator.serviceWorker.ready never settles when no worker is registered,
 * which left buttons spinning forever. Give up after a timeout instead.
 */
export async function swReady(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
