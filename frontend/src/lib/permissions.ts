/** Browser / PWA permission helpers for field onboarding. */

export type PermissionKind = "geolocation" | "notifications";

export async function queryPermission(
  name: PermissionKind,
): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  try {
    if (!("permissions" in navigator)) return "unsupported";
    const status = await navigator.permissions.query({
      name: name as PermissionName,
    });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Ask for precise location and keep a short watch so the OS treats the
 * app as actively using GPS (helps "while using" / precise location prompts).
 */
export async function requestLocationAccess(): Promise<boolean> {
  if (!("geolocation" in navigator)) return false;

  const already = await queryPermission("geolocation");
  if (already === "denied") return false;

  const okOnce = await new Promise<boolean>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 },
    );
  });
  if (!okOnce) return false;

  // Brief continuous watch — reinforces realtime tracking permission.
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const id = navigator.geolocation.watchPosition(
      () => {
        navigator.geolocation.clearWatch(id);
        finish();
      },
      () => {
        navigator.geolocation.clearWatch(id);
        finish();
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    window.setTimeout(() => {
      navigator.geolocation.clearWatch(id);
      finish();
    }, 4000);
  });

  return true;
}

/** Request notification permission and show a confirmation ping. */
export async function requestNotificationAccess(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    await showReadyNotification();
    return true;
  }
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  if (result !== "granted") return false;
  await showReadyNotification();
  return true;
}

async function showReadyNotification(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const opts: NotificationOptions = {
      body: "ההתראות מוכנות. תקבלו עדכונים חשובים גם כשהאפליקציה ברקע.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "flofer-onboard",
    };
    if (reg) {
      await reg.showNotification("FLOFER BRINKS", opts);
    } else {
      new Notification("FLOFER BRINKS", opts);
    }
  } catch {
    /* granted even if display fails */
  }
}

/** Request screen wake lock so the display stays on during a round. */
export async function requestWakeLockSample(): Promise<boolean> {
  try {
    if (!("wakeLock" in navigator)) return false;
    const sentinel = await navigator.wakeLock.request("screen");
    // Hold briefly then release — proves capability; Live Mode holds for real.
    window.setTimeout(() => {
      void sentinel.release();
    }, 2500);
    return true;
  } catch {
    return false;
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
