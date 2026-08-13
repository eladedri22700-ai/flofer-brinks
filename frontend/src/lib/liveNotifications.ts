/** Lock-screen / background alerts for a live round (PWA Notification API). */

import { formatTimeHe } from "./roundBrief";

const TAG_LIVE = "flofer-live";
const TAG_ALERT = "flofer-alert";

export function notificationsGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export async function requestLiveNotifications(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

async function showNotice(
  title: string,
  body: string,
  tag: string,
  urgent: boolean,
  renotify = true,
): Promise<void> {
  if (!notificationsGranted()) return;
  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    renotify,
    silent: !renotify,
    requireInteraction: urgent,
    data: { url: "/app/live" },
  } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.ready.catch(() => undefined);
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    /* permission or SW unavailable */
  }
}

/** Sticky-style pin: next stop on the lock screen (Android keeps it until dismissed). */
export async function pinNextStop(
  input: {
    name: string;
    eta?: string | null;
    returnHm?: string | null;
    left?: number;
  },
  opts?: { buzz?: boolean },
): Promise<void> {
  const eta = formatTimeHe(input.eta);
  const parts = [`הגעה ${eta}`];
  if (input.returnHm) parts.push(`חזרה לברינקס ${input.returnHm}`);
  if (input.left != null) parts.push(`${input.left} יעדים`);
  await showNotice(
    `הבא: ${input.name}`,
    parts.join(" · "),
    TAG_LIVE,
    true,
    opts?.buzz !== false,
  );
}

export async function alertApproach(name: string, distanceM: number): Promise<void> {
  await showNotice(
    `מתקרבים ל־${name}`,
    `כ־${Math.round(distanceM)} מ' · פתחו לניווט או סמנו הגעה`,
    TAG_ALERT,
    true,
  );
}

export async function alertArrive(name: string): Promise<void> {
  await showNotice(
    `הגעתם ל־${name}`,
    "סמנו בוצע באפליקציה כשסיימתם בנקודה",
    TAG_ALERT,
    true,
  );
}

export async function clearLivePin(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready.catch(() => undefined);
    if (!reg?.getNotifications) return;
    const list = await reg.getNotifications({ tag: TAG_LIVE });
    list.forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}
