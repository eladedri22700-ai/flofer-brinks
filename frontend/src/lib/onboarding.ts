export const ONBOARDING_KEY_PREFIX = "flofer_onboarding_v3";

export type OnboardingState = {
  /** Fully finished: permissions + live tour + switched to real mode */
  done: boolean;
  /** Install / location / notifications finished */
  permissionsDone: boolean;
  installSeen: boolean;
  locationOk: boolean | null;
  /** Background / screen-off guidance acknowledged */
  backgroundOk: boolean | null;
  wakeLockOk: boolean | null;
  notifyOk: boolean | null;
  completedAt?: string;
};

const EMPTY: OnboardingState = {
  done: false,
  permissionsDone: false,
  installSeen: false,
  locationOk: null,
  backgroundOk: null,
  wakeLockOk: null,
  notifyOk: null,
};

let activeUsername: string | null = null;

export function setOnboardingUser(username: string | null | undefined): void {
  activeUsername = username?.trim() ? username.trim().toLowerCase() : null;
}

export function onboardingStorageKey(username?: string | null): string {
  const u = (username ?? activeUsername ?? "_anon").toLowerCase();
  return `${ONBOARDING_KEY_PREFIX}_${u}`;
}

export function readOnboarding(username?: string | null): OnboardingState {
  try {
    const key = onboardingStorageKey(username);
    const raw = localStorage.getItem(key);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      ...EMPTY,
      ...parsed,
      done: Boolean(parsed.done),
      permissionsDone: Boolean(parsed.permissionsDone || parsed.done),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeOnboarding(
  patch: Partial<OnboardingState>,
  username?: string | null,
): OnboardingState {
  const next = { ...readOnboarding(username), ...patch };
  localStorage.setItem(onboardingStorageKey(username), JSON.stringify(next));
  return next;
}

export function markPermissionsDone(): void {
  writeOnboarding({ permissionsDone: true });
}

export function markOnboardingDone(): void {
  writeOnboarding({
    done: true,
    permissionsDone: true,
    completedAt: new Date().toISOString(),
  });
}

/** Restart live tour (keeps permissions). */
export function resetTourForReplay(): void {
  writeOnboarding({
    done: false,
    permissionsDone: true,
  });
}

/** Wipe onboarding for a user (and legacy global keys) — used by fresh pilot link. */
export function clearOnboarding(username?: string | null): void {
  try {
    localStorage.removeItem(onboardingStorageKey(username));
    localStorage.removeItem("flofer_onboarding_v2");
    localStorage.removeItem("flofer_onboarding_v1");
    if (username) {
      localStorage.removeItem(onboardingStorageKey(username));
    }
    // Clear any v3 keys for known pilots so a shared phone cannot skip the tour.
    for (const u of ["flofer", "test", "elad", "leader", "_anon"]) {
      localStorage.removeItem(`${ONBOARDING_KEY_PREFIX}_${u}`);
    }
  } catch {
    /* ignore */
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
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
