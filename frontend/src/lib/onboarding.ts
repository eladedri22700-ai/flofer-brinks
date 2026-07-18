export const ONBOARDING_KEY = "flofer_onboarding_v1";

export type OnboardingState = {
  done: boolean;
  installSeen: boolean;
  locationOk: boolean | null;
  notifyOk: boolean | null;
  completedAt?: string;
};

export function readOnboarding(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) {
      return { done: false, installSeen: false, locationOk: null, notifyOk: null };
    }
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return { done: false, installSeen: false, locationOk: null, notifyOk: null };
  }
}

export function writeOnboarding(patch: Partial<OnboardingState>): OnboardingState {
  const next = { ...readOnboarding(), ...patch };
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
  return next;
}

export function markOnboardingDone(): void {
  writeOnboarding({ done: true, completedAt: new Date().toISOString() });
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

export function detectPlatform(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
